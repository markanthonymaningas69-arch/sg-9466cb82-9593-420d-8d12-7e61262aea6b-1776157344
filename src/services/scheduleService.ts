import { supabase } from "@/integrations/supabase/client";

export const scheduleService = {
  async getTasksByProject(projectId: string) {
    const { data, error } = await supabase
      .from("project_tasks")
      .select(`
        *,
        bom_scope:bom_scope_id (name, completion_percentage)
      `)
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });
    
    if (error) throw error;
    return data;
  },

  async createTask(taskData: any) {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        ...taskData,
        created_by: user?.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async updateTask(taskId: string, updates: any) {
    const { data, error } = await supabase
      .from("project_tasks")
      .update(updates)
      .eq("id", taskId)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  async deleteTask(taskId: string) {
    const { error } = await supabase
      .from("project_tasks")
      .delete()
      .eq("id", taskId);
    
    if (error) throw error;
    return true;
  },

  async generateTasksFromBOM(projectId: string) {
    // 1. Get BOM scopes for the project
    const { data: bomData, error: bomError } = await supabase
      .from("bill_of_materials")
      .select(`
        id,
        bom_scope_of_work (id, name, description)
      `)
      .eq("project_id", projectId)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1);

    if (bomError) throw bomError;
    if (!bomData || bomData.length === 0 || !bomData[0].bom_scope_of_work) {
      throw new Error("No approved BOM found for this project.");
    }

    const scopes = bomData[0].bom_scope_of_work;
    
    // 2. Check existing tasks to avoid duplicates
    const { data: existingTasks } = await supabase
      .from("project_tasks")
      .select("bom_scope_id")
      .eq("project_id", projectId);
      
    const existingScopeIds = new Set(existingTasks?.map(t => t.bom_scope_id).filter(Boolean));
    
    // 3. Create new tasks for scopes that don't have one
    const newTasks = scopes
      .filter((s: any) => !existingScopeIds.has(s.id))
      .map((s: any, index: number) => {
        const today = new Date();
        const endDate = new Date();
        endDate.setDate(today.getDate() + 7); // Default 1 week duration

        return {
          project_id: projectId,
          bom_scope_id: s.id,
          name: s.name,
          description: s.description || `Generated from BOM Scope: ${s.name}`,
          start_date: today.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0],
          duration_days: 7,
          progress: 0,
          status: 'pending',
          sort_order: existingScopeIds.size + index
        };
      });

    if (newTasks.length === 0) return [];

    const { data, error } = await supabase
      .from("project_tasks")
      .insert(newTasks)
      .select();

    if (error) throw error;
    return data;
  }
};