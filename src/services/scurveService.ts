import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import {
  buildDailySCurveSeries,
  buildSeriesFromStoredRows,
  calculateTaskPlannedCost,
  deriveSCurvePerformanceIndicators,
  type ActualCostEntry,
  type PlannedTaskCost,
  type SCurveStoredDailyValue,
  type TaskProgressSnapshot,
} from "@/lib/scurve";

type ProjectSCurveDailyRow = Database["public"]["Tables"]["project_scurve_daily"]["Row"];
type ProjectSCurveDailyInsert = Database["public"]["Tables"]["project_scurve_daily"]["Insert"];
type ProjectTaskRow = Database["public"]["Tables"]["project_tasks"]["Row"];
type TaskLaborCostRow = Database["public"]["Tables"]["task_labor_costs"]["Row"];
type TaskMaterialDeliveryPlanRow = Database["public"]["Tables"]["task_material_delivery_plans"]["Row"];
type BomMaterialRow = Database["public"]["Tables"]["bom_materials"]["Row"];
type SiteAttendanceRow = Database["public"]["Tables"]["site_attendance"]["Row"];
type PersonnelRow = Database["public"]["Tables"]["personnel"]["Row"];
type MaterialConsumptionRow = Database["public"]["Tables"]["material_consumption"]["Row"];
type BomProgressUpdateRow = Database["public"]["Tables"]["bom_progress_updates"]["Row"];

function normalizeStoredRow(row: ProjectSCurveDailyRow): SCurveStoredDailyValue {
  return {
    date: row.date,
    plannedValue: Number(row.planned_value || 0),
    actualValue: Number(row.actual_value || 0),
    earnedValue: Number(row.earned_value || 0),
  };
}

