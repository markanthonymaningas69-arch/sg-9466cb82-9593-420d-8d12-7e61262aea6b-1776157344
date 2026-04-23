import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  calculateRequiredDurationDays,
  createDefaultTaskConfiguration,
  normalizeTaskConfiguration,
  type TaskConfiguration,
} from "@/lib/scheduleTaskConfig";

type ProjectTaskRow = Database["public"]["Tables"]["project_tasks"]["Row"];
type ProjectTaskInsert = Database["public"]["Tables"]["project_tasks"]["Insert"];
type ProjectTaskUpdate = Database["public"]["Tables"]["project_tasks"]["Update"];
type BomScopeRow = Database["public"]["Tables"]["bom_scope_of_work"]["Row"];

export interface ProjectTaskScope
  extends Pick<
    BomScopeRow,
    "id" | "name" | "description" | "completion_percentage" | "quantity" | "unit" | "total_materials" | "total_labor"
  > {}

export interface ProjectTask extends ProjectTaskRow {
  bom_scope: ProjectTaskScope | null;
}

interface GenerateTasksResult {
  createdCount: number;
  updatedCount: number;
  syncedCount: number;
}

function toDateOnly(value: Date) {
  return value.toISOString().split("T")[0];
}

function addDays(dateValue: string, days: number) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + Math.max(days - 1, 0));
  return toDateOnly(date);
}

function getScopeDefaults(scope: ProjectTaskScope | null, assignedTeamName?: string | null) {
  return {
    quantity: scope?.quantity ?? 1,
    unit: scope?.unit ?? "lot",
    assignedTeamName: assignedTeamName ?? "",
  };
}

function buildTaskConfiguration(scope: ProjectTaskScope | null, rawConfig: unknown, assignedTeamName?: string | null) {
  const defaults = getScopeDefaults(scope, assignedTeamName);
  const hasConfig = rawConfig && typeof rawConfig === "object" && Object.keys(rawConfig as Record<string, unknown>).length > 0;

  if (!hasConfig) {
    return createDefaultTaskConfiguration(defaults);
  }

  return normalizeTaskConfiguration(rawConfig, defaults);
}

function calculateDurationAndEndDate(
  taskConfig: TaskConfiguration,
  startDate?: string | null,
  currentDuration?: number | null,
  currentEndDate?: string | null
) {
  if (!taskConfig.autoCalculateDuration) {
    return {
      durationDays: currentDuration ?? calculateRequiredDurationDays(taskConfig),
      endDate: currentEndDate ?? (startDate ? addDays(startDate, currentDuration ?? calculateRequiredDurationDays(taskConfig)) : null),
    };
  }

  const durationDays = calculateRequiredDurationDays(taskConfig);
  const endDate = startDate ? addDays(startDate, durationDays) : currentEndDate ?? null;

  return { durationDays, endDate };
}

async function getLatestBomId(projectId: string) {
  const { data, error } = await supabase
    .from("bill_of_materials")
    .select("id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data?.id) {
    throw new Error("No Bill of Materials found for this project. Please create a BOM first.");
  }

  return data.id;
}

async function getCurrentBomScopes(projectId: string) {
  const bomId = await getLatestBomId(projectId);

  const { data, error } = await supabase
    .from("bom_scope_of_work")
    .select("id, name, description, completion_percentage, quantity, unit, total_materials, total_labor, order_number")
    .eq("bom_id", bomId)
    .order("order_number", { ascending: true });

  if (error) {
    throw error;
  }

  if (!data || data.length === 0) {
    throw new Error("The current Bill of Materials has no scopes of work. Please add scopes to the BOM first.");
  }

  return data.map((scope) => ({
    id: scope.id,
    name: scope.name,
    description: scope.description,
    completion_percentage: scope.completion_percentage,
    quantity: scope.quantity,
    unit: scope.unit,
    total_materials: scope.total_materials,
    total_labor: scope.total_labor,
  })) as ProjectTaskScope[];
}

