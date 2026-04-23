import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type ManpowerRateRow = Database["public"]["Tables"]["manpower_rate_catalog"]["Row"];
type ManpowerRateInsert = Database["public"]["Tables"]["manpower_rate_catalog"]["Insert"];
type ManpowerRateUpdate = Database["public"]["Tables"]["manpower_rate_catalog"]["Update"];

export interface ManpowerRateCatalogItem {
  id: string;
  positionName: string;
  dailyRate: number;
  overtimeRate: number;
  createdAt: string;
  updatedAt: string;
}

function normalizeRate(row: ManpowerRateRow): ManpowerRateCatalogItem {
  return {
    id: row.id,
    positionName: row.position_name,
    dailyRate: Number(row.daily_rate || 0),
    overtimeRate: Number(row.overtime_rate || 0),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

export const manpowerRateCatalogService = {
  async getAll() {
    const { data, error } = await supabase
      .from("manpower_rate_catalog")
      .select("id, position_name, daily_rate, overtime_rate, created_at, updated_at")
      .order("position_name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => normalizeRate(row as ManpowerRateRow));
  },

  async create(input: { positionName: string; dailyRate: number; overtimeRate: number }) {
    const payload: ManpowerRateInsert = {
      position_name: input.positionName.trim(),
      daily_rate: Number(input.dailyRate || 0),
      overtime_rate: Number(input.overtimeRate || 0),
    };

    const { data, error } = await supabase
      .from("manpower_rate_catalog")
      .insert(payload)
      .select("id, position_name, daily_rate, overtime_rate, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeRate(data as ManpowerRateRow);
  },

  async update(id: string, input: { positionName: string; dailyRate: number; overtimeRate: number }) {
    const payload: ManpowerRateUpdate = {
      position_name: input.positionName.trim(),
      daily_rate: Number(input.dailyRate || 0),
      overtime_rate: Number(input.overtimeRate || 0),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("manpower_rate_catalog")
      .update(payload)
      .eq("id", id)
      .select("id, position_name, daily_rate, overtime_rate, created_at, updated_at")
      .single();

    if (error) {
      throw error;
    }

    return normalizeRate(data as ManpowerRateRow);
  },

  async remove(id: string) {
    const { error } = await supabase.from("manpower_rate_catalog").delete().eq("id", id);

    if (error) {
      throw error;
    }

    return true;
  },

  async canManage() {
    const [{ data: authData }, { data: companyData, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("company_settings").select("user_id").maybeSingle(),
    ]);

    if (error) {
      throw error;
    }

    return Boolean(authData.user && companyData?.user_id === authData.user.id);
  },
};