async function loadTaskBaselines(projectId: string) {
  const { data: taskData, error: taskError } = await supabase
    .from("project_tasks")
    .select("id, project_id, bom_scope_id, start_date, end_date, duration_days, progress")
    .eq("project_id", projectId)
    .order("start_date", { ascending: true });

  if (taskError) {
    throw taskError;
  }

  const tasks = (taskData || []) as Pick<
    ProjectTaskRow,
    "id" | "project_id" | "bom_scope_id" | "start_date" | "end_date" | "duration_days" | "progress"
  >[];

  if (tasks.length === 0) {
    return { tasks: [] as PlannedTaskCost[], scopeProgressUpdates: [] as BomProgressUpdateRow[] };
  }

  const taskIds = tasks.map((task) => task.id);
  const scopeIds = Array.from(new Set(tasks.map((task) => task.bom_scope_id).filter((value): value is string => Boolean(value))));

  const [{ data: laborCostData, error: laborCostError }, { data: planData, error: planError }, { data: materialData, error: materialError }] =
    await Promise.all([
      supabase.from("task_labor_costs").select("task_id, total_cost").in("task_id", taskIds),
      supabase.from("task_material_delivery_plans").select("task_id, material_id, total_quantity").in("task_id", taskIds),
      scopeIds.length > 0
        ? supabase.from("bom_materials").select("id, scope_id, quantity, unit_cost, total_cost").in("scope_id", scopeIds)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (laborCostError) {
    throw laborCostError;
  }

  if (planError) {
    throw planError;
  }

  if (materialError) {
    throw materialError;
  }

  const { data: progressUpdateData, error: progressUpdateError } = scopeIds.length
    ? await supabase
        .from("bom_progress_updates")
        .select("bom_scope_id, percentage_completed, update_date")
        .in("bom_scope_id", scopeIds)
        .order("update_date", { ascending: true })
    : { data: [], error: null };

  if (progressUpdateError) {
    throw progressUpdateError;
  }

  const laborCostByTask = new Map(
    ((laborCostData || []) as Pick<TaskLaborCostRow, "task_id" | "total_cost">[]).map((row) => [
      row.task_id,
      Number(row.total_cost || 0),
    ] as const)
  );

  const materialPlansByTask = new Map<string, Pick<TaskMaterialDeliveryPlanRow, "material_id" | "total_quantity">[]>();
  ((planData || []) as Pick<TaskMaterialDeliveryPlanRow, "task_id" | "material_id" | "total_quantity">[]).forEach((row) => {
    const existingRows = materialPlansByTask.get(row.task_id) || [];
    existingRows.push(row);
    materialPlansByTask.set(row.task_id, existingRows);
  });

  const materialById = new Map(
    ((materialData || []) as Pick<BomMaterialRow, "id" | "scope_id" | "quantity" | "unit_cost" | "total_cost">[]).map((row) => [
      row.id,
      row,
    ] as const)
  );

  const scopeMaterialTotalByScope = new Map<string, number>();
  ((materialData || []) as Pick<BomMaterialRow, "scope_id" | "total_cost">[]).forEach((row) => {
    const currentValue = scopeMaterialTotalByScope.get(row.scope_id) || 0;
    scopeMaterialTotalByScope.set(row.scope_id, Number((currentValue + Number(row.total_cost || 0)).toFixed(2)));
  });

  const baselines: PlannedTaskCost[] = tasks.map((task) => {
    const materialPlans = materialPlansByTask.get(task.id) || [];
    const plannedMaterialCost =
      materialPlans.length > 0
        ? materialPlans.reduce((total, plan) => {
            const material = materialById.get(plan.material_id);
            if (!material) {
              return total;
            }

            const plannedQuantity = Number(plan.total_quantity || 0) > 0 ? Number(plan.total_quantity || 0) : Number(material.quantity || 0);
            return Number((total + plannedQuantity * Number(material.unit_cost || 0)).toFixed(2));
          }, 0)
        : Number(scopeMaterialTotalByScope.get(task.bom_scope_id || "") || 0);

    return {
      taskId: task.id,
      projectId,
      bomScopeId: task.bom_scope_id,
      startDate: task.start_date,
      endDate: task.end_date,
      durationDays: Math.max(1, Number(task.duration_days || 1)),
      plannedLaborCost: Number(laborCostByTask.get(task.id) || 0),
      plannedMaterialCost,
    };
  });

  return {
    tasks: baselines,
    scopeProgressUpdates: (progressUpdateData || []) as BomProgressUpdateRow[],
  };
}

async function loadActualLaborEntries(projectId: string) {
  const { data: attendanceData, error: attendanceError } = await supabase
    .from("site_attendance")
    .select("date, personnel_id, hours_worked, overtime_hours")
    .eq("project_id", projectId)
    .order("date", { ascending: true });

  if (attendanceError) {
    throw attendanceError;
  }

  const attendanceRows = (attendanceData || []) as Pick<SiteAttendanceRow, "date" | "personnel_id" | "hours_worked" | "overtime_hours">[];
  const personnelIds = Array.from(new Set(attendanceRows.map((row) => row.personnel_id)));

  const { data: personnelData, error: personnelError } = personnelIds.length
    ? await supabase.from("personnel").select("id, daily_rate, overtime_rate").in("id", personnelIds)
    : { data: [], error: null };

  if (personnelError) {
    throw personnelError;
  }

  const personnelById = new Map(
    ((personnelData || []) as Pick<PersonnelRow, "id" | "daily_rate" | "overtime_rate">[]).map((row) => [
      row.id,
      row,
    ] as const)
  );

  return attendanceRows.map<ActualCostEntry>((row) => {
    const personnel = personnelById.get(row.personnel_id);
    const hoursWorked = Number(row.hours_worked || 0);
    const overtimeHours = Number(row.overtime_hours || 0);
    const dailyRate = Number(personnel?.daily_rate || 0);
    const overtimeRate = Number(personnel?.overtime_rate || 0);
    const cost = (hoursWorked / 8) * dailyRate + overtimeHours * overtimeRate;

    return {
      date: row.date,
      cost: Number(cost.toFixed(2)),
    };
  });
}

async function loadActualMaterialEntries(projectId: string) {
  const { data, error } = await supabase
    .from("material_consumption")
    .select("date_used, quantity, estimated_cost")
    .eq("project_id", projectId)
    .order("date_used", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data || []) as Pick<MaterialConsumptionRow, "date_used" | "quantity" | "estimated_cost">[]).map<ActualCostEntry>((row) => ({
    date: row.date_used,
    cost: Number((Number(row.quantity || 0) * Number(row.estimated_cost || 0)).toFixed(2)),
  }));
}

function createTaskProgressSnapshots(tasks: PlannedTaskCost[], progressUpdates: BomProgressUpdateRow[]) {
  const updatesByScope = new Map<string, BomProgressUpdateRow[]>();

  progressUpdates.forEach((update) => {
    if (!update.bom_scope_id || !update.update_date) {
      return;
    }

    const existingUpdates = updatesByScope.get(update.bom_scope_id) || [];
    existingUpdates.push(update);
    updatesByScope.set(update.bom_scope_id, existingUpdates);
  });

  const snapshots: TaskProgressSnapshot[] = [];

  tasks.forEach((task) => {
    if (!task.bomScopeId) {
      return;
    }

    const scopeUpdates = updatesByScope.get(task.bomScopeId) || [];
    const plannedCost = calculateTaskPlannedCost(task);

    scopeUpdates.forEach((update) => {
      snapshots.push({
        taskId: task.taskId,
        date: update.update_date || task.endDate,
        progress: Number(update.percentage_completed || 0),
        plannedCost,
      });
    });
  });

  return snapshots;
}

export const scurveService = {
  async recalculateProject(projectId: string) {
    const [{ tasks, scopeProgressUpdates }, actualLaborEntries, actualMaterialEntries] = await Promise.all([
      loadTaskBaselines(projectId),
      loadActualLaborEntries(projectId),
      loadActualMaterialEntries(projectId),
    ]);

    const progressSnapshots = createTaskProgressSnapshots(tasks, scopeProgressUpdates);
    const series = buildDailySCurveSeries({
      plannedTasks: tasks,
      actualLaborEntries,
      actualMaterialEntries,
      progressSnapshots,
    });

    if (series.length === 0) {
      return [];
    }

    const payload: ProjectSCurveDailyInsert[] = series.map((entry) => ({
      project_id: projectId,
      date: entry.date,
      planned_value: entry.plannedValue,
      actual_value: entry.actualValue,
      earned_value: entry.earnedValue,
      updated_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from("project_scurve_daily")
      .upsert(payload, { onConflict: "project_id,date" })
      .select("*")
      .order("date", { ascending: true });

    if (error) {
      throw error;
    }

    return buildSeriesFromStoredRows((data || []).map((row) => normalizeStoredRow(row as ProjectSCurveDailyRow)));
  },

  async getProjectDailyAggregates(projectId: string) {
    const { data, error } = await supabase
      .from("project_scurve_daily")
      .select("*")
      .eq("project_id", projectId)
      .order("date", { ascending: true });

    if (error) {
      throw error;
    }

    return buildSeriesFromStoredRows((data || []).map((row) => normalizeStoredRow(row as ProjectSCurveDailyRow)));
  },

  async getProjectPerformance(projectId: string) {
    const series = await this.getProjectDailyAggregates(projectId);
    return deriveSCurvePerformanceIndicators(series);
  },
};