export const scheduleService = {
  async getTasksByProject(projectId: string) {
    const { data, error } = await supabase
      .from("project_tasks")
      .select(`
        *,
        bom_scope:bom_scope_id (
          id,
          name,
          description,
          completion_percentage,
          quantity,
          unit,
          total_materials,
          total_labor
        )
      `)
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true });

    if (error) {
      throw error;
    }

    return (data || []) as ProjectTask[];
  },

  async createTask(taskData: ProjectTaskInsert) {
    const { data: authData } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("project_tasks")
      .insert({
        ...taskData,
        created_by: taskData.created_by ?? authData.user?.id ?? null,
      })
      .select(`
        *,
        bom_scope:bom_scope_id (
          id,
          name,
          description,
          completion_percentage,
          quantity,
          unit,
          total_materials,
          total_labor
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    return data as ProjectTask;
  },

  async updateTask(taskId: string, updates: ProjectTaskUpdate) {
    const { data, error } = await supabase
      .from("project_tasks")
      .update(updates)
      .eq("id", taskId)
      .select(`
        *,
        bom_scope:bom_scope_id (
          id,
          name,
          description,
          completion_percentage,
          quantity,
          unit,
          total_materials,
          total_labor
        )
      `)
      .single();

    if (error) {
      throw error;
    }

    return data as ProjectTask;
  },

  async deleteTask(taskId: string) {
    const { error } = await supabase
      .from("project_tasks")
      .delete()
      .eq("id", taskId);

    if (error) {
      throw error;
    }

    return true;
  },

  async generateTasksFromBOM(projectId: string): Promise<GenerateTasksResult> {
    const scopes = await getCurrentBomScopes(projectId);

    const { data: existingTasks, error: tasksError } = await supabase
      .from("project_tasks")
      .select("id, bom_scope_id, start_date, end_date, duration_days, sort_order, assigned_team, task_config")
      .eq("project_id", projectId)
      .not("bom_scope_id", "is", null);

    if (tasksError) {
      throw tasksError;
    }

    const existingByScopeId = new Map(
      (existingTasks || [])
        .filter((task) => task.bom_scope_id)
        .map((task) => [task.bom_scope_id as string, task])
    );

    const { data: authData } = await supabase.auth.getUser();
    const today = toDateOnly(new Date());
    let fallbackStartDate = today;
    let createdCount = 0;
    let updatedCount = 0;

    for (const [index, scope] of scopes.entries()) {
      const existingTask = existingByScopeId.get(scope.id);
      const taskConfig = buildTaskConfiguration(scope, existingTask?.task_config, existingTask?.assigned_team);
      const startDate = existingTask?.start_date || fallbackStartDate;
      const { durationDays, endDate } = calculateDurationAndEndDate(
        taskConfig,
        startDate,
        existingTask?.duration_days,
        existingTask?.end_date
      );

      const payload: ProjectTaskUpdate = {
        bom_scope_id: scope.id,
        name: scope.name,
        description: scope.description || `Generated from BOM scope: ${scope.name}`,
        start_date: startDate,
        end_date: endDate || startDate,
        duration_days: durationDays,
        sort_order: index,
        task_config: taskConfig,
        assigned_team: taskConfig.assignedTeamName || existingTask?.assigned_team || null,
      };

      if (existingTask?.id) {
        const { error } = await supabase
          .from("project_tasks")
          .update(payload)
          .eq("id", existingTask.id);

        if (error) {
          throw error;
        }

        updatedCount += 1;
      } else {
        const insertPayload: ProjectTaskInsert = {
          project_id: projectId,
          bom_scope_id: scope.id,
          parent_id: null,
          name: scope.name,
          description: scope.description || `Generated from BOM scope: ${scope.name}`,
          start_date: startDate,
          end_date: endDate || startDate,
          duration_days: durationDays,
          progress: Number(scope.completion_percentage || 0),
          dependencies: [],
          assigned_team: taskConfig.assignedTeamName || null,
          priority: "medium",
          constraint_type: "ASAP",
          status: "pending",
          sort_order: index,
          created_by: authData.user?.id ?? null,
          task_config: taskConfig,
        };

        const { error } = await supabase
          .from("project_tasks")
          .insert(insertPayload);

        if (error) {
          throw error;
        }

        createdCount += 1;
      }

      fallbackStartDate = addDays(startDate, durationDays);
    }

    return {
      createdCount,
      updatedCount,
      syncedCount: scopes.length,
    };
  },
};