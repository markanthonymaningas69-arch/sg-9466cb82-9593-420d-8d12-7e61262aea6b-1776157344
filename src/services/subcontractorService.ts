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

    const insertData = {
      project_id: data.project_id!,
      name: data.name!,
      scope_of_work: data.scope_of_work!,
      contract_amount: data.contract_amount!,
      start_date: data.start_date || null,
      end_date: data.end_date || null,
      status: data.status || "active",
      contact_person: data.contact_person || null,
      contact_email: data.contact_email || null,
      contact_phone: data.contact_phone || null,
      payment_terms: data.payment_terms || null,
      notes: data.notes || null,
      created_by: userData.user?.id || null,
    };

    return supabase.from("subcontractors").insert(insertData);
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

    const insertData = {
      subcontractor_id: data.subcontractor_id!,
      project_id: data.project_id!,
      payment_number: data.payment_number!,
      amount: data.amount!,
      accomplishment_percent: data.accomplishment_percent || 0,
      payment_date: data.payment_date || null,
      status: data.status || "pending",
      description: data.description || null,
      retention_amount: data.retention_amount || 0,
      deductions: data.deductions || 0,
      net_amount: netAmount,
      notes: data.notes || null,
      voucher_id: data.voucher_id || null,
      created_by: userData.user?.id || null,
    };

    return supabase.from("subcontractor_payments").insert(insertData);
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
    const { data: bomScopes } = await supabase
      .from("bom_scope_of_work")
      .select(`
        id,
        name,
        completion_percentage,
        bom_id,
        bill_of_materials!inner(project_id)
      `)
      .eq("bill_of_materials.project_id", projectId)
      .ilike("name", `%${scopeOfWork}%`);

    if (!bomScopes || bomScopes.length === 0) {
      return { accomplishment_percent: 0, total_quantity: 0, completed_quantity: 0 };
    }

    const totalCompletion = bomScopes.reduce(
      (sum, scope) => sum + (Number(scope.completion_percentage) || 0),
      0
    );

    const avgCompletion = bomScopes.length > 0 ? totalCompletion / bomScopes.length : 0;

    return {
      accomplishment_percent: Math.min(avgCompletion, 100),
      total_quantity: bomScopes.length,
      completed_quantity: totalCompletion,
    };
  },
};