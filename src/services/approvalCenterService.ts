import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/services/notificationService";
import { requestWorkflowService, type ExecutionLifecycleStatus } from "@/services/requestWorkflowService";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | { [key: string]: JsonValue } | JsonValue[];

export type ApprovalStatus = "pending" | "approved" | "rejected" | "returned_for_revision";
export type WorkflowStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "returned_for_revision"
  | "in_purchasing"
  | "in_accounting"
  | "completed";

export interface ApprovalRequest {
  id: string;
  sourceModule: string;
  sourceTable: string;
  sourceRecordId: string;
  requestType: string;
  requestedBy: string;
  requestedAt: string;
  projectId: string | null;
  projectName: string | null;
  status: ApprovalStatus;
  workflowStatus: WorkflowStatus;
  targetModule: string | null;
  routedAt: string | null;
  processedAt: string | null;
  completedAt: string | null;
  summary: string | null;
  latestComment: string | null;
  payload: JsonValue | null;
}

export interface ApprovalAction {
  id: string;
  approvalRequestId: string;
  actorUserId: string | null;
  actorName: string;
  actionStatus: ApprovalStatus;
  comments: string | null;
  createdAt: string;
}

export interface CreateApprovalRequestInput {
  sourceModule: string;
  sourceTable: string;
  sourceRecordId: string;
  requestType: string;
  requestedBy: string;
  projectId?: string | null;
  summary?: string | null;
  latestComment?: string | null;
  payload?: JsonValue | null;
}

const archivableSourceTables = ["purchases", "site_requests", "cash_advance_requests", "leave_requests"] as const;

function isArchivableSourceTable(sourceTable: string): sourceTable is (typeof archivableSourceTables)[number] {
  return archivableSourceTables.includes(sourceTable as (typeof archivableSourceTables)[number]);
}

function createPurchaseNumber() {
  return `PR-${Math.floor(10000 + Math.random() * 90000)}`;
}

