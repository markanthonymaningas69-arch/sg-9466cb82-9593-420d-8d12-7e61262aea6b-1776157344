import { useEffect, useMemo, useRef, useState } from "react";
import { Layout } from "@/components/Layout";
import { CalendarView } from "@/components/schedule/CalendarView";
import { TaskConfigurationPanel, type EditableProjectTask } from "@/components/schedule/TaskConfigurationPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar as CalendarIcon, Trash2 } from "lucide-react";
import { createDraftTask, applyDependencyScheduling, type TaskDependency, type TaskFormData, type TaskRoleAllocation } from "@/lib/schedule";
import {
  calculateRequiredDurationDays,
  createDefaultTaskConfiguration,
  normalizeTaskConfiguration,
} from "@/lib/scheduleTaskConfig";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { projectService } from "@/services/projectService";
import { scheduleService } from "@/services/scheduleService";
import {
  taskPlanningService,
  type SaveTaskMaterialDeliveryPlanInput,
  type TaskLaborCostSummary,
} from "@/services/taskPlanningService";

function toDateOnly(value: Date) {
  return value.toISOString().split("T")[0];
}

function addDays(dateValue: string, days: number) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + Math.max(days - 1, 0));
  return toDateOnly(date);
}

function extractTaskDependencies(value: unknown): TaskDependency[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((dependency, index) => {
      if (!dependency || typeof dependency !== "object") {
        return null;
      }

      const typedDependency = dependency as {
        id?: unknown;
        taskId?: unknown;
        type?: unknown;
        lagDays?: unknown;
      };

      const taskId = typeof typedDependency.taskId === "string" ? typedDependency.taskId : "";
      if (!taskId) {
        return null;
      }

      const dependencyType =
        typedDependency.type === "SS" || typedDependency.type === "FF" || typedDependency.type === "SF"
          ? typedDependency.type
          : "FS";

      return {
        id: typeof typedDependency.id === "string" ? typedDependency.id : `dependency-${taskId}-${index}`,
        taskId,
        type: dependencyType,
        lagDays: Math.max(0, Math.round(Number(typedDependency.lagDays) || 0)),
      } as TaskDependency;
    })
    .filter((dependency): dependency is TaskDependency => Boolean(dependency));
}

function createTaskRoleAllocations(task: EditableProjectTask): TaskRoleAllocation[] {
  return normalizeTaskConfiguration(task.task_config, {
    quantity: task.bom_scope?.quantity,
    unit: task.bom_scope?.unit,
    assignedTeamName: task.assigned_team,
  }).teamRoles.map((role) => ({
    id: role.id,
    role: role.role,
    count: Math.max(1, Math.round(role.quantity)),
  }));
}

function getTaskPersistenceSignature(task: EditableProjectTask) {
  return JSON.stringify(toTaskFormData(syncTaskWithConfiguration(task)));
}

function applyScheduleToEditableTasks(taskList: EditableProjectTask[]) {
  return applyDependencyScheduling(taskList.map((task) => toTaskFormData(task))).map((task) =>
    normalizeEditableTask(task as ScheduleTaskRecord)
  );
}

type ScheduleTaskRecord = TaskFormData & {
  task_config?: unknown;
  bom_scope?: EditableProjectTask["bom_scope"];
};

function toTaskConfigJson(taskConfig: ReturnType<typeof normalizeTaskConfiguration>): TaskFormData["task_config"] {
  return taskConfig as unknown as TaskFormData["task_config"];
}

