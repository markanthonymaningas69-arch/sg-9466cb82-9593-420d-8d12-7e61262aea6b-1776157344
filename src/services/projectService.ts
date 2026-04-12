import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cacheManager, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

type Project = Database["public"]["Tables"]["projects"]["Row"];
type ProjectInsert = Database["public"]["Tables"]["projects"]["Insert"];

export const projectService = {
  async getAll() {
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .order("created_at", { ascending: false });
    
    console.log("Projects query:", { data, error });
    if (error) console.error("Error:", error);
    return { data: data || [], error };
  },

  async getById(id: string) {
    const cacheKey = CACHE_KEYS.projectSummary(id);
    const cached = cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    
    console.log("Project by ID:", { data, error });
    const result = { data, error };
    if (!error) cacheManager.set(cacheKey, result, CACHE_TTL.DASHBOARD);
    return result;
  },

  async create(project: ProjectInsert) {
    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select()
      .single();
    
    // Auto-invalidate dashboard caches
    cacheManager.invalidatePattern("CompanyDashboard");
    
    console.log("Create project:", { data, error });
    return { data, error };
  },

  async update(id: string, updates: Partial<ProjectInsert>) {
    const { data, error } = await supabase
      .from("projects")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    // Auto-invalidate specific project and general dashboards
    cacheManager.invalidate(CACHE_KEYS.projectSummary(id));
    cacheManager.invalidatePattern("CompanyDashboard");
    
    console.log("Update project:", { data, error });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);
    
    // Auto-invalidate caches
    cacheManager.invalidate(CACHE_KEYS.projectSummary(id));
    cacheManager.invalidatePattern("CompanyDashboard");
    
    console.log("Delete project:", { error });
    return { error };
  },

  async getMasterItems() {
    const { data, error } = await supabase.from("master_items").select("*").order("name");
    return { data: data || [], error };
  },

  async createMasterItem(item: any) {
    const { data, error } = await supabase.from("master_items").insert(item).select().single();
    return { data, error };
  },

  async updateMasterItem(id: string, updates: any) {
    const { data, error } = await supabase.from("master_items").update(updates).eq("id", id).select().single();
    return { data, error };
  },

  async deleteMasterItem(id: string) {
    const { error } = await supabase.from("master_items").delete().eq("id", id);
    return { error };
  },

  async getMasterScopes() {
    const { data, error } = await supabase.from("master_scopes").select("*").order("name");
    return { data: data || [], error };
  },

  async createMasterScope(scope: any) {
    const { data, error } = await supabase.from("master_scopes").insert(scope).select().single();
    return { data, error };
  },

  async updateMasterScope(id: string, updates: any) {
    const { data, error } = await supabase.from("master_scopes").update(updates).eq("id", id).select().single();
    return { data, error };
  },

  async deleteMasterScope(id: string) {
    const { error } = await supabase.from("master_scopes").delete().eq("id", id);
    return { error };
  },

  async getStats() {
    const cacheKey = CACHE_KEYS.companyDashboard("default");
    const cached = cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from("projects")
      .select("status, budget, spent");
    
    if (error) return { data: null, error };

    const stats = {
      total: data.length,
      active: data.filter(p => p.status === "active").length,
      completed: data.filter(p => p.status === "completed").length,
      totalBudget: data.reduce((sum, p) => sum + (p.budget || 0), 0),
      totalCost: data.reduce((sum, p) => sum + (p.spent || 0), 0),
    };

    const result = { data: stats, error: null };
    cacheManager.set(cacheKey, result, CACHE_TTL.DASHBOARD);
    
    return result;
  }
};