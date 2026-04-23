import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type MasterTeamTemplateRow = Database["public"]["Tables"]["master_team_templates"]["Row"];
type MasterTeamTemplateInsert = Database["public"]["Tables"]["master_team_templates"]["Insert"];
type MasterTeamTemplateUpdate = Database["public"]["Tables"]["master_team_templates"]["Update"];

export interface MasterTeamTemplateRole {
  id: string;
  role: string;
  quantity: number;
}

export interface MasterTeamTemplate {
  id: string;
  name: string;
  roles: MasterTeamTemplateRole[];
  created_at: string | null;
  updated_at: string | null;
}

function slugifyRole(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function normalizeRoles(value: unknown): MasterTeamTemplateRole[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const typedItem = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
      const role = String(typedItem.role || "").trim();

      if (!role) {
        return null;
      }

      const quantity = Math.max(1, Math.round(Number(typedItem.quantity || 1)));

      return {
        id: String(typedItem.id || `${slugifyRole(role) || "role"}-${index + 1}`),
        role,
        quantity,
      };
    })
    .filter((item): item is MasterTeamTemplateRole => Boolean(item));
}

function normalizeTemplate(row: MasterTeamTemplateRow): MasterTeamTemplate {
  return {
    id: row.id,
    name: row.name,
    roles: normalizeRoles(row.roles),
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export const masterCatalogService = {
  async getTeamTemplates() {
    const { data, error } = await supabase
      .from("master_team_templates")
      .select("id, name, roles, created_at, updated_at")
      .order("name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => normalizeTemplate(row as MasterTeamTemplateRow));
  },

  async createTeamTemplate(input: { name: string; roles: MasterTeamTemplateRole[] }) {
    const payload: MasterTeamTemplateInsert = {
      name: input.name.trim(),
      roles: input.roles.map((role) => ({
        id: role.id,
        role: role.role,
        quantity: role.quantity,
      })),
    };

    const { data, error } = await supabase
      .from("master_team_templates")
      .insert(payload)
      .select("id, name, roles, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeTemplate(data as MasterTeamTemplateRow);
  },

  async updateTeamTemplate(id: string, input: { name: string; roles: MasterTeamTemplateRole[] }) {
    const payload: MasterTeamTemplateUpdate = {
      name: input.name.trim(),
      roles: input.roles.map((role) => ({
        id: role.id,
        role: role.role,
        quantity: role.quantity,
      })),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("master_team_templates")
      .update(payload)
      .eq("id", id)
      .select("id, name, roles, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeTemplate(data as MasterTeamTemplateRow);
  },

  async deleteTeamTemplate(id: string) {
    const { error } = await supabase.from("master_team_templates").delete().eq("id", id);

    if (error) {
      throw error;
    }

    return true;
  },
};