function normalizeEditableTask(task: ScheduleTaskRecord): EditableProjectTask {
  const seededConfig = {
    scopeQuantity: Number(task.scope_quantity || task.bom_scope?.quantity || 1),
    scopeUnit: task.scope_unit || task.bom_scope?.unit || "lot",
    productivityOutput: Number(task.productivity_rate_per_day || task.productivity_rate_per_hour || task.scope_quantity || task.bom_scope?.quantity || 1),
    productivityUnit: task.productivity_rate_per_day && Number(task.productivity_rate_per_day) > 0 ? "day" : "hour",
    workHoursPerDay: Number(task.working_hours_per_day || 8),
    autoCalculateDuration: task.duration_source !== "manual",
    teamRoles: (task.team_composition || []).map((role, index) => ({
      id: role.id || `role-${index}`,
      role: role.role,
      quantity: Math.max(1, Math.round(role.count)),
    })),
    assignedTeamName: task.assigned_team || "",
  };

  const taskConfig = normalizeTaskConfiguration(
    typeof task.task_config === "object" && task.task_config !== null
      ? { ...seededConfig, ...(task.task_config as Record<string, unknown>) }
      : seededConfig,
    {
      quantity: task.bom_scope?.quantity,
      unit: task.bom_scope?.unit,
      assignedTeamName: task.assigned_team,
    }
  );

  const durationDays = taskConfig.autoCalculateDuration
    ? calculateRequiredDurationDays(taskConfig)
    : Math.max(1, Number(task.duration_days || calculateRequiredDurationDays(taskConfig)));

  return {
    ...task,
    dependencies: extractTaskDependencies(task.dependencies),
    assigned_team: taskConfig.assignedTeamName || task.assigned_team || null,
    task_config: taskConfig,
    duration_days: durationDays,
    end_date: task.start_date ? addDays(task.start_date, durationDays) : task.end_date,
    bom_scope: task.bom_scope || null,
  };
}

function toTaskFormData(task: EditableProjectTask): TaskFormData {
  const taskConfig = normalizeTaskConfiguration(task.task_config, {
    quantity: task.bom_scope?.quantity,
    unit: task.bom_scope?.unit,
    assignedTeamName: task.assigned_team,
  });
  const roleAllocations = createTaskRoleAllocations(task);
  const durationDays = taskConfig.autoCalculateDuration
    ? calculateRequiredDurationDays(taskConfig)
    : Math.max(1, Number(task.duration_days || 1));

  return {
    ...task,
    dependencies: task.dependencies,
    assigned_team: taskConfig.assignedTeamName || task.assigned_team || null,
    task_config: toTaskConfigJson(taskConfig),
    duration_days: durationDays,
    end_date: task.start_date ? addDays(task.start_date, durationDays) : task.end_date,
    scope_quantity: taskConfig.scopeQuantity,
    scope_unit: taskConfig.scopeUnit,
    productivity_rate_per_hour: taskConfig.productivityUnit === "hour" ? taskConfig.productivityOutput : 0,
    productivity_rate_per_day: taskConfig.productivityUnit === "day" ? taskConfig.productivityOutput : 0,
    working_hours_per_day: taskConfig.workHoursPerDay,
    team_composition: roleAllocations,
    resource_labor: roleAllocations,
    duration_source: taskConfig.autoCalculateDuration ? "auto" : "manual",
    equipment: Array.isArray(task.equipment) ? task.equipment : [],
    cost_links: Array.isArray(task.cost_links) ? task.cost_links : [],
    notes: task.notes || "",
    bom_scope: task.bom_scope || null,
  };
}

function createNewTask(projectId: string): EditableProjectTask {
  const draftTask = createDraftTask(projectId);
  const taskConfig = createDefaultTaskConfiguration();

  return normalizeEditableTask({
    ...draftTask,
    task_config: toTaskConfigJson(taskConfig),
    assigned_team: taskConfig.assignedTeamName || draftTask.assigned_team,
    scope_quantity: taskConfig.scopeQuantity,
    scope_unit: taskConfig.scopeUnit,
    productivity_rate_per_day: taskConfig.productivityUnit === "day" ? taskConfig.productivityOutput : 0,
    productivity_rate_per_hour: taskConfig.productivityUnit === "hour" ? taskConfig.productivityOutput : 0,
    working_hours_per_day: taskConfig.workHoursPerDay,
    duration_source: "auto",
  });
}