function createVoucherNumber() {
  return `VCH-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
}

function normalizeRequestLabel(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/\s+/g, " ").trim();
}

function resolveTargetModule(sourceTable: string, requestType: string, payload?: JsonValue | null) {
  const payloadRequestType =
    payload && !Array.isArray(payload) && typeof payload === "object" && typeof payload.requestType === "string"
      ? payload.requestType
      : null;
  const normalized = normalizeRequestLabel(payloadRequestType || requestType);

  if (sourceTable === "site_requests") {
    if (normalized.includes("material") || normalized.includes("tool") || normalized.includes("equipment")) return "Purchasing";
    if (normalized.includes("cash advance") || normalized.includes("petty cash")) return "Accounting";
  }

  if (sourceTable === "voucher_requests" || sourceTable === "cash_advance_requests" || sourceTable === "vouchers" || sourceTable === "liquidations") {
    return "Accounting";
  }

  if (sourceTable === "purchases") return "Purchasing";
  if (sourceTable === "leave_requests") return "HR";
  return null;
}

function resolveWorkflowStatus(status: ApprovalStatus, targetModule: string | null): WorkflowStatus {
  if (status === "approved" && targetModule === "Purchasing") return "in_purchasing";
  if (status === "approved" && targetModule === "Accounting") return "in_accounting";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "returned_for_revision") return "returned_for_revision";
  return "pending_approval";
}

function resolveExecutionLifecycle(sourceTable: string, status: ApprovalStatus, targetModule: string | null): ExecutionLifecycleStatus {
  if (sourceTable === "voucher_requests" && status === "approved") return "ready_for_delivery";
  if (status === "approved" && targetModule === "Purchasing") return "in_purchasing";
  if (status === "approved" && targetModule === "Accounting") return "in_accounting";
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (status === "returned_for_revision") return "returned_for_revision";
  return "pending_approval";
}

async function listArchivedSourceIds() {
  const archivedQueries = await Promise.all(
    archivableSourceTables.map(async (table) => {
      const { data, error } = await supabase.from(table).select("id").eq("is_archived", true);
      if (error) throw error;
      return (data || []).map((item) => item.id);
    })
  );

  return new Set(archivedQueries.flat());
}

function mapSourceStatus(sourceTable: string, status: ApprovalStatus) {
  if (status === "approved") return "approved";
  if (status === "rejected") return "rejected";
  if (sourceTable === "purchases" || sourceTable === "vouchers") return "pending";
  return "pending";
}

async function syncSourceRecord(sourceTable: string, sourceRecordId: string, status: ApprovalStatus) {
  const mappedStatus = mapSourceStatus(sourceTable, status);
  const tableName =
    sourceTable === "site_requests" ||
    sourceTable === "cash_advance_requests" ||
    sourceTable === "leave_requests" ||
    sourceTable === "liquidations" ||
    sourceTable === "vouchers" ||
    sourceTable === "voucher_requests" ||
    sourceTable === "purchases"
      ? sourceTable
      : null;

  if (!tableName) return;
  await supabase.from(tableName).update({ status: mappedStatus }).eq("id", sourceRecordId);
}

async function processApprovedRequest(request: {
  sourceTable: string;
  sourceRecordId: string;
  requestType: string;
  requestedBy: string;
  projectId: string | null;
  approvalRequestId: string;
}) {
  if (request.sourceTable === "site_requests") {
    const { data: source, error } = await supabase
      .from("site_requests")
      .select("id, form_number, request_date, item_name, quantity, unit, amount, request_type, project_id")
      .eq("id", request.sourceRecordId)
      .maybeSingle();

    if (error || !source) return;
    const normalizedType = normalizeRequestLabel(source.request_type || request.requestType);

    if (normalizedType.includes("material") || normalizedType.includes("tool") || normalizedType.includes("equipment")) {
      const orderNumber = source.form_number || createPurchaseNumber();
      let purchase = await supabase
        .from("purchases")
        .select("id, supplier, total_cost")
        .eq("order_number", orderNumber)
        .eq("item_name", source.item_name)
        .maybeSingle();

      if (!purchase.data) {
        purchase = await supabase
          .from("purchases")
          .insert({
            order_number: orderNumber,
            order_date: source.request_date,
            supplier: "Pending Selection",
            item_name: source.item_name,
            category: normalizedType.includes("material") ? "Construction Materials" : "Tools",
            quantity: Number(source.quantity || 0),
            unit: source.unit || "unit",
            unit_cost: 0,
            destination_type: "project_warehouse",
            project_id: source.project_id,
            status: "pending",
            notes: `Linked Site Request ${source.id}`,
          })
          .select("id, supplier, total_cost")
          .maybeSingle();
      }

      if (purchase.data?.id) {
        await requestWorkflowService.linkPurchaseRecord({
          siteRequestId: source.id,
          purchaseId: purchase.data.id,
          supplier: purchase.data.supplier,
          totalAmount: Number(purchase.data.total_cost || 0),
        });
      }
      return;
    }

    await requestWorkflowService.updateLifecycleBySiteRequest(source.id, {
      target_module: "Accounting",
      lifecycle_status: "in_accounting",
      total_amount: Number(source.amount || 0),
    });
    return;
  }

  if (request.sourceTable === "voucher_requests") {
    const { data: voucherRequest, error } = await supabase
      .from("voucher_requests")
      .select("id, purchase_id, site_request_id, project_id, supplier, total_amount, description, requested_by, voucher_number")
      .eq("id", request.sourceRecordId)
      .maybeSingle();

    if (error || !voucherRequest) return;

    const voucherNumber = voucherRequest.voucher_number || createVoucherNumber();
    let voucher = await supabase
      .from("vouchers")
      .select("id")
      .eq("voucher_number", voucherNumber)
      .maybeSingle();

    if (!voucher.data) {
      voucher = await supabase
        .from("vouchers")
        .insert({
          voucher_number: voucherNumber,
          date: new Date().toISOString().split("T")[0],
          type: "payment",
          payee: voucherRequest.supplier || voucherRequest.requested_by,
          amount: Number(voucherRequest.total_amount || 0),
          description: voucherRequest.description || `Voucher for purchase ${voucherRequest.purchase_id}`,
          project_id: voucherRequest.project_id,
          status: "approved",
        })
        .select("id")
        .maybeSingle();
    }

    await supabase
      .from("voucher_requests")
      .update({
        voucher_number: voucherNumber,
        approved_at: new Date().toISOString(),
        accounting_status: "ready_for_delivery",
        updated_at: new Date().toISOString(),
      })
      .eq("id", voucherRequest.id);

    await supabase.from("purchases").update({ voucher_number: voucherNumber, status: "approved" }).eq("id", voucherRequest.purchase_id);

    if (voucher.data?.id) {
      await requestWorkflowService.markVoucherApproved({
        voucherRequestId: voucherRequest.id,
        voucherId: voucher.data.id,
        voucherNumber,
      });
    }
  }
}

export const approvalCenterService = {
  async createRequest(input: CreateApprovalRequestInput) {
    const timestamp = new Date().toISOString();
    const targetModule = resolveTargetModule(input.sourceTable, input.requestType, input.payload ?? null);

    const { data, error } = await supabase
      .from("approval_requests")
      .upsert(
        {
          source_module: input.sourceModule,
          source_table: input.sourceTable,
          source_record_id: input.sourceRecordId,
          request_type: input.requestType,
          requested_by: input.requestedBy,
          requested_at: timestamp,
          project_id: input.projectId || null,
          status: "pending",
          target_module: targetModule,
          workflow_status: "pending_approval",
          summary: input.summary || null,
          latest_comment: input.latestComment || null,
          payload: input.payload ?? null,
          updated_at: timestamp,
        },
        { onConflict: "source_table,source_record_id" }
      )
      .select("id")
      .maybeSingle();

    if (error) throw error;

    if (data?.id && input.sourceTable === "site_requests") {
      await requestWorkflowService.ensureSiteRequestWorkflow({
        siteRequestId: input.sourceRecordId,
        approvalRequestId: data.id,
        projectId: input.projectId || null,
        targetModule,
        lifecycleStatus: "pending_approval",
        totalAmount:
          input.payload && !Array.isArray(input.payload) && typeof input.payload === "object" && typeof input.payload.amount === "number"
            ? input.payload.amount
            : 0,
      });
    }

    if (data?.id) {
      await notificationService.createNotification({
        approvalRequestId: data.id,
        audienceModule: "GM",
        targetSurface: "Approval Center",
        eventType: "request_submitted",
        title: `${input.sourceModule} request submitted`,
        message: input.summary ? `${input.requestType} • ${input.summary}` : `${input.requestType} from ${input.requestedBy}`,
        payload: {
          sourceTable: input.sourceTable,
          sourceRecordId: input.sourceRecordId,
          requestType: input.requestType,
          requestedBy: input.requestedBy,
          projectId: input.projectId || null,
          targetModule,
        },
      });
    }

    return data;
  },

  async listRequests() {
    const { data, error } = await supabase
      .from("approval_requests")
      .select("id, source_module, source_table, source_record_id, request_type, requested_by, requested_at, project_id, status, workflow_status, target_module, routed_at, processed_at, completed_at, summary, latest_comment, payload, projects(name)")
      .order("requested_at", { ascending: false });

    if (error) throw error;
    const archivedSourceIds = await listArchivedSourceIds();

    return (data || [])
      .filter((item) => !archivedSourceIds.has(item.source_record_id))
      .map((item) => ({
        id: item.id,
        sourceModule: item.source_module,
        sourceTable: item.source_table,
        sourceRecordId: item.source_record_id,
        requestType: item.request_type,
        requestedBy: item.requested_by,
        requestedAt: item.requested_at,
        projectId: item.project_id,
        projectName: Array.isArray(item.projects) ? item.projects[0]?.name || null : item.projects?.name || null,
        status: item.status as ApprovalStatus,
        workflowStatus: item.workflow_status as WorkflowStatus,
        targetModule: item.target_module,
        routedAt: item.routed_at,
        processedAt: item.processed_at,
        completedAt: item.completed_at,
        summary: item.summary,
        latestComment: item.latest_comment,
        payload: item.payload as JsonValue | null,
      })) as ApprovalRequest[];
  },

  async listActions(approvalRequestId: string) {
    const { data, error } = await supabase
      .from("approval_actions")
      .select("id, approval_request_id, actor_user_id, actor_name, action_status, comments, created_at")
      .eq("approval_request_id", approvalRequestId)
      .order("created_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => ({
      id: item.id,
      approvalRequestId: item.approval_request_id,
      actorUserId: item.actor_user_id,
      actorName: item.actor_name,
      actionStatus: item.action_status as ApprovalStatus,
      comments: item.comments,
      createdAt: item.created_at,
    })) as ApprovalAction[];
  },

  async updateStatus(approvalRequestId: string, status: ApprovalStatus, comments: string) {
    const { data: authData } = await supabase.auth.getUser();
    if (!authData.user) throw new Error("Unauthorized");

    const { data: profile } = await supabase.from("profiles").select("full_name, email").eq("id", authData.user.id).maybeSingle();
    const actorName = profile?.full_name || profile?.email || authData.user.email || "User";

    const { data: request, error: requestError } = await supabase
      .from("approval_requests")
      .select("id, source_module, source_table, source_record_id, request_type, requested_by, project_id, summary, payload, target_module")
      .eq("id", approvalRequestId)
      .single();

    if (requestError || !request) throw requestError || new Error("Approval request not found");

    const timestamp = new Date().toISOString();
    const targetModule = request.target_module || resolveTargetModule(request.source_table, request.request_type, request.payload as JsonValue | null);
    const workflowStatus = resolveWorkflowStatus(status, targetModule);

    const { error: updateError } = await supabase
      .from("approval_requests")
      .update({
        status,
        target_module: targetModule,
        workflow_status: workflowStatus,
        latest_comment: comments || null,
        reviewed_by: authData.user.id,
        reviewed_at: timestamp,
        routed_at: status === "approved" && targetModule ? timestamp : null,
        processed_at: null,
        completed_at: null,
        updated_at: timestamp,
      })
      .eq("id", approvalRequestId);

    if (updateError) throw updateError;

    const { error: actionError } = await supabase.from("approval_actions").insert({
      approval_request_id: approvalRequestId,
      actor_user_id: authData.user.id,
      actor_name: actorName,
      action_status: status,
      comments: comments || null,
    });

    if (actionError) throw actionError;

    await syncSourceRecord(request.source_table, request.source_record_id, status);

    if (request.source_table === "site_requests") {
      await requestWorkflowService.updateLifecycleBySiteRequest(request.source_record_id, {
        target_module: targetModule,
        lifecycle_status: resolveExecutionLifecycle(request.source_table, status, targetModule),
      });
    }

    if (status === "approved") {
      await processApprovedRequest({
        sourceTable: request.source_table,
        sourceRecordId: request.source_record_id,
        requestType: request.request_type,
        requestedBy: request.requested_by,
        projectId: request.project_id,
        approvalRequestId,
      });
    }

    await notificationService.createNotification({
      approvalRequestId,
      audienceModule: request.source_module,
      targetSurface: request.source_module,
      eventType: "status_updated",
      title: `${request.request_type} ${status.replaceAll("_", " ")}`,
      message: request.summary
        ? `${actorName} marked this request as ${status.replaceAll("_", " ")} • ${request.summary}`
        : `${actorName} marked this request as ${status.replaceAll("_", " ")}`,
      payload: {
        status,
        workflowStatus,
        comments: comments || null,
        sourceTable: request.source_table,
        sourceRecordId: request.source_record_id,
        requestType: request.request_type,
        targetModule,
      },
    });

    if (status === "approved" && targetModule) {
      await notificationService.createNotification({
        approvalRequestId,
        audienceModule: targetModule,
        targetSurface: targetModule,
        eventType: "request_routed",
        title: `New approved ${request.request_type}`,
        message: request.summary ? `${request.summary} routed to ${targetModule}` : `${request.request_type} routed to ${targetModule}`,
        payload: {
          status,
          workflowStatus,
          targetModule,
          sourceModule: request.source_module,
          sourceTable: request.source_table,
          sourceRecordId: request.source_record_id,
        },
      });
    }

    if (status === "approved" && request.source_table === "voucher_requests") {
      await notificationService.createNotification({
        approvalRequestId,
        audienceModule: "Purchasing",
        targetSurface: "Purchasing",
        eventType: "voucher_approved",
        title: "Voucher approved",
        message: request.summary || `${request.request_type} is ready for delivery`,
        payload: {
          sourceTable: request.source_table,
          sourceRecordId: request.source_record_id,
        },
      });
    }
  },

  async listModuleInbox(targetModule: string) {
    const workflowStates = targetModule === "Purchasing" ? ["in_purchasing", "completed"] : targetModule === "Accounting" ? ["in_accounting", "completed"] : ["approved", "completed"];

    const { data, error } = await supabase
      .from("approval_requests")
      .select("id, source_module, source_table, source_record_id, request_type, requested_by, requested_at, project_id, status, workflow_status, target_module, routed_at, processed_at, completed_at, summary, latest_comment, payload, projects(name)")
      .eq("target_module", targetModule)
      .in("workflow_status", workflowStates)
      .order("updated_at", { ascending: false });

    if (error) throw error;

    return (data || []).map((item) => ({
      id: item.id,
      sourceModule: item.source_module,
      sourceTable: item.source_table,
      sourceRecordId: item.source_record_id,
      requestType: item.request_type,
      requestedBy: item.requested_by,
      requestedAt: item.requested_at,
      projectId: item.project_id,
      projectName: Array.isArray(item.projects) ? item.projects[0]?.name || null : item.projects?.name || null,
      status: item.status as ApprovalStatus,
      workflowStatus: item.workflow_status as WorkflowStatus,
      targetModule: item.target_module,
      routedAt: item.routed_at,
      processedAt: item.processed_at,
      completedAt: item.completed_at,
      summary: item.summary,
      latestComment: item.latest_comment,
      payload: item.payload as JsonValue | null,
    })) as ApprovalRequest[];
  },

  async updateWorkflowStatus(approvalRequestId: string, workflowStatus: WorkflowStatus) {
    const timestamp = new Date().toISOString();

    const { data: request, error: requestError } = await supabase
      .from("approval_requests")
      .select("id, source_module, source_table, source_record_id, request_type, summary, target_module")
      .eq("id", approvalRequestId)
      .single();

    if (requestError || !request) throw requestError || new Error("Approval request not found");

    const { error: updateError } = await supabase
      .from("approval_requests")
      .update({
        workflow_status: workflowStatus,
        processed_at: workflowStatus === "completed" ? timestamp : null,
        completed_at: workflowStatus === "completed" ? timestamp : null,
        updated_at: timestamp,
      })
      .eq("id", approvalRequestId);

    if (updateError) throw updateError;

    if (workflowStatus === "completed") {
      await notificationService.createNotification({
        approvalRequestId,
        audienceModule: request.source_module,
        targetSurface: request.source_module,
        eventType: "request_completed",
        title: `${request.request_type} completed`,
        message: request.summary ? `${request.target_module || "Destination module"} completed • ${request.summary}` : `${request.target_module || "Destination module"} completed this request`,
        payload: {
          workflowStatus,
          targetModule: request.target_module,
        },
      });
    }
  },

  async archiveRequest(approvalRequestId: string) {
    const { data: request, error: requestError } = await supabase
      .from("approval_requests")
      .select("id, source_table, source_record_id, status")
      .eq("id", approvalRequestId)
      .single();

    if (requestError || !request) throw requestError || new Error("Approval request not found");
    if (request.status !== "approved") throw new Error("Only approved requests can be archived to the GM Vault");
    if (!isArchivableSourceTable(request.source_table)) throw new Error("This approval type is not linked to the GM Vault archive");

    const { error: archiveError } = await supabase.from(request.source_table).update({ is_archived: true }).eq("id", request.source_record_id);
    if (archiveError) throw archiveError;
  },
};