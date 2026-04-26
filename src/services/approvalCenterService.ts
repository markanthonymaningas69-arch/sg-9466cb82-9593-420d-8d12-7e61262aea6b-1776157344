import { supabase } from "@/integrations/supabase/client";
import { notificationService } from "@/services/notificationService";

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

const archivableSourceTables = [
  "purchases",
  "site_requests",
  "cash_advance_requests",
  "leave_requests",
] as const;

type ArchivableSourceTable = (typeof archivableSourceTables)[number];

function isArchivableSourceTable(sourceTable: string): sourceTable is ArchivableSourceTable {
  return archivableSourceTables.includes(sourceTable as ArchivableSourceTable);
}

async function listArchivedSourceIds() {
  const archivedQueries = await Promise.all(
    archivableSourceTables.map(async (table) => {
      const { data, error } = await supabase.from(table).select("id").eq("is_archived", true);

      if (error) {
        throw error;
      }

      return (data || []).map((item) => item.id);
    })
  );

  return new Set(archivedQueries.flat());
}

function mapApprovalStatus(sourceTable: string, status: ApprovalStatus) {
  if (sourceTable === "purchases") {
    if (status === "approved") {
      return "approved";
    }
    return "pending";
  }

  if (sourceTable === "site_requests") {
    if (status === "approved") {
      return "approved";
    }
    if (status === "rejected") {
      return "rejected";
    }
    return "pending";
  }

  if (sourceTable === "cash_advance_requests") {
    if (status === "approved") {
      return "approved";
    }
    if (status === "rejected") {
      return "rejected";
    }
    return "pending";
  }

  if (sourceTable === "leave_requests") {
    if (status === "approved") {
      return "approved";
    }
    if (status === "rejected") {
      return "rejected";
    }
    return "pending";
  }

  if (sourceTable === "liquidations") {
    if (status === "approved") {
      return "approved";
    }
    if (status === "rejected") {
      return "rejected";
    }
    return "pending";
  }

  if (sourceTable === "vouchers") {
    if (status === "approved") {
      return "approved";
    }
    return "pending";
  }

  return null;
}

async function syncSourceRecord(sourceTable: string, sourceRecordId: string, status: ApprovalStatus) {
  const mappedStatus = mapApprovalStatus(sourceTable, status);

  if (!mappedStatus) {
    return;
  }

  if (sourceTable === "purchases") {
    await supabase.from("purchases").update({ status: mappedStatus }).eq("id", sourceRecordId);
    return;
  }

  if (sourceTable === "site_requests") {
    await supabase.from("site_requests").update({ status: mappedStatus }).eq("id", sourceRecordId);
    return;
  }

  if (sourceTable === "cash_advance_requests") {
    await supabase.from("cash_advance_requests").update({ status: mappedStatus }).eq("id", sourceRecordId);
    return;
  }

  if (sourceTable === "leave_requests") {
    await supabase.from("leave_requests").update({ status: mappedStatus }).eq("id", sourceRecordId);
    return;
  }

  if (sourceTable === "liquidations") {
    await supabase.from("liquidations").update({ status: mappedStatus }).eq("id", sourceRecordId);
    return;
  }

  if (sourceTable === "vouchers") {
    await supabase.from("vouchers").update({ status: mappedStatus }).eq("id", sourceRecordId);
  }
}

function createVoucherNumber() {
  return `PV-${Math.floor(10000 + Math.random() * 90000)}`;
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
    if (normalized.includes("material")) {
      return "Purchasing";
    }

    if (normalized.includes("tool") || normalized.includes("equipment")) {
      return "Purchasing";
    }

    if (normalized.includes("cash advance")) {
      return "Accounting";
    }

    if (normalized.includes("petty cash")) {
      return "Accounting";
    }
  }

  if (sourceTable === "cash_advance_requests" || sourceTable === "vouchers" || sourceTable === "liquidations") {
    return "Accounting";
  }

  if (sourceTable === "purchases") {
    return "Purchasing";
  }

  if (sourceTable === "leave_requests") {
    return "HR";
  }

  return null;
}

function resolveWorkflowStatus(status: ApprovalStatus, targetModule: string | null): WorkflowStatus {
  if (status === "approved" && targetModule === "Purchasing") {
    return "in_purchasing";
  }

  if (status === "approved" && targetModule === "Accounting") {
    return "in_accounting";
  }

  if (status === "approved") {
    return "approved";
  }

  if (status === "rejected") {
    return "rejected";
  }

  if (status === "returned_for_revision") {
    return "returned_for_revision";
  }

  return "pending_approval";
}

