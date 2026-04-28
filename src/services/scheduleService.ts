import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { calculateEndDate, hydrateTask, serializeTask, syncTaskDerivedFields, type TaskFormData } from "@/lib/schedule";

type SyncMode = "merge" | "resync";
type ProjectTaskInsert = Database["public"]["Tables"]["project_tasks"]["Insert"];
type ProjectTaskRow = Database["public"]["Tables"]["project_tasks"]["Row"];
type ScopeRow = Database["public"]["Tables"]["bom_scope_of_work"]["Row"];

type TaskWithScope = ProjectTaskRow & {
  bom_scope?: Partial<ScopeRow> | null;
};

type MaterialRow = {
  id: string;
  scope_id: string | null;
  material_name: string | null;
};

const taskSelect = `
  *,
  bom_scope:bom_scope_id (
    id,
    name,
    description,
    quantity,
    unit,
    completion_percentage,
    total_materials,
    total_labor
  )
`;

export type ProjectTask = TaskFormData;

function attachScopeMaterials(tasks: TaskWithScope[], materials: MaterialRow[]) {
  const materialsByScopeId = new Map<string, Array<{ id: string; material_name: string }>>();

  materials.forEach((material) => {
    if (!material.scope_id || !material.material_name) {
      return;
    }

    const materialName = material.material_name.trim();
    if (!materialName) {
      return;
    }

    const existing = materialsByScopeId.get(material.scope_id) || [];
    if (!existing.some((item) => item.id === material.id)) {
      existing.push({
        id: material.id,
        material_name: materialName,
      });
      materialsByScopeId.set(material.scope_id, existing);
    }
  });

  return tasks.map((task) => ({
    ...task,
    bom_scope: task.bom_scope
      ? {
          ...task.bom_scope,
          bom_materials: materialsByScopeId.get(task.bom_scope_id || "") || [],
        }
      : null,
  }));
}

