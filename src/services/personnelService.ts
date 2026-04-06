import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];
type PersonnelInsert = Database["public"]["Tables"]["personnel"]["Insert"];

export const personnelService = {
  async getAll() {
    const { data, error } = await supabase
      .from("personnel")
      .select("*, projects(name)")
      .order("created_at", { ascending: false });
    
    console.log("Personnel query:", { data, error });
    return { data: data || [], error };
  },

  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from("personnel")
      .select("*")
      .eq("project_id", projectId);
    
    console.log("Personnel by project:", { data, error });
    return { data: data || [], error };
  },

  async create(personnel: PersonnelInsert) {
    const { data, error } = await supabase
      .from("personnel")
      .insert(personnel)
      .select()
      .single();
    
    console.log("Create personnel:", { data, error });
    return { data, error };
  },

  async update(id: string, updates: Partial<PersonnelInsert>) {
    const { data, error } = await supabase
      .from("personnel")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    console.log("Update personnel:", { data, error });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("personnel")
      .delete()
      .eq("id", id);
    
    console.log("Delete personnel:", { error });
    return { error };
  }
};