import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type ProjectManpowerCatalogRow = Database["public"]["Tables"]["project_manpower_catalog"]["Row"];
type ProjectManpowerCatalogInsert = Database["public"]["Tables"]["project_manpower_catalog"]["Insert"];
type ProjectManpowerCatalogUpdate = Database["public"]["Tables"]["project_manpower_catalog"]["Update"];

export type ProjectManpowerUnit = "day" | "hour";

export interface ProjectManpowerCatalogItem {
  id: string;
  projectId: string;
  positionName: string;
  standardRate: number;
  unit: ProjectManpowerUnit;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface SaveProjectManpowerCatalogInput {
  projectId: string;
  positionName: string;
  standardRate: number;
  unit: ProjectManpowerUnit;
  description?: string;
}

function normalizeUnit(value: string | null | undefined): ProjectManpowerUnit {
  return value === "hour" ? "hour" : "day";
}

function normalizeItem(row: ProjectManpowerCatalogRow): ProjectManpowerCatalogItem {
  return {
    id: row.id,
    projectId: row.project_id,
    positionName: row.position_name,
    standardRate: Number(row.standard_rate || 0),
    unit: normalizeUnit(row.unit),
    description: row.description || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function buildPayload(input: SaveProjectManpowerCatalogInput): ProjectManpowerCatalogInsert {
  return {
    project_id: input.projectId,
    position_name: input.positionName.trim(),
    standard_rate: Number(input.standardRate || 0),
    unit: input.unit,
    description: input.description?.trim() || null,
  };
}

export const projectManpowerCatalogService = {
  async listByProject(projectId: string) {
    const { data, error } = await supabase
      .from("project_manpower_catalog")
      .select("id, project_id, position_name, standard_rate, unit, description, created_at, updated_at")
      .eq("project_id", projectId)
      .order("position_name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => normalizeItem(row as ProjectManpowerCatalogRow));
  },

  async create(input: SaveProjectManpowerCatalogInput) {
    const { data, error } = await supabase
      .from("project_manpower_catalog")
      .insert(buildPayload(input))
      .select("id, project_id, position_name, standard_rate, unit, description, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeItem(data as ProjectManpowerCatalogRow);
  },

  async update(id: string, input: SaveProjectManpowerCatalogInput) {
    const payload: ProjectManpowerCatalogUpdate = {
      project_id: input.projectId,
      position_name: input.positionName.trim(),
      standard_rate: Number(input.standardRate || 0),
      unit: input.unit,
      description: input.description?.trim() || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("project_manpower_catalog")
      .update(payload)
      .eq("id", id)
      .select("id, project_id, position_name, standard_rate, unit, description, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeItem(data as ProjectManpowerCatalogRow);
  },

  async remove(id: string) {
    const { error } = await supabase.from("project_manpower_catalog").delete().eq("id", id);

    if (error) {
      throw error;
    }

    return true;
  },
};