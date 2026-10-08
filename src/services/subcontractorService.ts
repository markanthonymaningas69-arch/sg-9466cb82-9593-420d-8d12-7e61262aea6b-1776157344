import { supabase } from "@/integrations/supabase/client";

export interface Subcontractor {
  id: string;
  project_id: string;
  name: string;
  scope_of_work: string;
  contract_amount: number;
  start_date: string | null;
  end_date: string | null;
  status: "active" | "completed" | "suspended" | "cancelled";
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  payment_terms: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SubcontractorPayment {
  id: string;
  subcontractor_id: string;
  project_id: string;
  voucher_id: string | null;
  payment_number: number;
  amount: number;
  accomplishment_percent: number;
  payment_date: string | null;
  status: "pending" | "approved" | "paid" | "cancelled";
  description: string | null;
  retention_amount: number;
  deductions: number;
  net_amount: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface SubcontractorWithPayments extends Subcontractor {
  total_paid: number;
  balance: number;
  accomplishment_percent: number;
  payments: SubcontractorPayment[];
}

export const subcontractorService = {
  async listSubcontractors(projectId?: string) {
    let query = supabase
      .from("subcontractors")
      .select("*")
      .order("created_at", { ascending: false });

    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    return query;
  },

  async getSubcontractorWithPayments(subcontractorId: string) {
    const { data: subcontractor } = await supabase
      .from("subcontractors")
      .select("*")
      .eq("id", subcontractorId)
      .single();

    if (!subcontractor) return { data: null, error: null };

    const { data: payments } = await supabase
      .from("subcontractor_payments")
      .select("*")
      .eq("subcontractor_id", subcontractorId)
      .order("payment_number", { ascending: true });

    const totalPaid = (payments || [])
      .filter((p) => p.status === "paid")
      .reduce((sum, p) => sum + Number(p.amount), 0);

    const balance = Number(subcontractor.contract_amount) - totalPaid;

    const latestPayment = payments?.[payments.length - 1];
    const accomplishmentPercent = latestPayment?.accomplishment_percent || 0;

    return {
      data: {
        ...subcontractor,
        total_paid: totalPaid,
        balance,
        accomplishment_percent: accomplishmentPercent,
        payments: payments || [],
      } as SubcontractorWithPayments,
      error: null,
    };
  },

  async createSubcontractor(data: Partial<Subcontractor>) {
    const { data: userData } = await supabase.auth.getUser();

    return supabase.from("subcontractors").insert({
      ...data,
      created_by: userData.user?.id,
    });
  },

  async updateSubcontractor(id: string, data: Partial<Subcontractor>) {
    return supabase.from("subcontractors").update(data).eq("id", id);
  },

  async deleteSubcontractor(id: string) {
    return supabase.from("subcontractors").delete().eq("id", id);
  },

  async createPayment(data: Partial<SubcontractorPayment>) {
    const { data: userData } = await supabase.auth.getUser();

    const netAmount =
      Number(data.amount || 0) -
      Number(data.retention_amount || 0) -
      Number(data.deductions || 0);

    return supabase.from("subcontractor_payments").insert({
      ...data,
      net_amount: netAmount,
      created_by: userData.user?.id,
    });
  },

  async updatePayment(id: string, data: Partial<SubcontractorPayment>) {
    if (data.amount !== undefined || data.retention_amount !== undefined || data.deductions !== undefined) {
      const netAmount =
        Number(data.amount || 0) -
        Number(data.retention_amount || 0) -
        Number(data.deductions || 0);
      data.net_amount = netAmount;
    }

    return supabase.from("subcontractor_payments").update(data).eq("id", id);
  },

  async deletePayment(id: string) {
    return supabase.from("subcontractor_payments").delete().eq("id", id);
  },

  async getProgressFromSitePersonnel(projectId: string, scopeOfWork: string) {
    const { data: progressData } = await supabase
      .from("progress")
      .select("*")
      .eq("project_id", projectId)
      .ilike("task", `%${scopeOfWork}%`)
      .order("date", { ascending: false });

    if (!progressData || progressData.length === 0) {
      return { accomplishment_percent: 0, total_quantity: 0, completed_quantity: 0 };
    }

    const totalQuantity = progressData.reduce((sum, p) => sum + (Number(p.total_quantity) || 0), 0);
    const completedQuantity = progressData.reduce(
      (sum, p) => sum + (Number(p.quantity_this_period) || 0),
      0
    );

    const accomplishmentPercent = totalQuantity > 0 ? (completedQuantity / totalQuantity) * 100 : 0;

    return {
      accomplishment_percent: Math.min(accomplishmentPercent, 100),
      total_quantity: totalQuantity,
      completed_quantity: completedQuantity,
    };
  },
};