function syncTaskWithConfiguration(task: EditableProjectTask): EditableProjectTask {
  const normalizedTask = normalizeEditableTask(toTaskFormData(task));

  if (!normalizedTask.task_config.autoCalculateDuration) {
    const durationDays = Math.max(1, Number(normalizedTask.duration_days || 1));
    return {
      ...normalizedTask,
      duration_days: durationDays,
      end_date: normalizedTask.start_date ? addDays(normalizedTask.start_date, durationDays) : normalizedTask.end_date,
      assigned_team: normalizedTask.task_config.assignedTeamName || normalizedTask.assigned_team || null,
    };
  }

  const durationDays = calculateRequiredDurationDays(normalizedTask.task_config);
  return {
    ...normalizedTask,
    duration_days: durationDays,
    end_date: normalizedTask.start_date ? addDays(normalizedTask.start_date, durationDays) : normalizedTask.end_date,
    assigned_team: normalizedTask.task_config.assignedTeamName || normalizedTask.assigned_team || null,
  };
}

interface ManpowerRateRecord {
  id: string;
  positionName: string;
  dailyRate: number;
  overtimeRate: number;
}

interface ComputedTaskLaborCostSummary {
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

function buildDefaultMaterialDeliveryPlans(task: EditableProjectTask): SaveTaskMaterialDeliveryPlanInput[] {
  const materials = Array.isArray(task.bom_scope?.materials) ? task.bom_scope.materials : [];
  const startDate = task.start_date || null;
  const endDate = task.end_date || startDate || null;

  return materials.map((materialName, index) => ({
    materialId: `${task.id || "draft"}-${index}-${materialName.toLowerCase().replace(/\s+/g, "-")}`,
    materialName,
    deliveryScheduleType: "one_time",
    deliveryStartDate: startDate,
    deliveryFrequency: "daily",
    deliveryDurationDays: Math.max(1, Number(task.duration_days || 1)),
    customIntervalDays: null,
    quantityMode: "even",
    deliveryDates: startDate ? [startDate] : [],
    plannedUsagePeriod:
      startDate && endDate
        ? {
            startDate,
            endDate,
          }
        : null,
    totalQuantity: 0,
    unit: task.scope_unit || task.bom_scope?.unit || "unit",
  }));
}

function mergeMaterialDeliveryPlans(
  task: EditableProjectTask,
  storedPlans: SaveTaskMaterialDeliveryPlanInput[] = []
) {
  const defaults = buildDefaultMaterialDeliveryPlans(task);
  const defaultsByName = new Map(defaults.map((plan) => [plan.materialName, plan] as const));
  const linkedMaterials = Array.isArray(task.bom_scope?.materials) ? task.bom_scope.materials : [];

  if (linkedMaterials.length === 0) {
    return [];
  }

  return linkedMaterials.map((materialName) => {
    const fallback = defaultsByName.get(materialName);
    const stored = storedPlans.find((plan) => plan.materialName === materialName);

    if (!fallback) {
      return {
        materialId: materialName,
        materialName,
        deliveryScheduleType: "one_time" as const,
        deliveryStartDate: task.start_date || null,
        deliveryFrequency: "daily" as const,
        deliveryDurationDays: Math.max(1, Number(task.duration_days || 1)),
        customIntervalDays: null,
        quantityMode: "even" as const,
        deliveryDates: task.start_date ? [task.start_date] : [],
        plannedUsagePeriod: task.start_date
          ? {
              startDate: task.start_date,
              endDate: task.end_date || task.start_date,
            }
          : null,
        totalQuantity: 0,
        unit: task.scope_unit || task.bom_scope?.unit || "unit",
      };
    }

    if (!stored) {
      return fallback;
    }

    return {
      ...fallback,
      ...stored,
      materialName,
      plannedUsagePeriod: fallback.plannedUsagePeriod,
      deliveryStartDate: stored.deliveryStartDate || fallback.deliveryStartDate,
      deliveryDates: stored.deliveryDates.length > 0 ? stored.deliveryDates : fallback.deliveryDates,
      unit: stored.unit || fallback.unit,
    };
  });
}

function calculateTaskLaborCostSummary(
  task: EditableProjectTask,
  rates: ManpowerRateRecord[]
): ComputedTaskLaborCostSummary {
  const taskConfig = normalizeTaskConfiguration(task.task_config, {
    quantity: task.bom_scope?.quantity,
    unit: task.bom_scope?.unit,
    assignedTeamName: task.assigned_team,
  });
  const rateMap = new Map(rates.map((rate) => [rate.positionName.trim().toLowerCase(), rate] as const));
  const teamMultiplier = Math.max(1, Number(taskConfig.numberOfTeams || task.number_of_teams || 1));
  const durationDays = Math.max(1, Number(task.duration_days || calculateRequiredDurationDays(taskConfig)));
  const rateSnapshot = taskConfig.teamRoles.map((role) => {
    const matchedRate = rateMap.get(role.role.trim().toLowerCase());
    const count = Math.max(1, Math.round(role.quantity)) * teamMultiplier;

    return {
      role: role.role,
      count,
      dailyRate: Number(matchedRate?.dailyRate || 0),
      overtimeRate: Number(matchedRate?.overtimeRate || 0),
    };
  });
  const dailyCost = rateSnapshot.reduce((total, role) => total + role.count * role.dailyRate, 0);

  return {
    taskId: task.id || "",
    dailyCost: Number(dailyCost.toFixed(2)),
    totalCost: Number((dailyCost * durationDays).toFixed(2)),
    durationDays,
    rateSnapshot,
  };
}

export default function SchedulePage() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [tasks, setTasks] = useState<EditableProjectTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<EditableProjectTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "gantt" | "calendar">("list");
  const [manpowerRates, setManpowerRates] = useState<ManpowerRateRecord[]>([]);
  const [materialDeliveryPlansByTask, setMaterialDeliveryPlansByTask] = useState<
    Record<string, SaveTaskMaterialDeliveryPlanInput[]>
  >({});
  const [laborCostSummaries, setLaborCostSummaries] = useState<
    Record<string, TaskLaborCostSummary | ComputedTaskLaborCostSummary | null>
  >({});
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planningSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laborCostSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef("");
  const lastSavedMaterialPlanSignatureRef = useRef<Record<string, string>>({});
  const lastSavedLaborCostSignatureRef = useRef<Record<string, string>>({});
  const { toast } = useToast();

