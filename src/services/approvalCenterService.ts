import { supabase } from "@/integrations/supabase/client";

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

export const approvalCenterService = {
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
      .select("id, source_table, source_record_id")
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
  },
};