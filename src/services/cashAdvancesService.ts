import { supabase } from "@/integrations/supabase/client";

export interface CashAdvance {
  id: string;
  personnel_id: string;
  project_id: string | null;
  amount: number;
  date: string;
  purpose: string | null;
  status: "active" | "fully_paid" | "cancelled";
  balance: number;
  notes: string | null;
  issued_by: string;
  created_at: string;
  updated_at: string;
  personnel?: {
    id: string;
    name: string;
    position: string;
  };
  project?: {
    id: string;
    name: string;
  };
}

export interface CashAdvanceDeduction {
  id: string;
  cash_advance_id: string;
  deduction_date: string;
  amount: number;
  deduction_source: string;
  notes: string | null;
  recorded_by: string;
  created_at: string;
}

export interface CashAdvanceWithDeductions extends CashAdvance {
  deductions: CashAdvanceDeduction[];
}

export const cashAdvancesService = {
  // Get all cash advances with personnel info
  async getAllCashAdvances(): Promise<CashAdvance[]> {
    const { data, error } = await supabase
      .from("cash_advances")
      .select(`
        *,
        personnel:personnel_id (
          id,
          name,
          position
        ),
        project:project_id (
          id,
          name
        )
      `)
      .order("date", { ascending: false });

    if (error) throw error;
    return data as CashAdvance[];
  },

  // Get cash advances by personnel
  async getCashAdvancesByPersonnel(personnelId: string): Promise<CashAdvanceWithDeductions[]> {
    const { data: advances, error: advancesError } = await supabase
      .from("cash_advances")
      .select(`
        *,
        personnel:personnel_id (
          id,
          name,
          position
        ),
        project:project_id (
          id,
          name
        )
      `)
      .eq("personnel_id", personnelId)
      .order("date", { ascending: false });

    if (advancesError) throw advancesError;

    // Get deductions for each advance
    const advancesWithDeductions = await Promise.all(
      (advances || []).map(async (advance) => {
        const { data: deductions, error: deductionsError } = await supabase
          .from("cash_advance_deductions")
          .select("*")
          .eq("cash_advance_id", advance.id)
          .order("deduction_date", { ascending: false });

        if (deductionsError) throw deductionsError;

        return {
          ...advance,
          deductions: deductions || [],
        } as CashAdvanceWithDeductions;
      })
    );

    return advancesWithDeductions;
  },

  // Create new cash advance
  async createCashAdvance(advance: {
    personnel_id: string;
    project_id?: string | null;
    amount: number;
    date: string;
    purpose?: string;
    notes?: string;
    issued_by: string;
  }): Promise<CashAdvance> {
    const { data, error } = await supabase
      .from("cash_advances")
      .insert({
        ...advance,
        balance: advance.amount, // Initial balance equals amount
      })
      .select(`
        *,
        personnel:personnel_id (
          id,
          name,
          position
        ),
        project:project_id (
          id,
          name
        )
      `)
      .single();

    if (error) throw error;
    return data as CashAdvance;
  },

  // Add deduction to cash advance
  async addDeduction(deduction: {
    cash_advance_id: string;
    amount: number;
    deduction_date: string;
    deduction_source?: string;
    notes?: string;
    recorded_by: string;
  }): Promise<CashAdvanceDeduction> {
    const { data, error } = await supabase
      .from("cash_advance_deductions")
      .insert({
        ...deduction,
        deduction_source: deduction.deduction_source || "manual",
      })
      .select()
      .single();

    if (error) throw error;
    return data as CashAdvanceDeduction;
  },

  // Update cash advance status
  async updateCashAdvanceStatus(
    advanceId: string,
    status: "active" | "fully_paid" | "cancelled"
  ): Promise<void> {
    const { error } = await supabase
      .from("cash_advances")
      .update({ status })
      .eq("id", advanceId);

    if (error) throw error;
  },

  // Delete cash advance deduction
  async deleteDeduction(deductionId: string): Promise<void> {
    const { error } = await supabase
      .from("cash_advance_deductions")
      .delete()
      .eq("id", deductionId);

    if (error) throw error;
  },

  // Get summary stats
  async getSummaryStats(): Promise<{
    totalActive: number;
    totalOutstanding: number;
    personnelWithAdvances: number;
  }> {
    const { data: advances, error } = await supabase
      .from("cash_advances")
      .select("balance, personnel_id")
      .eq("status", "active");

    if (error) throw error;

    const totalOutstanding = (advances || []).reduce((sum, adv) => sum + Number(adv.balance), 0);
    const uniquePersonnel = new Set((advances || []).map((adv) => adv.personnel_id));

    return {
      totalActive: advances?.length || 0,
      totalOutstanding,
      personnelWithAdvances: uniquePersonnel.size,
    };
  },
};