async function fetchScopeMaterials(scopeIds: string[]) {
  if (scopeIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("bom_materials")
    .select("id, scope_id, material_name")
    .in("scope_id", scopeIds);

  if (error) {
    throw error;
  }

  return (data || []) as MaterialRow[];
}

async function fetchTasksWithMaterials(projectId?: string) {
  let query = supabase.from("project_tasks").select(taskSelect);

  if (projectId) {
    query = query.eq("project_id", projectId);
  }

  const { data, error } = await query.order("sort_order", { ascending: true });

  if (error) {
    throw error;
  }

  const tasks = (data || []) as TaskWithScope[];
  const scopeIds = Array.from(
    new Set(
      tasks
        .map((task) => task.bom_scope_id)
        .filter((scopeId): scopeId is string => typeof scopeId === "string" && scopeId.length > 0)
    )
  );
  const materials = await fetchScopeMaterials(scopeIds);

  return attachScopeMaterials(tasks, materials);
}

export const scheduleService = {
  async getTasksByProject(projectId: string) {
    const tasks = await fetchTasksWithMaterials(projectId);

    return tasks.map((task) => hydrateTask(task));
  },

  async createTask(taskData: TaskFormData) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const payload: ProjectTaskInsert = {
      ...serializeTask(syncTaskDerivedFields(taskData)),
      created_by: user?.id || null,
    };

    const { data, error } = await supabase.from("project_tasks").insert(payload).select(taskSelect).single();

    if (error) {
      throw error;
    }

    const scopeIds = data?.bom_scope_id ? [data.bom_scope_id] : [];
    const materials = await fetchScopeMaterials(scopeIds);
    return hydrateTask(attachScopeMaterials([data as TaskWithScope], materials)[0]);
  },

  async updateTask(taskId: string, taskData: TaskFormData) {
    const payload = serializeTask(syncTaskDerivedFields(taskData));
    const { data, error } = await supabase.from("project_tasks").update(payload).eq("id", taskId).select(taskSelect).single();

    if (error) {
      throw error;
    }

    const scopeIds = data?.bom_scope_id ? [data.bom_scope_id] : [];
    const materials = await fetchScopeMaterials(scopeIds);
    return hydrateTask(attachScopeMaterials([data as TaskWithScope], materials)[0]);
  },

  async deleteTask(taskId: string) {
    const { error } = await supabase.from("project_tasks").delete().eq("id", taskId);

    if (error) {
      throw error;
    }

    return true;
  },

  async generateTasksFromBOM(projectId: string, syncMode: SyncMode = "merge") {
    const { data: bomData, error: bomError } = await supabase
      .from("bill_of_materials")
      .select("id")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (bomError) {
      throw bomError;
    }

    if (!bomData?.id) {
      throw new Error("No Bill of Materials found for this project. Please create a BOM first.");
    }

    const { data: scopes, error: scopeError } = await supabase
      .from("bom_scope_of_work")
      .select("id, name, description, order_number, quantity, unit, completion_percentage, total_materials, total_labor")
      .eq("bom_id", bomData.id)
      .order("order_number", { ascending: true });

    if (scopeError) {
      throw scopeError;
    }

    if (!scopes || scopes.length === 0) {
      throw new Error("The current Bill of Materials has no scopes to generate.");
    }

    const existingTasks = await fetchTasksWithMaterials(projectId);

    const existingByScope = new Map(
      existingTasks
        .filter((task) => task.bom_scope_id)
        .map((task) => [String(task.bom_scope_id), hydrateTask(task)])
    );

    const inserts: ProjectTaskInsert[] = [];
    const updates = [];

    for (const scope of scopes) {
      const matchedTask = existingByScope.get(scope.id);

      if (!matchedTask) {
        const nextTask = syncTaskDerivedFields({
          id: "",
          project_id: projectId,
          bom_scope_id: scope.id,
          parent_id: null,
          name: scope.name,
          description: scope.description || `Generated from BOM scope: ${scope.name}`,
          start_date: new Date().toISOString().split("T")[0],
          end_date: calculateEndDate(new Date().toISOString().split("T")[0], 1),
          duration_days: 1,
          progress: Number(scope.completion_percentage || 0),
          dependencies: [],
          assigned_team: null,
          priority: "medium",
          constraint_type: "ASAP",
          status: "not_started",
          sort_order: scope.order_number || 0,
          created_by: null,
          created_at: null,
          updated_at: null,
          scope_quantity: Number(scope.quantity || 1),
          scope_unit: scope.unit || "lot",
          productivity_rate_per_hour: 0,
          productivity_rate_per_day: 0,
          working_hours_per_day: 8,
          team_template_id: null,
          number_of_teams: 1,
          team_composition: [
            { id: "mason", role: "Mason", count: 1 },
            { id: "helper", role: "Helper", count: 1 },
          ],
          resource_labor: [
            { id: "mason", role: "Mason", count: 1 },
            { id: "helper", role: "Helper", count: 1 },
          ],
          equipment: [],
          cost_links: [],
          duration_source: "auto",
          notes: "",
          task_config: {},
          bom_scope: {
            id: scope.id,
            name: scope.name,
            quantity: Number(scope.quantity || 1),
            unit: scope.unit || "lot",
            completion_percentage: scope.completion_percentage ?? null,
            description: scope.description,
            total_materials: scope.total_materials ?? null,
            total_labor: scope.total_labor ?? null,
          },
        });

        inserts.push(serializeTask(nextTask));
        continue;
      }

      if (syncMode === "resync") {
        const syncedTask = syncTaskDerivedFields(
          {
            ...matchedTask,
            name: scope.name,
            description: scope.description || matchedTask.description || `Generated from BOM scope: ${scope.name}`,
            scope_quantity: Number(scope.quantity || matchedTask.scope_quantity || 1),
            scope_unit: scope.unit || matchedTask.scope_unit || "lot",
            sort_order: scope.order_number || matchedTask.sort_order || 0,
            bom_scope: {
              id: scope.id,
              name: scope.name,
              quantity: Number(scope.quantity || 1),
              unit: scope.unit || "lot",
              completion_percentage: scope.completion_percentage ?? null,
              description: scope.description,
              total_materials: scope.total_materials ?? null,
              total_labor: scope.total_labor ?? null,
            },
          },
          matchedTask.duration_source !== "manual"
        );

        updates.push(supabase.from("project_tasks").update(serializeTask(syncedTask)).eq("id", matchedTask.id));
      }
    }

    if (inserts.length > 0) {
      const { error } = await supabase.from("project_tasks").insert(inserts);
      if (error) {
        throw error;
      }
    }

    if (updates.length > 0) {
      const results = await Promise.all(updates);
      const failed = results.find((result) => result.error);
      if (failed?.error) {
        throw failed.error;
      }
    }

    return this.getTasksByProject(projectId);
  },
};