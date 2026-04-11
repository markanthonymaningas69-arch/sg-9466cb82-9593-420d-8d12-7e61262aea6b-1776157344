import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cacheManager, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export const accountingService = {
  // CRITICAL: Ledger and Transactions are NEVER cached to ensure financial integrity
  async getAll() {
    const { data, error } = await supabase
      .from("transactions")
      .select("*, projects(name)")
      .order("date", { ascending: false });
    
    console.log("Transactions query:", { data, error });
    return { data: data || [], error };
  },

  // CRITICAL: Ledger and Transactions are NEVER cached to ensure financial integrity
  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: false });
    
    console.log("Transactions by project:", { data, error });
    return { data: data || [], error };
  },

  async create(transaction: TransactionInsert) {
    const { data, error } = await supabase
      .from("transactions")
      .insert(transaction)
      .select()
      .single();
    
    // Invalidate dashboards and summaries because financials changed
    if (transaction.project_id) {
      cacheManager.invalidate(CACHE_KEYS.projectSummary(transaction.project_id));
      cacheManager.invalidatePattern(`FinancialSummary_${transaction.project_id}`);
    }
    cacheManager.invalidatePattern("CompanyDashboard");
    cacheManager.invalidatePattern("FinancialSummary_ALL");
    
    console.log("Create transaction:", { data, error });
    return { data, error };
  },

  async update(id: string, updates: Partial<TransactionInsert>) {
    const { data, error } = await supabase
      .from("transactions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    // Invalidate dashboards and summaries because financials changed
    cacheManager.invalidatePattern("CompanyDashboard");
    cacheManager.invalidatePattern("ProjectSummary");
    cacheManager.invalidatePattern("FinancialSummary");
    
    console.log("Update transaction:", { data, error });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    
    // Invalidate dashboards and summaries because financials changed
    cacheManager.invalidatePattern("CompanyDashboard");
    cacheManager.invalidatePattern("ProjectSummary");
    cacheManager.invalidatePattern("FinancialSummary");
    
    console.log("Delete transaction:", { error });
    return { error };
  },

  // Summaries are cached as they are aggregate reports
  async getSummary(projectId?: string) {
    const cacheKey = `FinancialSummary_${projectId || 'ALL'}`;
    const cached = cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    let query = supabase
      .from("transactions")
      .select("type, amount");
    
    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    
    if (error) return { data: null, error };

    const summary = {
      totalIncome: data.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
      totalExpense: data.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
      pending: 0,
      completed: data.reduce((sum, t) => sum + t.amount, 0),
    };

    const result = { data: summary, error: null };
    cacheManager.set(cacheKey, result, CACHE_TTL.REPORT); // 15 minute TTL for reports

    return result;
  }
};