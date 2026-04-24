import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type ApprovalStatus = "pending" | "approved" | "rejected" | "returned_for_revision";

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
  summary: string | null;
  latestComment: string | null;
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
  payload?: Json | null;
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
  }
}

function createVoucherNumber() {
  return `PV-${Math.floor(10000 + Math.random() * 90000)}`;
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

    return data;
  },

  async listRequests() {
    const { data, error } = await supabase
      .from("approval_requests")
      .select("id, source_module, source_table, source_record_id, request_type, requested_by, requested_at, project_id, status, summary, latest_comment, projects(name)")
      .order("requested_at", { ascending: false });

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
      summary: item.summary,
      latestComment: item.latest_comment,
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
      .select("id, source_table, source_record_id, request_type, requested_by, project_id")
      .eq("id", approvalRequestId)
      .single();

    if (requestError || !request) {
      throw requestError || new Error("Approval request not found");
    }

    const timestamp = new Date().toISOString();

    const { error: updateError } = await supabase
      .from("approval_requests")
      .update({
        status,
        latest_comment: comments || null,
        reviewed_by: authData.user.id,
        reviewed_at: timestamp,
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
  },
};