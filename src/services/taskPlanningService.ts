import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type DeliveryPlanRow = Database["public"]["Tables"]["task_material_delivery_plans"]["Row"];
type DeliveryPlanInsert = Database["public"]["Tables"]["task_material_delivery_plans"]["Insert"];
type LaborCostRow = Database["public"]["Tables"]["task_labor_costs"]["Row"];
type LaborCostInsert = Database["public"]["Tables"]["task_labor_costs"]["Insert"];

export interface PlannedUsagePeriod {
  startDate: string;
  endDate: string;
}

export interface TaskMaterialDeliveryPlan {
  id: string;
  taskId: string;
  materialId: string;
  materialName: string;
  deliveryScheduleType: "one_time" | "staggered";
  deliveryStartDate: string | null;
  deliveryFrequency: "daily" | "weekly" | "custom";
  deliveryDurationDays: number;
  customIntervalDays: number | null;
  quantityMode: "even";
  deliveryDates: string[];
  plannedUsagePeriod: PlannedUsagePeriod | null;
  totalQuantity: number;
  unit: string;
  createdAt: string;
  updatedAt: string;
}

export interface TaskLaborCostSummary {
  id: string;
  taskId: string;
  dailyCost: number;
  totalCost: number;
  durationDays: number;
  rateSnapshot: Array<{
    role: string;
    count: number;
    dailyRate: number;
    overtimeRate: number;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface SaveTaskMaterialDeliveryPlanInput {
  materialId: string;
  materialName: string;
  deliveryScheduleType: "one_time" | "staggered";
  deliveryStartDate: string | null;
  deliveryFrequency: "daily" | "weekly" | "custom";
  deliveryDurationDays: number;
  customIntervalDays?: number | null;
  quantityMode?: "even";
  deliveryDates: string[];
  plannedUsagePeriod?: PlannedUsagePeriod | null;
  totalQuantity: number;
  unit: string;
}

export interface SaveTaskLaborCostInput {
  taskId: string;
  dailyCost: number;
  totalCost: number;
  durationDays: number;
  rateSnapshot: Array<{
    role: string;
    count: number;
    dailyRate: number;
    overtimeRate: number;
  }>;
}

function normalizeDeliveryPlan(row: DeliveryPlanRow): TaskMaterialDeliveryPlan {
  const plannedUsage = row.planned_usage_period;
  const deliveryDates = Array.isArray(row.delivery_dates)
    ? row.delivery_dates.filter((value): value is string => typeof value === "string")
    : [];

  return {
    id: row.id,
    taskId: row.task_id,
    materialId: row.material_id,
    materialName: row.material_name,
    deliveryScheduleType: row.delivery_schedule_type as "one_time" | "staggered",
    deliveryStartDate: row.delivery_start_date,
    deliveryFrequency: row.delivery_frequency as "daily" | "weekly" | "custom",
    deliveryDurationDays: Number(row.delivery_duration_days || 1),
    customIntervalDays: row.custom_interval_days,
    quantityMode: row.quantity_mode as "even",
    deliveryDates,
    plannedUsagePeriod:
      plannedUsage && typeof plannedUsage === "object" && !Array.isArray(plannedUsage)
        ? {
            startDate: typeof plannedUsage.startDate === "string" ? plannedUsage.startDate : "",
            endDate: typeof plannedUsage.endDate === "string" ? plannedUsage.endDate : "",
          }
        : null,
    totalQuantity: Number(row.total_quantity || 0),
    unit: row.unit,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

function normalizeLaborCost(row: LaborCostRow): TaskLaborCostSummary {
  const rateSnapshot = Array.isArray(row.rate_snapshot)
    ? row.rate_snapshot
        .map((value) => {
          if (!value || typeof value !== "object") {
            return null;
          }

          const record = value as {
            role?: unknown;
            count?: unknown;
            dailyRate?: unknown;
            overtimeRate?: unknown;
          };

          return {
            role: typeof record.role === "string" ? record.role : "",
            count: Number(record.count || 0),
            dailyRate: Number(record.dailyRate || 0),
            overtimeRate: Number(record.overtimeRate || 0),
          };
        })
        .filter(
          (value): value is { role: string; count: number; dailyRate: number; overtimeRate: number } =>
            Boolean(value)
        )
    : [];

  return {
    id: row.id,
    taskId: row.task_id,
    dailyCost: Number(row.daily_cost || 0),
    totalCost: Number(row.total_cost || 0),
    durationDays: Number(row.duration_days || 1),
    rateSnapshot,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
  };
}

export const taskPlanningService = {
  async getMaterialDeliveryPlans(taskId: string) {
    const { data, error } = await supabase
      .from("task_material_delivery_plans")
      .select("*")
      .eq("task_id", taskId)
      .order("material_name", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []).map((row) => normalizeDeliveryPlan(row as DeliveryPlanRow));
  },

  async replaceMaterialDeliveryPlans(taskId: string, plans: SaveTaskMaterialDeliveryPlanInput[]) {
    const { error: deleteError } = await supabase
      .from("task_material_delivery_plans")
      .delete()
      .eq("task_id", taskId);

    if (deleteError) {
      throw deleteError;
    }

    if (plans.length === 0) {
      return [];
    }

    const payload: DeliveryPlanInsert[] = plans.map((plan) => ({
      task_id: taskId,
      material_id: plan.materialId,
      material_name: plan.materialName,
      delivery_schedule_type: plan.deliveryScheduleType,
      delivery_start_date: plan.deliveryStartDate,
      delivery_frequency: plan.deliveryFrequency,
      delivery_duration_days: Math.max(1, Math.round(Number(plan.deliveryDurationDays || 1))),
      custom_interval_days: plan.customIntervalDays ?? null,
      quantity_mode: plan.quantityMode || "even",
      delivery_dates: plan.deliveryDates,
      planned_usage_period: plan.plannedUsagePeriod
        ? {
            startDate: plan.plannedUsagePeriod.startDate,
            endDate: plan.plannedUsagePeriod.endDate,
          }
        : {},
      total_quantity: Number(plan.totalQuantity || 0),
      unit: plan.unit,
    }));

    const { data, error } = await supabase
      .from("task_material_delivery_plans")
      .insert(payload)
      .select("*");

    if (error) {
      throw error;
    }

    return (data || []).map((row) => normalizeDeliveryPlan(row as DeliveryPlanRow));
  },

  async getLaborCostSummary(taskId: string) {
    const { data, error } = await supabase
      .from("task_labor_costs")
      .select("*")
      .eq("task_id", taskId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data ? normalizeLaborCost(data as LaborCostRow) : null;
  },

  async upsertLaborCostSummary(input: SaveTaskLaborCostInput) {
    const payload: LaborCostInsert = {
      task_id: input.taskId,
      daily_cost: Number(input.dailyCost || 0),
      total_cost: Number(input.totalCost || 0),
      duration_days: Math.max(1, Math.round(Number(input.durationDays || 1))),
      rate_snapshot: input.rateSnapshot,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("task_labor_costs")
      .upsert(payload, { onConflict: "task_id" })
      .select("*")
      .single();

    if (error) {
      throw error;
    }

    return normalizeLaborCost(data as LaborCostRow);
  },
};