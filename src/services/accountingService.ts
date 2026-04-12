import { supabase } from "@/integrations/supabase/client";

export const accountingService = {
  // === Journal & OpEx (accounting_transactions) ===
  async getJournalEntries(projectId?: string) {
    let query = supabase
      .from("accounting_transactions")
      .select("*, projects(name)")
      .order("date", { ascending: false });
      
    if (projectId) {
      if (projectId === "office") {
        query = query.is("project_id", null);
      } else {
        query = query.eq("project_id", projectId);
      }
    }
    
    const { data, error } = await query;
    return { data: data || [], error };
  },

  async createJournalEntry(entry: any) {
    const { data, error } = await supabase
      .from("accounting_transactions")
      .insert(entry)
      .select()
      .single();
    return { data, error };
  },

  async getDashboardSummary() {
    const { data, error } = await supabase
      .from("accounting_transactions")
      .select("type, amount, tax_amount");
      
    if (error) return { data: null, error };
    
    let totalDebits = 0;
    let totalCredits = 0;
    let totalTax = 0;
    
    data.forEach(d => {
      if (d.type === 'debit') totalDebits += Number(d.amount);
      if (d.type === 'credit') totalCredits += Number(d.amount);
      totalTax += Number(d.tax_amount || 0);
    });
    
    return { 
      data: { 
        totalDebits, 
        totalCredits, 
        totalTax, 
        balance: totalDebits - totalCredits 
      }, 
      error: null 
    };
  },

  // === Vouchers ===
  async getVouchers() {
    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .order("date", { ascending: false });
    return { data: data || [], error };
  },

  async createVoucher(voucher: any) {
    const { data, error } = await supabase
      .from("vouchers")
      .insert(voucher)
      .select()
      .single();
    return { data, error };
  },

  // === Liquidations ===
  async getLiquidations() {
    const { data, error } = await supabase
      .from("liquidations")
      .select("*")
      .order("date", { ascending: false });
    return { data: data || [], error };
  },

  async createLiquidation(liquidation: any) {
    const { data, error } = await supabase
      .from("liquidations")
      .insert(liquidation)
      .select()
      .single();
    return { data, error };
  },

  // === Payroll Integration (Site Attendance) ===
  async getPayrollSummary(period: 'daily' | 'weekly' | 'monthly', projectId?: string) {
    let query = supabase
      .from("site_attendance")
      .select("date, hours_worked, overtime_hours, personnel(name, daily_rate, overtime_rate), projects(name)")
      .eq("status", "present");
      
    if (projectId && projectId !== "all") {
      query = query.eq("project_id", projectId);
    }
    
    const { data, error } = await query;
    return { data: data || [], error };
  },

  // Legacy support for older analytics/index dashboards
  async getSummary(projectId?: string) {
    // Calculate simple mock summary to keep dashboards running until they are fully migrated
    return {
      data: {
        totalIncome: 0,
        totalExpense: 0,
        pending: 0,
        completed: 0
      },
      error: null
    };
  }
};