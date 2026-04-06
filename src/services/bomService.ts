import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BOM = Database["public"]["Tables"]["bill_of_materials"]["Row"];
type ScopeOfWork = Database["public"]["Tables"]["bom_scope_of_work"]["Row"];
type Material = Database["public"]["Tables"]["bom_materials"]["Row"];
type Labor = Database["public"]["Tables"]["bom_labor"]["Row"];
type IndirectCost = Database["public"]["Tables"]["bom_indirect_costs"]["Row"];

export const bomService = {
  // Get BOM with all related data
  async getByProjectId(projectId: string) {
    const { data, error } = await supabase
      .from("bill_of_materials")
      .select(`
        *,
        bom_scope_of_work!bom_scope_of_work_bom_id_fkey (
          *,
          bom_materials!bom_materials_scope_id_fkey (*),
          bom_labor!bom_labor_scope_id_fkey (*)
        ),
        bom_indirect_costs!bom_indirect_costs_bom_id_fkey (*)
      `)
      .eq("project_id", projectId)
      .single();

    console.log("BOM Query:", { data, error });
    return { data, error };
  },

  // Create BOM
  async create(bomData: Database["public"]["Tables"]["bill_of_materials"]["Insert"]) {
    const { data, error } = await supabase
      .from("bill_of_materials")
      .insert(bomData)
      .select()
      .single();

    console.log("Create BOM:", { data, error });
    return { data, error };
  },

  // Update BOM
  async update(id: string, bomData: Database["public"]["Tables"]["bill_of_materials"]["Update"]) {
    const { data, error } = await supabase
      .from("bill_of_materials")
      .update(bomData)
      .eq("id", id)
      .select()
      .single();

    console.log("Update BOM:", { data, error });
    return { data, error };
  },

  // Scope of Work operations
  async createScope(scopeData: Database["public"]["Tables"]["bom_scope_of_work"]["Insert"]) {
    const { data, error } = await supabase
      .from("bom_scope_of_work")
      .insert(scopeData)
      .select()
      .single();

    console.log("Create Scope:", { data, error });
    return { data, error };
  },

  async updateScope(id: string, scopeData: Database["public"]["Tables"]["bom_scope_of_work"]["Update"]) {
    const { data, error } = await supabase
      .from("bom_scope_of_work")
      .update(scopeData)
      .eq("id", id)
      .select()
      .single();

    return { data, error };
  },

  async deleteScope(id: string) {
    const { error } = await supabase
      .from("bom_scope_of_work")
      .delete()
      .eq("id", id);

    return { error };
  },

  // Material operations
  async createMaterial(materialData: Database["public"]["Tables"]["bom_materials"]["Insert"]) {
    const { data, error } = await supabase
      .from("bom_materials")
      .insert(materialData)
      .select()
      .single();

    return { data, error };
  },

  async updateMaterial(id: string, materialData: Database["public"]["Tables"]["bom_materials"]["Update"]) {
    const { data, error } = await supabase
      .from("bom_materials")
      .update(materialData)
      .eq("id", id)
      .select()
      .single();

    return { data, error };
  },

  async deleteMaterial(id: string) {
    const { error } = await supabase
      .from("bom_materials")
      .delete()
      .eq("id", id);

    return { error };
  },

  // Labor operations
  async createLabor(laborData: Database["public"]["Tables"]["bom_labor"]["Insert"]) {
    const { data, error } = await supabase
      .from("bom_labor")
      .insert(laborData)
      .select()
      .single();

    return { data, error };
  },

  async updateLabor(id: string, laborData: Database["public"]["Tables"]["bom_labor"]["Update"]) {
    const { data, error } = await supabase
      .from("bom_labor")
      .update(laborData)
      .eq("id", id)
      .select()
      .single();

    return { data, error };
  },

  async deleteLabor(id: string) {
    const { error } = await supabase
      .from("bom_labor")
      .delete()
      .eq("id", id);

    return { error };
  },

  // Indirect cost operations
  async createIndirectCost(costData: Database["public"]["Tables"]["bom_indirect_costs"]["Insert"]) {
    const { data, error } = await supabase
      .from("bom_indirect_costs")
      .insert(costData)
      .select()
      .single();

    return { data, error };
  },

  async updateIndirectCost(id: string, costData: Database["public"]["Tables"]["bom_indirect_costs"]["Update"]) {
    const { data, error } = await supabase
      .from("bom_indirect_costs")
      .update(costData)
      .eq("id", id)
      .select()
      .single();

    return { data, error };
  }
};