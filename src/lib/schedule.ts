import type { Json } from "@/integrations/supabase/database.types";
import type { Database } from "@/integrations/supabase/types";

type ProjectTaskRow = Database["public"]["Tables"]["project_tasks"]["Row"];
type ProjectTaskInsert = Database["public"]["Tables"]["project_tasks"]["Insert"];
type ScopeRow = Database["public"]["Tables"]["bom_scope_of_work"]["Row"];

export type DependencyType = "FS" | "SS" | "FF" | "SF";

export interface TaskRoleAllocation {
  id: string;
  role: string;
  count: number;
}

export interface TaskDependency {
  id: string;
  taskId: string;
  type: DependencyType;
  lagDays: number;
}

export interface TaskScopeSummary {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  completion_percentage: number | null;
  description?: string | null;
  total_materials?: number | null;
  total_labor?: number | null;
  materials?: string[];
}

export interface TaskFormData
  extends Omit<ProjectTaskRow, "dependencies" | "team_composition" | "resource_labor" | "equipment" | "cost_links"> {
  dependencies: TaskDependency[];
  team_composition: TaskRoleAllocation[];
  resource_labor: TaskRoleAllocation[];
  equipment: string[];
  cost_links: string[];
  bom_scope?: TaskScopeSummary | null;
}

export type ProjectTask = TaskFormData;

const DEFAULT_ROLE_ALLOCATION: TaskRoleAllocation[] = [
  { id: "mason", role: "Mason", count: 1 },
  { id: "helper", role: "Helper", count: 1 },
];

export function toNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

function parseRoleAllocations(value: unknown, fallback = DEFAULT_ROLE_ALLOCATION): TaskRoleAllocation[] {
  if (!Array.isArray(value) || value.length === 0) {
    return fallback.map((item) => ({ ...item }));
  }

  return value.map((item, index) => {
    const typed = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
    return {
      id: String(typed.id || `${String(typed.role || "role").toLowerCase()}-${index}`),
      role: String(typed.role || `Role ${index + 1}`),
      count: Math.max(0, Math.round(toNumber(typed.count, 0))),
    };
  });
}

function parseDependencies(value: unknown): TaskDependency[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item, index) => {
      const typed = typeof item === "object" && item !== null ? (item as Record<string, unknown>) : {};
      const taskId = String(typed.taskId || typed.id || "");
      if (!taskId) {
        return null;
      }

      return {
        id: String(typed.id || `dependency-${index}`),
        taskId,
        type: (typed.type === "SS" || typed.type === "FF" || typed.type === "SF" ? typed.type : "FS") as DependencyType,
        lagDays: Math.max(0, Math.round(toNumber(typed.lagDays, 0))),
      };
    })
    .filter((item): item is TaskDependency => Boolean(item));
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function serializeDependencies(value: TaskDependency[]): Json {
  return value.map((item) => ({
    id: item.id,
    taskId: item.taskId,
    type: item.type,
    lagDays: item.lagDays,
  })) as Json;
}

function serializeRoleAllocations(value: TaskRoleAllocation[]): Json {
  return value.map((item) => ({
    id: item.id,
    role: item.role,
    count: item.count,
  })) as Json;
}

function serializeStringArray(value: string[]): Json {
  return value.map((item) => item) as Json;
}

export function calculateDailyOutput(
  task: Pick<TaskFormData, "productivity_rate_per_day" | "productivity_rate_per_hour" | "working_hours_per_day">
) {
  const dailyOverride = toNumber(task.productivity_rate_per_day, 0);
  if (dailyOverride > 0) {
    return dailyOverride;
  }

  const hourlyRate = toNumber(task.productivity_rate_per_hour, 0);
  const workingHours = Math.max(1, toNumber(task.working_hours_per_day, 8));
  return hourlyRate > 0 ? hourlyRate * workingHours : 0;
}

export function calculateDurationDays(
  task: Pick<TaskFormData, "scope_quantity" | "productivity_rate_per_day" | "productivity_rate_per_hour" | "working_hours_per_day">
) {
  const quantity = Math.max(0, toNumber(task.scope_quantity, 0));
  const dailyOutput = calculateDailyOutput(task);
  if (quantity <= 0 || dailyOutput <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(quantity / dailyOutput));
}

export function calculateEndDate(startDate: string | null, durationDays: number | null) {
  const start = startDate || todayDate();
  const totalDays = Math.max(1, Math.round(toNumber(durationDays, 1)));
  const date = new Date(start);
  date.setDate(date.getDate() + totalDays - 1);
  return date.toISOString().split("T")[0];
}