async function processApprovedRequest(request: {
  sourceTable: string;
  sourceRecordId: string;
  requestType: string;
  requestedBy: string;
  projectId: string | null;
}) {
  if (request.sourceTable === "site_requests") {
    const { data: source } = await supabase
      .from("site_requests")
      .select("id, form_number, request_date, item_name, quantity, unit, amount, request_type, project_id")
      .eq("id", request.sourceRecordId)
      .maybeSingle();

    if (!source) {
      return;
    }

    if (source.request_type === "Materials" || source.request_type === "Tools & Equipments") {
      const orderNumber = source.form_number || `PR-${Math.floor(10000 + Math.random() * 90000)}`;
      const { data: existingPurchase } = await supabase
        .from("purchases")
        .select("id")
        .eq("order_number", orderNumber)
        .eq("item_name", source.item_name)
        .maybeSingle();

      if (!existingPurchase) {
        await supabase.from("purchases").insert({
          order_number: orderNumber,
          order_date: source.request_date,
          supplier: "Pending Selection",
          item_name: source.item_name,
          category: source.request_type === "Materials" ? "Construction Materials" : "Tools",
          quantity: Number(source.quantity || 0),
          unit: source.unit || "unit",
          unit_cost: 0,
          destination_type: "project_warehouse",
          project_id: source.project_id,
          status: "pending",
        });
      }

      return;
    }

    if (source.request_type === "Petty Cash") {
      const description = `${source.request_type} - ${source.form_number || source.item_name}`;
      const { data: existingVoucher } = await supabase
        .from("vouchers")
        .select("id")
        .eq("project_id", source.project_id)
        .eq("description", description.substring(0, 200))
        .maybeSingle();

      if (!existingVoucher) {
        await supabase.from("vouchers").insert({
          voucher_number: createVoucherNumber(),
          date: source.request_date,
          type: "payment",
          payee: request.requestedBy || "TBD",
          amount: Number(source.amount || 0),
          description: description.substring(0, 200),
          project_id: source.project_id,
          status: "approved",
        });
      }
    }

    return;
  }

  if (request.sourceTable === "cash_advance_requests") {
    const { data: source } = await supabase
      .from("cash_advance_requests")
      .select("id, form_number, request_date, amount, project_id")
      .eq("id", request.sourceRecordId)
      .maybeSingle();

    if (!source) {
      return;
    }

    const description = `Cash Advance - ${source.form_number || request.sourceRecordId}`;
    const { data: existingVoucher } = await supabase
      .from("vouchers")
      .select("id")
      .eq("project_id", source.project_id)
      .eq("description", description.substring(0, 200))
      .maybeSingle();

    if (!existingVoucher) {
      await supabase.from("vouchers").insert({
        voucher_number: createVoucherNumber(),
        date: source.request_date,
        type: "payment",
        payee: request.requestedBy || "TBD",
        amount: Number(source.amount || 0),
        description: description.substring(0, 200),
        project_id: source.project_id,
        status: "approved",
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

    if (error) {
      throw error;
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

    if (error) {
      throw error;
    }

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

    if (error) {
      throw error;
    }

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

    if (!authData.user) {
      throw new Error("Unauthorized");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", authData.user.id)
      .maybeSingle();

    const actorName = profile?.full_name || profile?.email || authData.user.email || "User";

    const { data: request, error: requestError } = await supabase
      .from("approval_requests")
      .select("id, source_module, source_table, source_record_id, request_type, requested_by, project_id, summary, payload, target_module")
      .eq("id", approvalRequestId)
      .single();

    if (requestError || !request) {
      throw requestError || new Error("Approval request not found");
    }

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

    if (updateError) {
      throw updateError;
    }

    const { error: actionError } = await supabase.from("approval_actions").insert({
      approval_request_id: approvalRequestId,
      actor_user_id: authData.user.id,
      actor_name: actorName,
      action_status: status,
      comments: comments || null,
    });

    if (actionError) {
      throw actionError;
    }

    await syncSourceRecord(request.source_table, request.source_record_id, status);

    if (status === "approved") {
      await processApprovedRequest({
        sourceTable: request.source_table,
        sourceRecordId: request.source_record_id,
        requestType: request.request_type,
        requestedBy: request.requested_by,
        projectId: request.project_id,
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
        message: request.summary
          ? `${request.summary} routed to ${targetModule}`
          : `${request.request_type} routed to ${targetModule}`,
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
  },

  async listModuleInbox(targetModule: string) {
    const workflowStates =
      targetModule === "Purchasing"
        ? ["in_purchasing", "completed"]
        : targetModule === "Accounting"
          ? ["in_accounting", "completed"]
          : ["approved", "completed"];

    const { data, error } = await supabase
      .from("approval_requests")
      .select("id, source_module, source_table, source_record_id, request_type, requested_by, requested_at, project_id, status, workflow_status, target_module, routed_at, processed_at, completed_at, summary, latest_comment, payload, projects(name)")
      .eq("target_module", targetModule)
      .in("workflow_status", workflowStates)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

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
      .select("id, source_module, request_type, summary, target_module")
      .eq("id", approvalRequestId)
      .single();

    if (requestError || !request) {
      throw requestError || new Error("Approval request not found");
    }

    const { error: updateError } = await supabase
      .from("approval_requests")
      .update({
        workflow_status: workflowStatus,
        processed_at: workflowStatus === "completed" ? timestamp : null,
        completed_at: workflowStatus === "completed" ? timestamp : null,
        updated_at: timestamp,
      })
      .eq("id", approvalRequestId);

    if (updateError) {
      throw updateError;
    }

    if (workflowStatus === "completed") {
      await notificationService.createNotification({
        approvalRequestId,
        audienceModule: request.source_module,
        targetSurface: request.source_module,
        eventType: "request_completed",
        title: `${request.request_type} completed`,
        message: request.summary
          ? `${request.target_module || "Destination module"} completed • ${request.summary}`
          : `${request.target_module || "Destination module"} completed this request`,
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

    if (requestError || !request) {
      throw requestError || new Error("Approval request not found");
    }

    if (request.status !== "approved") {
      throw new Error("Only approved requests can be archived to the GM Vault");
    }

    if (!isArchivableSourceTable(request.source_table)) {
      throw new Error("This approval type is not linked to the GM Vault archive");
    }

    const { error: archiveError } = await supabase
      .from(request.source_table)
      .update({ is_archived: true })
      .eq("id", request.source_record_id);

    if (archiveError) {
      throw archiveError;
    }
  },
};