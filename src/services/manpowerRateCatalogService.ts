import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { scurveService } from "@/services/scurveService";

type ManpowerRateRow = Database["public"]["Tables"]["manpower_rate_catalog"]["Row"];
type ManpowerRateInsert = Database["public"]["Tables"]["manpower_rate_catalog"]["Insert"];
type ManpowerRateUpdate = Database["public"]["Tables"]["manpower_rate_catalog"]["Update"];
type ProjectTaskRow = Database["public"]["Tables"]["project_tasks"]["Row"];
type TaskLaborCostInsert = Database["public"]["Tables"]["task_labor_costs"]["Insert"];

export interface ManpowerRateCatalogItem {
  id: string;
  positionName: string;
  dailyRate: number;
  overtimeRate: number;
  createdAt: string;
  updatedAt: string;
}

interface TeamCompositionRole {
  role: string;
  count: number;
}

interface LaborRefreshResult {
  updatedTaskCount: number;
  recalculatedProjectCount: number;
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

function buildRoleKey(role: string) {
  return role.trim().toLowerCase();
}

function parseTeamComposition(value: unknown): TeamCompositionRole[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }

      const typed = entry as { role?: unknown; count?: unknown; quantity?: unknown };
      const role = typeof typed.role === "string" ? typed.role.trim() : "";
      if (!role) {
        return null;
      }

      const quantitySource = typeof typed.count === "number" || typeof typed.count === "string" ? typed.count : typed.quantity;

      return {
        role,
        count: Math.max(1, Math.round(Number(quantitySource || 1))),
      } satisfies TeamCompositionRole;
    })
    .filter((entry): entry is TeamCompositionRole => Boolean(entry));
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

  async recalculateProjectLaborCostsFromCatalog(): Promise<LaborRefreshResult> {
    const [{ data: rateData, error: rateError }, { data: taskData, error: taskError }] = await Promise.all([
      supabase.from("manpower_rate_catalog").select("position_name, daily_rate, overtime_rate"),
      supabase.from("project_tasks").select("id, project_id, duration_days, number_of_teams, team_composition"),
    ]);

    if (rateError) {
      throw rateError;
    }

    if (taskError) {
      throw taskError;
    }

    const rateMap = new Map(
      (rateData || []).map((rate) => [
        buildRoleKey(rate.position_name),
        {
          dailyRate: Number(rate.daily_rate || 0),
          overtimeRate: Number(rate.overtime_rate || 0),
        },
      ] as const)
    );

    const summaries = ((taskData || []) as Pick<
      ProjectTaskRow,
      "id" | "project_id" | "duration_days" | "number_of_teams" | "team_composition"
    >[])
      .filter((task) => Boolean(task.id) && Boolean(task.project_id))
      .map((task) => {
        const teamRoles = parseTeamComposition(task.team_composition);
        const numberOfTeams = Math.max(1, Number(task.number_of_teams || 1));
        const durationDays = Math.max(1, Number(task.duration_days || 1));
        const rateSnapshot = teamRoles.map((role) => {
          const matchedRate = rateMap.get(buildRoleKey(role.role));
          return {
            role: role.role,
            count: Math.max(1, Math.round(role.count)) * numberOfTeams,
            dailyRate: Number(matchedRate?.dailyRate || 0),
            overtimeRate: Number(matchedRate?.overtimeRate || 0),
          };
        });
        const dailyCost = rateSnapshot.reduce((total, item) => total + item.count * item.dailyRate, 0);

        return {
          taskId: task.id,
          projectId: task.project_id,
          durationDays,
          dailyCost: Number(dailyCost.toFixed(2)),
          totalCost: Number((dailyCost * durationDays).toFixed(2)),
          rateSnapshot,
        };
      });

    if (summaries.length === 0) {
      return {
        updatedTaskCount: 0,
        recalculatedProjectCount: 0,
      };
    }

    const payload: TaskLaborCostInsert[] = summaries.map((summary) => ({
      task_id: summary.taskId,
      daily_cost: summary.dailyCost,
      total_cost: summary.totalCost,
      duration_days: summary.durationDays,
      rate_snapshot: summary.rateSnapshot as TaskLaborCostInsert["rate_snapshot"],
      updated_at: new Date().toISOString(),
    }));

    const { error: upsertError } = await supabase.from("task_labor_costs").upsert(payload, { onConflict: "task_id" });

    if (upsertError) {
      throw upsertError;
    }

    const projectIds = Array.from(new Set(summaries.map((summary) => summary.projectId).filter(Boolean)));

    await Promise.allSettled(projectIds.map((projectId) => scurveService.recalculateProject(projectId)));

    return {
      updatedTaskCount: payload.length,
      recalculatedProjectCount: projectIds.length,
    };
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