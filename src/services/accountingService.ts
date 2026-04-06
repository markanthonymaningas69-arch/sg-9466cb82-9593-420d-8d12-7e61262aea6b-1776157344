import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
type TransactionInsert = Database["public"]["Tables"]["transactions"]["Insert"];

export const accountingService = {
  async getAll() {
    const { data, error } = await supabase
      .from("transactions")
      .select("*, projects(name)")
      .order("date", { ascending: false });
    
    console.log("Transactions query:", { data, error });
    return { data: data || [], error };
  },

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
    
    console.log("Update transaction:", { data, error });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", id);
    
    console.log("Delete transaction:", { error });
    return { error };
  },

  async getSummary(projectId?: string) {
    let query = supabase
      .from("transactions")
      .select("type, amount, status");
    
    if (projectId) {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    
    if (error) return { data: null, error };

    const summary = {
      totalIncome: data.filter(t => t.type === "income").reduce((sum, t) => sum + t.amount, 0),
      totalExpense: data.filter(t => t.type === "expense").reduce((sum, t) => sum + t.amount, 0),
      pending: data.filter(t => t.status === "pending").reduce((sum, t) => sum + t.amount, 0),
      completed: data.filter(t => t.status === "completed").reduce((sum, t) => sum + t.amount, 0),
    };

    return { data: summary, error: null };
  }
};