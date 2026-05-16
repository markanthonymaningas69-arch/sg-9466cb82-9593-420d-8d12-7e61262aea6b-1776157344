import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type BomMaterial = Database["public"]["Tables"]["bom_materials"]["Row"];

export interface TaskMaterialAssignment {
  id: string;
  taskId: string;
  materialId: string;
  materialName: string;
  unit: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
}

export const taskMaterialService = {
  async getBomMaterialsByProject(projectId: string): Promise<BomMaterial[]> {
    const { data, error } = await supabase
      .from("bom_materials")
      .select(`
        *,
        bom_scope_of_work!inner(
          bom_id,
          bill_of_materials!inner(project_id)
        )
      `)
      .eq("bom_scope_of_work.bill_of_materials.project_id", projectId)
      .order("material_name");

    if (error) {
      console.error("Error fetching BOM materials:", error);
      throw error;
    }

    return data || [];
  },

  async getTaskMaterials(taskId: string): Promise<TaskMaterialAssignment[]> {
    // For now, return empty array - will be stored in task_config JSON
    // In future, could create a dedicated table
    return [];
  },

  calculateMaterialTotal(quantity: number, unitCost: number): number {
    return Number((quantity * unitCost).toFixed(2));
  },

  calculateTotalMaterialCost(materials: TaskMaterialAssignment[]): number {
    return materials.reduce((sum, material) => sum + material.totalCost, 0);
  },
};