  useEffect(() => {
    void loadProjects();
    void loadManpowerRates();
  }, []);

  useEffect(() => {
    if (!selectedProject) {
      setTasks([]);
      setSelectedTask(null);
      return;
    }

    void loadTasks(selectedProject);
  }, [selectedProject]);

  const loadProjects = async () => {
    try {
      const { data } = await projectService.getAll();
      setProjects((data || []).map((project) => ({ id: project.id, name: project.name })));
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadManpowerRates = async () => {
    try {
      const { data, error } = await supabase
        .from("manpower_rate_catalog")
        .select("id, position_name, daily_rate, overtime_rate")
        .order("position_name", { ascending: true });

      if (error) {
        throw error;
      }

      setManpowerRates(
        (data || []).map((rate) => ({
          id: rate.id,
          positionName: rate.position_name,
          dailyRate: Number(rate.daily_rate || 0),
          overtimeRate: Number(rate.overtime_rate || 0),
        }))
      );
    } catch (error) {
      console.error(error);
      toast({ title: "Warning", description: "Unable to load manpower rate catalog", variant: "destructive" });
    }
  };

  const loadTasks = async (projectId: string) => {
    try {
      setLoading(true);
      const data = await scheduleService.getTasksByProject(projectId);
      const normalizedTasks = applyScheduleToEditableTasks((data || []).map((task) => normalizeEditableTask(task as ScheduleTaskRecord)));
      setTasks(normalizedTasks);
      setSelectedTask((currentTask) => {
        if (!currentTask?.id) {
          return currentTask;
        }

        const refreshedTask = normalizedTasks.find((task) => task.id === currentTask.id);
        if (refreshedTask) {
          lastSavedSignatureRef.current = getTaskPersistenceSignature(refreshedTask);
        }
        return refreshedTask || null;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load schedule", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateFromBOM = async () => {
    if (!selectedProject) {
      return;
    }

    try {
      setLoading(true);
      const result = await scheduleService.generateTasksFromBOM(selectedProject);
      await loadTasks(selectedProject);
      toast({
        title: "BOM synced",
        description: `${result.syncedCount} scope tasks synced (${result.createdCount} created, ${result.updatedCount} updated).`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate tasks";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask || !selectedProject) {
      return;
    }

    const nextSignature = getTaskPersistenceSignature(selectedTask);
    if (nextSignature === lastSavedSignatureRef.current) {
      return;
    }

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(() => {
      void persistTask(selectedTask);
    }, 700);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [selectedProject, selectedTask]);

  const handleDeleteTask = async (taskId: string) => {
    try {
      setSaving(true);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      await scheduleService.deleteTask(taskId);
      toast({ title: "Success", description: "Task deleted successfully" });
      lastSavedSignatureRef.current = "";
      setSelectedTask((currentTask) => (currentTask?.id === taskId ? null : currentTask));
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
      await loadTasks(selectedProject);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const timelineBounds = useMemo(() => {
    if (tasks.length === 0) {
      return null;
    }

    let minDate = new Date();
    let maxDate = new Date();
    let hasValidDates = false;

    tasks.forEach((task) => {
      if (task.start_date) {
        const startDate = new Date(task.start_date);
        if (!hasValidDates || startDate < minDate) {
          minDate = startDate;
        }
        hasValidDates = true;
      }

      if (task.end_date) {
        const endDate = new Date(task.end_date);
        if (!hasValidDates || endDate > maxDate) {
          maxDate = endDate;
        }
        hasValidDates = true;
      }
    });

    if (!hasValidDates) {
      return null;
    }

    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 14);

    return {
      minDate,
      totalDays: Math.ceil((maxDate.getTime() - minDate.getTime()) / (1000 * 3600 * 24)),
    };
  }, [tasks]);

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const persistMaterialDeliveryPlans = async (
    taskId: string,
    plans: SaveTaskMaterialDeliveryPlanInput[]
  ) => {
    try {
      setSaving(true);
      const savedPlans = await taskPlanningService.replaceMaterialDeliveryPlans(taskId, plans);
      const normalizedPlans: SaveTaskMaterialDeliveryPlanInput[] = savedPlans.map((plan) => ({
        materialId: plan.materialId,
        materialName: plan.materialName,
        deliveryScheduleType: plan.deliveryScheduleType,
        deliveryStartDate: plan.deliveryStartDate,
        deliveryFrequency: plan.deliveryFrequency,
        deliveryDurationDays: plan.deliveryDurationDays,
        customIntervalDays: plan.customIntervalDays,
        quantityMode: plan.quantityMode,
        deliveryDates: plan.deliveryDates,
        plannedUsagePeriod: plan.plannedUsagePeriod,
        totalQuantity: plan.totalQuantity,
        unit: plan.unit,
      }));

      lastSavedMaterialPlanSignatureRef.current[taskId] = JSON.stringify(normalizedPlans);
      setMaterialDeliveryPlansByTask((current) => ({
        ...current,
        [taskId]: normalizedPlans,
      }));
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save material delivery plan", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const persistLaborCostSummary = async (summary: ComputedTaskLaborCostSummary) => {
    if (!summary.taskId) {
      return;
    }

    try {
      setSaving(true);
      const savedSummary = await taskPlanningService.upsertLaborCostSummary({
        taskId: summary.taskId,
        dailyCost: summary.dailyCost,
        totalCost: summary.totalCost,
        durationDays: summary.durationDays,
        rateSnapshot: summary.rateSnapshot,
      });

      const signature = JSON.stringify({
        dailyCost: savedSummary.dailyCost,
        totalCost: savedSummary.totalCost,
        durationDays: savedSummary.durationDays,
        rateSnapshot: savedSummary.rateSnapshot,
      });

      lastSavedLaborCostSignatureRef.current[summary.taskId] = signature;
      setLaborCostSummaries((current) => ({
        ...current,
        [summary.taskId]: savedSummary,
      }));
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save labor cost summary", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const currentMaterialDeliveryPlans = useMemo(() => {
    if (!selectedTask) {
      return [];
    }

    return mergeMaterialDeliveryPlans(
      selectedTask,
      selectedTask.id ? materialDeliveryPlansByTask[selectedTask.id] || [] : []
    );
  }, [selectedTask, materialDeliveryPlansByTask]);

  const currentLaborCostSummary = useMemo(() => {
    if (!selectedTask) {
      return null;
    }

    return calculateTaskLaborCostSummary(selectedTask, manpowerRates);
  }, [selectedTask, manpowerRates]);

  const handleDeleteTask = async (taskId: string) => {
    try {
      setSaving(true);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      await scheduleService.deleteTask(taskId);
      toast({ title: "Success", description: "Task deleted successfully" });
      lastSavedSignatureRef.current = "";
      setSelectedTask((currentTask) => (currentTask?.id === taskId ? null : currentTask));
      setTasks((currentTasks) => currentTasks.filter((task) => task.id !== taskId));
      await loadTasks(selectedProject);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateFromBOM = async () => {
    if (!selectedProject) {
      return;
    }

    try {
      setLoading(true);
      const result = await scheduleService.generateTasksFromBOM(selectedProject);
      await loadTasks(selectedProject);
      toast({
        title: "BOM synced",
        description: `${result.syncedCount} scope tasks synced (${result.createdCount} created, ${result.updatedCount} updated).`,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to generate tasks";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

  const handleAddTask = () => {
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
  };

  const persistTask = async (taskToPersist: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    const signature = getTaskPersistenceSignature(syncedTask);

    if (!selectedProject || signature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = syncedTask.id
        ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask))
        : await scheduleService.createTask(toTaskFormData(syncedTask));

      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);

      setTasks((currentTasks) => {
        const existingTask = currentTasks.some((item) => item.id === normalizedSavedTask.id);
        const nextTasks = existingTask
          ? currentTasks.map((item) => (item.id === normalizedSavedTask.id ? normalizedSavedTask : item))
          : [...currentTasks, normalizedSavedTask];

        return applyScheduleToEditableTasks(nextTasks).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      });

      setSelectedTask((currentTask) => {
        if (currentTask?.id && currentTask.id !== normalizedSavedTask.id) {
          return currentTask;
        }
        return normalizedSavedTask;
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    if (!selectedTask?.id) {
      return;
    }

    const taskId = selectedTask.id;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);

    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) {
      return;
    }

    if (planningSaveTimeoutRef.current) {
      clearTimeout(planningSaveTimeoutRef.current);
    }

    planningSaveTimeoutRef.current = setTimeout(() => {
      void persistMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans);
    }, 700);

    return () => {
      if (planningSaveTimeoutRef.current) {
        clearTimeout(planningSaveTimeoutRef.current);
      }
    };
  }, [selectedTask?.id, currentMaterialDeliveryPlans]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) {
      return;
    }

    const signature = JSON.stringify({
      dailyCost: currentLaborCostSummary.dailyCost,
      totalCost: currentLaborCostSummary.totalCost,
      durationDays: currentLaborCostSummary.durationDays,
      rateSnapshot: currentLaborCostSummary.rateSnapshot,
    });

    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) {
      return;
    }

    if (laborCostSaveTimeoutRef.current) {
      clearTimeout(laborCostSaveTimeoutRef.current);
    }

    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void persistLaborCostSummary(currentLaborCostSummary);
    }, 700);

    return () => {
      if (laborCostSaveTimeoutRef.current) {
        clearTimeout(laborCostSaveTimeoutRef.current);
      }
    };
  }, [currentLaborCostSummary]);

  const handleMaterialDeliveryPlansChange = (plans: SaveTaskMaterialDeliveryPlanInput[]) => {
    if (!selectedTask?.id) {
      return;
    }

    setMaterialDeliveryPlansByTask((current) => ({
      ...current,
      [selectedTask.id]: plans,
    }));
  };

  const handleTaskChange = (task: EditableProjectTask) => {
    const syncedTask = syncTaskWithConfiguration(task);
    const recalculatedTasks = syncedTask.id
      ? applyScheduleToEditableTasks(
          tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        )
      : tasks;

    setSelectedTask(
      syncedTask.id
        ? recalculatedTasks.find((item) => item.id === syncedTask.id) || syncedTask
        : syncedTask
    );

    if (syncedTask.id) {
      setTasks(recalculatedTasks);
    }
  };

  const handleSelectTask = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
  };

 