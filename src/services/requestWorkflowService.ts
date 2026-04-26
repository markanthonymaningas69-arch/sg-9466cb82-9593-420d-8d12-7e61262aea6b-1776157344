import { supabase } from "@/integrations/supabase/client";

export type ExecutionLifecycleStatus =
  | "pending_approval"
  | "approved"
  | "rejected"
  | "returned_for_revision"
  | "in_purchasing"
  | "in_accounting"
  | "voucher_pending_approval"
  | "voucher_approved"
  | "ready_for_delivery"
  | "received";

interface EnsureWorkflowInput {
  siteRequestId: string;
  approvalRequestId: string;
  projectId?: string | null;
  targetModule?: string | null;
  lifecycleStatus?: ExecutionLifecycleStatus;
  totalAmount?: number;
}

interface LinkPurchaseInput {
  siteRequestId: string;
  purchaseId: string;
  supplier?: string | null;
  totalAmount?: number;
}

interface LinkVoucherRequestInput {
  siteRequestId: string;
  voucherRequestId: string;
  supplier?: string | null;
  totalAmount?: number;
}

interface MarkVoucherApprovedInput {
  voucherRequestId: string;
  voucherId: string;
  voucherNumber: string;
}

interface MarkReceivedInput {
  siteRequestId: string;
  deliveryId?: string | null;
  receivedBy: string;
  actualQuantity?: number | null;
  remarks?: string | null;
}

export const requestWorkflowService = {
  async ensureSiteRequestWorkflow(input: EnsureWorkflowInput) {
    const { data, error } = await supabase
      .from("request_execution_tracking")
      .upsert(
        {
          site_request_id: input.siteRequestId,
          initial_approval_request_id: input.approvalRequestId,
          project_id: input.projectId || null,
          target_module: input.targetModule || null,
          lifecycle_status: input.lifecycleStatus || "pending_approval",
          total_amount: input.totalAmount || 0,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "site_request_id" }
      )
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  },

  async updateLifecycleBySiteRequest(siteRequestId: string, patch: Partial<{
    target_module: string | null;
    lifecycle_status: ExecutionLifecycleStatus;
    supplier: string | null;
    total_amount: number;
    voucher_number: string | null;
    remarks: string | null;
  }>) {
    const { data, error } = await supabase
      .from("request_execution_tracking")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("site_request_id", siteRequestId)
      .select("*")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  },

  async linkPurchaseRecord(input: LinkPurchaseInput) {
    return this.updateLifecycleBySiteRequest(input.siteRequestId, {
      lifecycle_status: "in_purchasing",
      supplier: input.supplier || null,
      total_amount: input.totalAmount || 0,
    }).then(async () => {
      const { error } = await supabase
        .from("request_execution_tracking")
        .update({
          purchase_id: input.purchaseId,
          updated_at: new Date().toISOString(),
        })
        .eq("site_request_id", input.siteRequestId);

      if (error) {
        throw error;
      }
    });
  },

  async linkVoucherRequest(input: LinkVoucherRequestInput) {
    const { error } = await supabase
      .from("request_execution_tracking")
      .update({
        voucher_request_id: input.voucherRequestId,
        supplier: input.supplier || null,
        total_amount: input.totalAmount || 0,
        lifecycle_status: "voucher_pending_approval",
        updated_at: new Date().toISOString(),
      })
      .eq("site_request_id", input.siteRequestId);

    if (error) {
      throw error;
    }
  },

  async markVoucherApproved(input: MarkVoucherApprovedInput) {
    const { error } = await supabase
      .from("request_execution_tracking")
      .update({
        voucher_request_id: input.voucherRequestId,
        voucher_id: input.voucherId,
        voucher_number: input.voucherNumber,
        lifecycle_status: "ready_for_delivery",
        updated_at: new Date().toISOString(),
      })
      .eq("voucher_request_id", input.voucherRequestId);

    if (error) {
      throw error;
    }
  },

  async markReceived(input: MarkReceivedInput) {
    const { error } = await supabase
      .from("request_execution_tracking")
      .update({
        delivery_id: input.deliveryId || null,
        received_by: input.receivedBy,
        received_at: new Date().toISOString(),
        actual_quantity: input.actualQuantity ?? null,
        remarks: input.remarks || null,
        lifecycle_status: "received",
        updated_at: new Date().toISOString(),
      })
      .eq("site_request_id", input.siteRequestId);

    if (error) {
      throw error;
    }
  },

  async getByPurchaseId(purchaseId: string) {
    const { data, error } = await supabase
      .from("request_execution_tracking")
      .select("*")
      .eq("purchase_id", purchaseId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  },

  async getReadyForReceiving(projectId: string) {
    const { data, error } = await supabase
      .from("request_execution_tracking")
      .select("*, site_requests(*), voucher_requests(*), purchases(*)")
      .eq("project_id", projectId)
      .eq("lifecycle_status", "ready_for_delivery")
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return data || [];
  },
};