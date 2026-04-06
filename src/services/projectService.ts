import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

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
    const { data, error } = await supabase
      .from("projects")
      .select("*")
      .eq("id", id)
      .single();
    
    console.log("Project by ID:", { data, error });
    return { data, error };
  },

  async create(project: ProjectInsert) {
    const { data, error } = await supabase
      .from("projects")
      .insert(project)
      .select()
      .single();
    
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
    
    console.log("Update project:", { data, error });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("projects")
      .delete()
      .eq("id", id);
    
    console.log("Delete project:", { error });
    return { error };
  },

  async getStats() {
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

    return { data: stats, error: null };
  }
};