export function syncTaskDerivedFields(task: TaskFormData, forceAuto = false): TaskFormData {
  const durationSource = forceAuto ? "auto" : task.duration_source || "auto";
  const normalizedTask: TaskFormData = {
    ...task,
    task_config: task.task_config ?? {},
    scope_quantity: Math.max(0, toNumber(task.scope_quantity, task.bom_scope?.quantity || 0)),
    scope_unit: task.scope_unit || task.bom_scope?.unit || "lot",
    productivity_rate_per_hour: Math.max(0, toNumber(task.productivity_rate_per_hour, 0)),
    productivity_rate_per_day: Math.max(0, toNumber(task.productivity_rate_per_day, 0)),
    working_hours_per_day: Math.max(1, toNumber(task.working_hours_per_day, 8)),
    team_composition: parseRoleAllocations(task.team_composition),
    resource_labor: parseRoleAllocations(task.resource_labor),
    equipment: parseStringArray(task.equipment),
    cost_links: parseStringArray(task.cost_links),
    dependencies: parseDependencies(task.dependencies),
    duration_source: durationSource,
    start_date: task.start_date || todayDate(),
    notes: task.notes || "",
  };

  const nextDuration =
    durationSource === "manual"
      ? Math.max(1, Math.round(toNumber(normalizedTask.duration_days, 1)))
      : calculateDurationDays(normalizedTask);

  return {
    ...normalizedTask,
    duration_days: nextDuration,
    end_date: calculateEndDate(normalizedTask.start_date, nextDuration),
  };
}

export function hydrateTask(
  task: ProjectTaskRow & {
    bom_scope?: (Partial<ScopeRow> & { bom_materials?: { material_name: string | null }[] | null }) | null;
  }
): TaskFormData {
  return syncTaskDerivedFields({
    ...task,
    task_config: task.task_config ?? {},
    scope_quantity: toNumber(task.scope_quantity, toNumber(task.bom_scope?.quantity, 1)),
    scope_unit: task.scope_unit || String(task.bom_scope?.unit || "lot"),
    productivity_rate_per_hour: toNumber(task.productivity_rate_per_hour, 0),
    productivity_rate_per_day: toNumber(task.productivity_rate_per_day, 0),
    working_hours_per_day: toNumber(task.working_hours_per_day, 8),
    dependencies: parseDependencies(task.dependencies),
    team_composition: parseRoleAllocations(task.team_composition),
    resource_labor: parseRoleAllocations(task.resource_labor),
    equipment: parseStringArray(task.equipment),
    cost_links: parseStringArray(task.cost_links),
    bom_scope: task.bom_scope
      ? {
          id: String(task.bom_scope.id || task.bom_scope_id || ""),
          name: String(task.bom_scope.name || task.name),
          quantity: toNumber(task.bom_scope.quantity, 1),
          unit: String(task.bom_scope.unit || "lot"),
          completion_percentage: task.bom_scope.completion_percentage ?? null,
          description: task.bom_scope.description ?? null,
          total_materials: task.bom_scope.total_materials ?? null,
          total_labor: task.bom_scope.total_labor ?? null,
          materials: Array.isArray(task.bom_scope.bom_materials)
            ? Array.from(
                new Set(
                  task.bom_scope.bom_materials
                    .map((material) => String(material.material_name || "").trim())
                    .filter(Boolean)
                )
              )
            : [],
        }
      : null,
  });
}

export function serializeTask(task: TaskFormData): ProjectTaskInsert {
  return {
    project_id: task.project_id,
    bom_scope_id: task.bom_scope_id,
    parent_id: task.parent_id,
    name: task.name,
    description: task.description,
    start_date: task.start_date || todayDate(),
    end_date: calculateEndDate(task.start_date, task.duration_days),
    duration_days: Math.max(1, Math.round(toNumber(task.duration_days, 1))),
    progress: Math.max(0, Math.min(100, toNumber(task.progress, 0))),
    dependencies: serializeDependencies(task.dependencies),
    assigned_team: task.assigned_team || null,
    priority: task.priority || "medium",
    constraint_type: task.constraint_type || "ASAP",
    status: task.status || "not_started",
    sort_order: Math.max(0, Math.round(toNumber(task.sort_order, 0))),
    scope_quantity: Math.max(0, toNumber(task.scope_quantity, 0)),
    scope_unit: task.scope_unit || "lot",
    productivity_rate_per_hour: Math.max(0, toNumber(task.productivity_rate_per_hour, 0)),
    productivity_rate_per_day: Math.max(0, toNumber(task.productivity_rate_per_day, 0)),
    working_hours_per_day: Math.max(1, toNumber(task.working_hours_per_day, 8)),
    team_composition: serializeRoleAllocations(task.team_composition),
    resource_labor: serializeRoleAllocations(task.resource_labor),
    equipment: serializeStringArray(task.equipment),
    cost_links: serializeStringArray(task.cost_links),
    duration_source: task.duration_source || "auto",
    notes: task.notes || null,
    task_config: task.task_config ?? {},
  };
}

export function createDraftTask(projectId: string): TaskFormData {
  return syncTaskDerivedFields({
    id: "",
    project_id: projectId,
    bom_scope_id: null,
    parent_id: null,
    name: "New Task",
    description: "",
    start_date: todayDate(),
    end_date: todayDate(),
    duration_days: 1,
    progress: 0,
    dependencies: [],
    assigned_team: "",
    priority: "medium",
    constraint_type: "ASAP",
    status: "not_started",
    sort_order: 0,
    created_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    scope_quantity: 1,
    scope_unit: "lot",
    productivity_rate_per_hour: 0,
    productivity_rate_per_day: 0,
    working_hours_per_day: 8,
    team_composition: DEFAULT_ROLE_ALLOCATION,
    resource_labor: DEFAULT_ROLE_ALLOCATION,
    equipment: [],
    cost_links: [],
    duration_source: "auto",
    notes: "",
    task_config: {},
    bom_scope: null,
  });
}