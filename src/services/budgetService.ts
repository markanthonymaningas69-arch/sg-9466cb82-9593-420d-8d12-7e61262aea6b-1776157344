import { supabase } from "@/integrations/supabase/client";

export interface BudgetPlan {
  id: string;
  project_id: string | null;
  name: string;
  description: string | null;
  total_budget: number;
  start_date: string;
  end_date: string | null;
  status: string;
  company_id: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetCategory {
  id: string;
  budget_plan_id: string;
  category_name: string;
  allocated_amount: number;
  company_id: string;
  created_at: string;
  total_spent?: number;
  remaining?: number;
}

export interface BudgetExpense {
  id: string;
  budget_category_id: string;
  budget_plan_id: string;
  expense_date: string;
  description: string;
  amount: number;
  vendor: string | null;
  receipt_number: string | null;
  notes: string | null;
  company_id: string;
  created_at: string;
  category_name?: string;
}

export interface BudgetPlanWithDetails extends BudgetPlan {
  categories: BudgetCategory[];
  total_spent: number;
  total_remaining: number;
  utilization_percent: number;
  monthly_spent: number;
}

export async function createBudgetPlan(
  name: string,
  totalBudget: number,
  description: string | null,
  categories: { category_name: string; allocated_amount: number }[]
): Promise<BudgetPlanWithDetails> {
  const today = new Date().toISOString().split("T")[0];
  const { data: plan, error: planError } = await supabase
    .from("budget_plans")
    .insert({
      name,
      total_budget: totalBudget,
      start_date: today,
      end_date: null,
      description,
      project_id: null,
    })
    .select()
    .single();

  if (planError) throw planError;

  if (categories.length > 0) {
    const cats = categories.map((c) => ({
      budget_plan_id: plan.id,
      category_name: c.category_name,
      allocated_amount: c.allocated_amount,
    }));
    const { error: catError } = await supabase.from("budget_categories").insert(cats);
    if (catError) throw catError;
  }

  return getBudgetPlanById(plan.id);
}

export async function getBudgetPlans(): Promise<BudgetPlanWithDetails[]> {
  const { data: plans, error } = await supabase
    .from("budget_plans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  if (!plans) return [];

  const enriched = await Promise.all(plans.map((p) => getBudgetPlanById(p.id)));
  return enriched;
}

export async function getBudgetPlanById(id: string): Promise<BudgetPlanWithDetails> {
  const { data: plan, error: planError } = await supabase
    .from("budget_plans")
    .select("*")
    .eq("id", id)
    .single();

  if (planError) throw planError;

  const { data: categories, error: catError } = await supabase
    .from("budget_categories")
    .select("*")
    .eq("budget_plan_id", id)
    .order("created_at", { ascending: true });

  if (catError) throw catError;

  const { data: expenses, error: expError } = await supabase
    .from("budget_expenses")
    .select("*")
    .eq("budget_plan_id", id);

  if (expError) throw expError;

  const currentMonth = new Date().toISOString().slice(0, 7);

  const categoriesWithSpent = (categories || []).map((cat) => {
    const catExpenses = (expenses || []).filter((e) => e.budget_category_id === cat.id);
    const total_spent = catExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    return {
      ...cat,
      total_spent,
      remaining: Number(cat.allocated_amount) - total_spent,
    };
  });

  const total_spent = categoriesWithSpent.reduce((sum, c) => sum + c.total_spent, 0);
  const total_remaining = Number(plan.total_budget) - total_spent;
  const utilization_percent =
    Number(plan.total_budget) > 0 ? (total_spent / Number(plan.total_budget)) * 100 : 0;

  const monthly_spent = (expenses || [])
    .filter((e) => e.expense_date.startsWith(currentMonth))
    .reduce((sum, e) => sum + Number(e.amount), 0);

  return {
    ...plan,
    categories: categoriesWithSpent,
    total_spent,
    total_remaining,
    utilization_percent: Math.round(utilization_percent * 100) / 100,
    monthly_spent,
  };
}

export async function addBudgetCategory(
  budgetPlanId: string,
  categoryName: string,
  allocatedAmount: number
): Promise<BudgetCategory> {
  const { data, error } = await supabase
    .from("budget_categories")
    .insert({
      budget_plan_id: budgetPlanId,
      category_name: categoryName,
      allocated_amount: allocatedAmount,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function logExpense(
  budgetPlanId: string,
  budgetCategoryId: string,
  expenseDate: string,
  description: string,
  amount: number,
  vendor: string | null,
  receiptNumber: string | null,
  notes: string | null
): Promise<BudgetExpense> {
  const { data, error } = await supabase
    .from("budget_expenses")
    .insert({
      budget_plan_id: budgetPlanId,
      budget_category_id: budgetCategoryId,
      expense_date: expenseDate,
      description,
      amount,
      vendor,
      receipt_number: receiptNumber,
      notes,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBudgetExpenses(budgetPlanId?: string): Promise<BudgetExpense[]> {
  let query = supabase
    .from("budget_expenses")
    .select("*, budget_categories(category_name)")
    .order("expense_date", { ascending: false });

  if (budgetPlanId) query = query.eq("budget_plan_id", budgetPlanId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((row: any) => ({
    ...row,
    category_name: row.budget_categories?.category_name || "Unknown",
  }));
}

export async function deleteBudgetExpense(id: string): Promise<void> {
  const { error } = await supabase.from("budget_expenses").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteBudgetPlan(id: string): Promise<void> {
  const { error } = await supabase.from("budget_plans").delete().eq("id", id);
  if (error) throw error;
}

export async function updateBudgetPlanStatus(id: string, status: string): Promise<void> {
  const { error } = await supabase
    .from("budget_plans")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}