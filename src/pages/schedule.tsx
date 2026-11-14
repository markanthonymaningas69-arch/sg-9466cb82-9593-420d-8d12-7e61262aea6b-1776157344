import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, X, ChevronUp, ChevronDown, ArrowUp, ArrowDown } from "lucide-react";
import { Layout } from "@/components/Layout";
import { CalendarView } from "@/components/schedule/CalendarView";
import { GanttView } from "@/components/schedule/GanttView";
import { ProjectManpowerCatalogTab } from "@/components/schedule/ProjectManpowerCatalogTab";
import { SCurveView } from "@/components/schedule/SCurveView";
import { TaskConfigurationPanel, type EditableProjectTask } from "@/components/schedule/TaskConfigurationPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  applyDependencyScheduling,
  calculateCriticalPathTaskIds,
  createDraftTask,
  type TaskDependency,
  type TaskFormData,
  type TaskRoleAllocation,
} from "@/lib/schedule";
import {
  calculateRequiredDurationDays,
  calculateTotalTeamDailyCost,
  createDefaultTaskConfiguration,
  flattenTeamsToRoleAllocations,
  getMemberDailyRate,
  normalizeTaskConfiguration,
} from "@/lib/scheduleTaskConfig";
import { projectService } from "@/services/projectService";
import {
  projectManpowerCatalogService,
  type ProjectManpowerCatalogItem,
} from "@/services/projectManpowerCatalogService";
import { scheduleService } from "@/services/scheduleService";
import { scurveService } from "@/services/scurveService";
import { taskPlanningService, type SaveTaskMaterialDeliveryPlanInput } from "@/services/taskPlanningService";

type ScheduleTaskRecord = TaskFormData & { task_config?: unknown; bom_scope?: EditableProjectTask["bom_scope"] };

interface ProjectOption {
  id: string;
  name: string;
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
  rateSnapshot: Array<{ role: string; count: number; dailyRate: number; overtimeRate: number }>;
}

interface TaskScopeMaterialOption {
  id: string;
  name: string;
}

const toDateOnly = (value: Date) => value.toISOString().split("T")[0];

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(days - 1, 0));
  return toDateOnly(date);
}

function calculateProjectDuration(tasks: EditableProjectTask[]): { startDate: string | null; endDate: string | null; totalDays: number } {
  if (tasks.length === 0) {
    return { startDate: null, endDate: null, totalDays: 0 };
  }
  
  const validTasks = tasks.filter(t => t.start_date && t.end_date);
  if (validTasks.length === 0) {
    return { startDate: null, endDate: null, totalDays: 0 };
  }
  
  const startDate = validTasks.reduce((earliest, task) => {
    return !earliest || task.start_date < earliest ? task.start_date : earliest;
  }, validTasks[0].start_date);
  
  const endDate = validTasks.reduce((latest, task) => {
    return !latest || task.end_date > latest ? task.end_date : latest;
  }, validTasks[0].end_date);
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  
  return { startDate, endDate, totalDays };
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
      const typed = dependency as { id?: unknown; taskId?: unknown; type?: unknown; lagDays?: unknown };
      const taskId = typeof typed.taskId === "string" ? typed.taskId : "";
      if (!taskId) {
        return null;
      }
      return {
        id: typeof typed.id === "string" ? typed.id : `dependency-${taskId}-${index}`,
        taskId,
        type: typed.type === "SS" || typed.type === "FF" || typed.type === "SF" ? typed.type : "FS",
        lagDays: Math.max(0, Math.round(Number(typed.lagDays) || 0)),
      } satisfies TaskDependency;
    })
    .filter((dependency): dependency is TaskDependency => Boolean(dependency));
}

function normalizeEditableTask(task: ScheduleTaskRecord): EditableProjectTask {
  const seededConfig = {
    scopeQuantity: Number(task.scope_quantity || task.bom_scope?.quantity || 1),
    scopeUnit: task.scope_unit || task.bom_scope?.unit || "lot",
    productivityOutput: Number(task.productivity_rate_per_day || task.productivity_rate_per_hour || task.bom_scope?.quantity || 1),
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
    { quantity: task.bom_scope?.quantity, unit: task.bom_scope?.unit, assignedTeamName: task.assigned_team }
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

function createTaskRoleAllocations(task: EditableProjectTask): TaskRoleAllocation[] {
  return flattenTeamsToRoleAllocations(
    normalizeTaskConfiguration(task.task_config, {
      quantity: task.bom_scope?.quantity,
      unit: task.bom_scope?.unit,
      assignedTeamName: task.assigned_team,
    })
  ).map((role) => ({
    id: role.id,
    role: role.role,
    count: Math.max(1, Math.round(role.quantity)),
  }));
}

function toTaskFormData(task: EditableProjectTask): TaskFormData {
  const taskConfig = normalizeTaskConfiguration(task.task_config, {
    quantity: task.bom_scope?.quantity,
    unit: task.bom_scope?.unit,
    assignedTeamName: task.assigned_team,
  });
  const roleAllocations = createTaskRoleAllocations(task);
  const durationDays = taskConfig.autoCalculateDuration ? calculateRequiredDurationDays(taskConfig) : Math.max(1, Number(task.duration_days || 1));

  return {
    ...task,
    dependencies: task.dependencies,
    assigned_team: taskConfig.assignedTeamName || task.assigned_team || null,
    task_config: taskConfig as unknown as TaskFormData["task_config"],
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

const syncTaskWithConfiguration = (task: EditableProjectTask) => normalizeEditableTask(toTaskFormData(task));
const applyScheduleToEditableTasks = (taskList: EditableProjectTask[]) => applyDependencyScheduling(taskList.map(toTaskFormData)).map((task) => normalizeEditableTask(task as ScheduleTaskRecord));
const getTaskPersistenceSignature = (task: EditableProjectTask) => JSON.stringify(toTaskFormData(syncTaskWithConfiguration(task)));

function buildTaskSignatureMap(taskList: EditableProjectTask[]) {
  return Object.fromEntries(
    taskList
      .filter((task) => Boolean(task.id))
      .map((task) => [task.id, getTaskPersistenceSignature(task)])
  );
}

function reorderTasksBySortOrder(
  taskList: EditableProjectTask[],
  draggedTaskId: string,
  targetTaskId: string
) {
  const orderedTasks = [...taskList].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const draggedIndex = orderedTasks.findIndex((task) => task.id === draggedTaskId);
  const targetIndex = orderedTasks.findIndex((task) => task.id === targetTaskId);

  if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
    return orderedTasks;
  }

  const [draggedTask] = orderedTasks.splice(draggedIndex, 1);
  orderedTasks.splice(targetIndex, 0, draggedTask);

  return applyScheduleToEditableTasks(
    orderedTasks.map((task, index) =>
      syncTaskWithConfiguration({
        ...task,
        sort_order: index + 1,
      })
    )
  ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
}

function createNewTask(projectId: string) {
  const draftTask = createDraftTask(projectId);
  const taskConfig = createDefaultTaskConfiguration();
  return normalizeEditableTask({
    ...draftTask,
    task_config: taskConfig as unknown as TaskFormData["task_config"],
    assigned_team: taskConfig.assignedTeamName || draftTask.assigned_team,
    scope_quantity: taskConfig.scopeQuantity,
    scope_unit: taskConfig.scopeUnit,
    productivity_rate_per_day: taskConfig.productivityUnit === "day" ? taskConfig.productivityOutput : 0,
    productivity_rate_per_hour: taskConfig.productivityUnit === "hour" ? taskConfig.productivityOutput : 0,
    working_hours_per_day: taskConfig.workHoursPerDay,
    duration_source: "auto",
  });
}

function getTaskScopeMaterials(task: EditableProjectTask): TaskScopeMaterialOption[] {
  if (!Array.isArray(task.bom_scope?.materials)) {
    return [];
  }

  return task.bom_scope.materials
    .map((material) => ({
      id: material.id,
      name: material.name,
    }))
    .filter((material) => Boolean(material.id && material.name));
}

function buildDefaultMaterialDeliveryPlans(task: EditableProjectTask): SaveTaskMaterialDeliveryPlanInput[] {
  const materials = getTaskScopeMaterials(task);
  const startDate = task.start_date || null;
  const endDate = task.end_date || startDate || null;

  return materials.map((material) => ({
    materialId: material.id,
    materialName: material.name,
    deliveryScheduleType: "one_time",
    deliveryStartDate: startDate,
    deliveryFrequency: "daily",
    deliveryDurationDays: Math.max(1, Number(task.duration_days || 1)),
    customIntervalDays: null,
    quantityMode: "even",
    deliveryDates: startDate ? [startDate] : [],
    plannedUsagePeriod: startDate && endDate ? { startDate, endDate } : null,
    totalQuantity: 0,
    unit: task.scope_unit || task.bom_scope?.unit || "unit",
  }));
}

function mergeMaterialDeliveryPlans(task: EditableProjectTask, storedPlans: SaveTaskMaterialDeliveryPlanInput[] = []): SaveTaskMaterialDeliveryPlanInput[] {
  const defaults = buildDefaultMaterialDeliveryPlans(task);
  const defaultsById = new Map(defaults.map((plan) => [plan.materialId, plan] as const));
  const linkedMaterials = getTaskScopeMaterials(task);

  return linkedMaterials.map<SaveTaskMaterialDeliveryPlanInput>((material) => {
    const fallback = defaultsById.get(material.id);
    const stored =
      storedPlans.find((plan) => plan.materialId === material.id) ||
      storedPlans.find((plan) => plan.materialName === material.name);

    if (fallback && stored) {
      return {
        ...fallback,
        ...stored,
        materialId: material.id,
        materialName: material.name,
        plannedUsagePeriod: fallback.plannedUsagePeriod,
      };
    }

    if (fallback) {
      return fallback;
    }

    return {
      materialId: material.id,
      materialName: material.name,
      deliveryScheduleType: "one_time",
      deliveryStartDate: task.start_date || null,
      deliveryFrequency: "daily",
      deliveryDurationDays: Math.max(1, Number(task.duration_days || 1)),
      customIntervalDays: null,
      quantityMode: "even",
      deliveryDates: task.start_date ? [task.start_date] : [],
      plannedUsagePeriod: task.start_date
        ? { startDate: task.start_date, endDate: task.end_date || task.start_date }
        : null,
      totalQuantity: 0,
      unit: task.scope_unit || task.bom_scope?.unit || "unit",
    };
  });
}

function calculateTaskLaborCostSummary(
  task: EditableProjectTask,
  catalogItems: ProjectManpowerCatalogItem[]
): ComputedTaskLaborCostSummary {
  const taskConfig = normalizeTaskConfiguration(task.task_config, {
    quantity: task.bom_scope?.quantity,
    unit: task.bom_scope?.unit,
    assignedTeamName: task.assigned_team,
  });
  const durationDays = Math.max(1, Number(task.duration_days || calculateRequiredDurationDays(taskConfig)));
  const catalogByName = new Map(
    catalogItems.map((item) => [item.positionName.trim().toLowerCase(), item] as const)
  );
  const rateSnapshotMap = new Map<string, { role: string; count: number; dailyRate: number; overtimeRate: number }>();

  taskConfig.teams.forEach((team) => {
    const teamMultiplier = Math.max(1, Number(team.numberOfTeams || 1));

    team.members.forEach((member) => {
      const matchedCatalog = catalogByName.get(member.positionName.trim().toLowerCase()) || null;
      const dailyRate = getMemberDailyRate(
        {
          ...member,
          rate: Number(member.rate || matchedCatalog?.standardRate || 0),
          unit: matchedCatalog?.unit || member.unit,
        },
        taskConfig.workHoursPerDay
      );
      const key = `${member.positionName.trim().toLowerCase()}-${dailyRate}`;
      const existing = rateSnapshotMap.get(key);

      if (existing) {
        existing.count += teamMultiplier;
        return;
      }

      rateSnapshotMap.set(key, {
        role: member.positionName || "Unassigned",
        count: teamMultiplier,
        dailyRate,
        overtimeRate: 0,
      });
    });
  });

  const dailyCost = calculateTotalTeamDailyCost(taskConfig);

  return {
    taskId: task.id || "",
    dailyCost: Number(dailyCost.toFixed(2)),
    totalCost: Number((dailyCost * durationDays).toFixed(2)),
    durationDays,
    rateSnapshot: Array.from(rateSnapshotMap.values()),
  };
}

export default function SchedulePage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [tasks, setTasks] = useState<EditableProjectTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<EditableProjectTask | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "gantt" | "calendar" | "scurve" | "catalog">("list");
  const [panelOpen, setPanelOpen] = useState(false);
  const [manpowerCatalogItems, setManpowerCatalogItems] = useState<ProjectManpowerCatalogItem[]>([]);
  const [materialDeliveryPlansByTask, setMaterialDeliveryPlansByTask] = useState<Record<string, SaveTaskMaterialDeliveryPlanInput[]>>({});
  const [laborCostSummaries, setLaborCostSummaries] = useState<Record<string, ComputedTaskLaborCostSummary | null>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingDurationTaskId, setEditingDurationTaskId] = useState<string | null>(null);
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planningSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laborCostSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef("");
  const persistedTaskSignaturesRef = useRef<Record<string, string>>({});
  const lastSavedMaterialPlanSignatureRef = useRef<Record<string, string>>({});
  const lastSavedLaborCostSignatureRef = useRef<Record<string, string>>({});

  const selectedProjectName = useMemo(
    () => projects.find((project) => project.id === selectedProject)?.name || "Project schedule",
    [projects, selectedProject]
  );
  const sortedTasks = useMemo(
    () => [...tasks].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)),
    [tasks]
  );
  const dependentTaskCount = useMemo(
    () => sortedTasks.filter((task) => task.dependencies.length > 0).length,
    [sortedTasks]
  );
  const criticalPathTaskIds = useMemo(
    () => calculateCriticalPathTaskIds(sortedTasks.map(toTaskFormData)),
    [sortedTasks]
  );
  const criticalPathTaskIdSet = useMemo(
    () => new Set(criticalPathTaskIds),
    [criticalPathTaskIds]
  );
  const activeViewLabel =
    viewMode === "gantt"
      ? "Gantt"
      : viewMode === "calendar"
        ? "Calendar"
        : viewMode === "scurve"
          ? "S-Curve"
          : viewMode === "catalog"
            ? "Manpower Catalog"
            : "Task List";

  const projectDuration = useMemo(() => calculateProjectDuration(sortedTasks), [sortedTasks]);

  useEffect(() => {
    void loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      void loadTasks(selectedProject);
      void loadProjectManpowerCatalog(selectedProject);
    } else {
      setTasks([]);
      setSelectedTask(null);
      setLoading(false);
      setManpowerCatalogItems([]);
      lastSavedSignatureRef.current = "";
      persistedTaskSignaturesRef.current = {};
    }
  }, [selectedProject]);

  async function loadProjects() {
    try {
      const { data } = await projectService.getAll();
      setProjects((data || []).map((project) => ({ id: project.id, name: project.name })));
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load projects", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function recalculateProjectSCurve(projectId: string) {
    try {
      await scurveService.recalculateProject(projectId);
    } catch (error) {
      console.error(error);
    }
  }

  async function loadTasks(projectId: string) {
    try {
      setLoading(true);
      const data = await scheduleService.getTasksByProject(projectId);
      const normalizedTasks = applyScheduleToEditableTasks((data || []).map((task) => normalizeEditableTask(task as ScheduleTaskRecord)));
      persistedTaskSignaturesRef.current = buildTaskSignatureMap(normalizedTasks);
      setTasks(normalizedTasks);
      setSelectedTask((current) => current?.id ? normalizedTasks.find((task) => task.id === current.id) || null : null);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load schedule", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function loadProjectManpowerCatalog(projectId: string) {
    try {
      const data = await projectManpowerCatalogService.listByProject(projectId);
      setManpowerCatalogItems(data);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to load the project manpower catalog",
        variant: "destructive",
      });
    }
  }

  async function persistTaskOrder(
    nextTasks: EditableProjectTask[],
    previousTasks: EditableProjectTask[],
    selectedTaskId: string | null
  ) {
    const changedTasks = nextTasks.filter(
      (task) => task.id && getTaskPersistenceSignature(task) !== persistedTaskSignaturesRef.current[task.id]
    );

    if (changedTasks.length === 0) {
      persistedTaskSignaturesRef.current = buildTaskSignatureMap(nextTasks);
      return;
    }

    try {
      setSaving(true);
      const savedTasks = await Promise.all(
        changedTasks.map((task) => scheduleService.updateTask(task.id as string, toTaskFormData(task)))
      );
      const savedTaskMap = new Map(
        savedTasks.map((task) => {
          const normalizedTask = normalizeEditableTask(task as ScheduleTaskRecord);
          return [normalizedTask.id, normalizedTask] as const;
        })
      );
      const finalizedTasks = applyScheduleToEditableTasks(
        nextTasks.map((task) => (task.id && savedTaskMap.has(task.id) ? savedTaskMap.get(task.id)! : task))
      ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const finalizedSelectedTask = selectedTaskId
        ? finalizedTasks.find((task) => task.id === selectedTaskId) || null
        : null;

      persistedTaskSignaturesRef.current = buildTaskSignatureMap(finalizedTasks);
      if (finalizedSelectedTask) {
        lastSavedSignatureRef.current = getTaskPersistenceSignature(finalizedSelectedTask);
      }
      setTasks(finalizedTasks);
      setSelectedTask(finalizedSelectedTask);
      if (selectedProject) {
        void recalculateProjectSCurve(selectedProject);
      }
    } catch (error) {
      console.error(error);
      const revertedSelectedTask = selectedTaskId
        ? previousTasks.find((task) => task.id === selectedTaskId) || null
        : null;

      persistedTaskSignaturesRef.current = buildTaskSignatureMap(previousTasks);
      if (revertedSelectedTask) {
        lastSavedSignatureRef.current = getTaskPersistenceSignature(revertedSelectedTask);
      }
      setTasks(previousTasks);
      setSelectedTask(revertedSelectedTask);
      toast({ title: "Error", description: "Failed to save task order", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateFromBOM() {
    if (!selectedProject) return;
    try {
      setLoading(true);
      const result = await scheduleService.generateTasksFromBOM(selectedProject);
      await loadTasks(selectedProject);
      await recalculateProjectSCurve(selectedProject);
      toast({ title: "BOM synced", description: `${result.syncedCount} scope tasks synced (${result.createdCount} created, ${result.updatedCount} updated).` });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Failed to sync BOM", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function handleTaskChange(task: EditableProjectTask) {
    const syncedTask = syncTaskWithConfiguration(task);
    const nextTasks = syncedTask.id ? applyScheduleToEditableTasks(tasks.map((item) => item.id === syncedTask.id ? syncedTask : item)) : tasks;
    setSelectedTask(syncedTask.id ? nextTasks.find((item) => item.id === syncedTask.id) || syncedTask : syncedTask);
    if (syncedTask.id) setTasks(nextTasks);
  }

  async function persistTask(taskToPersist: EditableProjectTask) {
    const syncedTask = syncTaskWithConfiguration(taskToPersist);
    if (!selectedProject) return;

    const draftScheduledTasks = applyScheduleToEditableTasks(
      syncedTask.id
        ? tasks.map((item) => (item.id === syncedTask.id ? syncedTask : item))
        : [...tasks, syncedTask]
    );
    const draftSelectedTask = syncedTask.id
      ? draftScheduledTasks.find((item) => item.id === syncedTask.id) || syncedTask
      : syncedTask;
    const draftSignature = getTaskPersistenceSignature(draftSelectedTask);

    if (draftSelectedTask.id && draftSignature === persistedTaskSignaturesRef.current[draftSelectedTask.id]) {
      return;
    }

    if (!draftSelectedTask.id && draftSignature === lastSavedSignatureRef.current) {
      return;
    }

    try {
      setSaving(true);
      const savedTask = draftSelectedTask.id
        ? await scheduleService.updateTask(draftSelectedTask.id, toTaskFormData(draftSelectedTask))
        : await scheduleService.createTask(toTaskFormData(draftSelectedTask));
      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);

      const rescheduledTasks = applyScheduleToEditableTasks(
        draftSelectedTask.id
          ? draftScheduledTasks.map((item) => (item.id === draftSelectedTask.id ? normalizedSavedTask : item))
          : [...tasks, normalizedSavedTask]
      );

      const persistedTasks: EditableProjectTask[] = [];

      for (const scheduledTask of rescheduledTasks) {
        if (!scheduledTask.id) {
          persistedTasks.push(scheduledTask);
          continue;
        }

        if (scheduledTask.id === normalizedSavedTask.id) {
          persistedTasks.push(scheduledTask);
          continue;
        }

        const scheduledSignature = getTaskPersistenceSignature(scheduledTask);

        if (scheduledSignature === persistedTaskSignaturesRef.current[scheduledTask.id]) {
          persistedTasks.push(scheduledTask);
          continue;
        }

        const updatedTask = await scheduleService.updateTask(
          scheduledTask.id,
          toTaskFormData(scheduledTask)
        );
        persistedTasks.push(normalizeEditableTask(updatedTask as ScheduleTaskRecord));
      }

      const finalizedTasks = applyScheduleToEditableTasks(persistedTasks).sort(
        (a, b) => (a.sort_order || 0) - (b.sort_order || 0)
      );
      const finalizedSelectedTask =
        finalizedTasks.find((item) => item.id === normalizedSavedTask.id) || normalizedSavedTask;

      persistedTaskSignaturesRef.current = buildTaskSignatureMap(finalizedTasks);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(finalizedSelectedTask);
      setTasks(finalizedTasks);
      setSelectedTask(finalizedSelectedTask);
      void recalculateProjectSCurve(selectedProject);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to auto-save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    if (!selectedTask || !selectedProject) return;
    const signature = getTaskPersistenceSignature(selectedTask);
    if (signature === lastSavedSignatureRef.current) return;
    if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current);
    autoSaveTimeoutRef.current = setTimeout(() => { void persistTask(selectedTask); }, 700);
    return () => { if (autoSaveTimeoutRef.current) clearTimeout(autoSaveTimeoutRef.current); };
  }, [selectedProject, selectedTask]);

  async function handleDeleteTask(taskId: string) {
    // Check if this is an unsaved task
    if (!persistedTaskSignaturesRef.current[taskId]) {
      // Just remove from list, no API call needed
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setSelectedTask((current) => current?.id === taskId ? null : current);
      if (selectedTask?.id === taskId) {
        setPanelOpen(false);
      }
      return;
    }

    // Existing logic for saved tasks
    try {
      setSaving(true);
      await scheduleService.deleteTask(taskId);
      delete persistedTaskSignaturesRef.current[taskId];
      setTasks((current) => current.filter((task) => task.id !== taskId));
      setSelectedTask((current) => current?.id === taskId ? null : current);
      if (selectedTask?.id === taskId) {
        setPanelOpen(false);
      }
      if (selectedProject) {
        await recalculateProjectSCurve(selectedProject);
      }
      toast({ title: "Success", description: "Task deleted successfully" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const currentMaterialDeliveryPlans = useMemo(() => selectedTask ? mergeMaterialDeliveryPlans(selectedTask, selectedTask.id ? materialDeliveryPlansByTask[selectedTask.id] || [] : []) : [], [selectedTask, materialDeliveryPlansByTask]);
  const currentLaborCostSummary = useMemo(
    () => (selectedTask ? calculateTaskLaborCostSummary(selectedTask, manpowerCatalogItems) : null),
    [selectedTask, manpowerCatalogItems]
  );

  useEffect(() => {
    const taskId = selectedTask?.id;
    if (!taskId || !tasks.some((task) => task.id === taskId)) return;
    void (async () => {
      try {
        const plans = await taskPlanningService.getMaterialDeliveryPlans(taskId);
        const normalized = plans.map((plan) => ({
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
        const merged = mergeMaterialDeliveryPlans(selectedTask, normalized);
        setMaterialDeliveryPlansByTask((current) => ({ ...current, [taskId]: merged }));
        lastSavedMaterialPlanSignatureRef.current[taskId] = JSON.stringify(merged);
      } catch (error) {
        console.error(error);
      }
    })();
  }, [selectedTask?.id, tasks]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId) return;
    setLaborCostSummaries((current) => ({ ...current, [currentLaborCostSummary.taskId]: currentLaborCostSummary }));
  }, [currentLaborCostSummary]);

  useEffect(() => {
    const taskId = selectedTask?.id;
    if (!taskId || !tasks.some((task) => task.id === taskId)) return;
    const signature = JSON.stringify(currentMaterialDeliveryPlans);
    if (signature === lastSavedMaterialPlanSignatureRef.current[taskId]) return;
    if (planningSaveTimeoutRef.current) clearTimeout(planningSaveTimeoutRef.current);
    planningSaveTimeoutRef.current = setTimeout(() => {
      void taskPlanningService.replaceMaterialDeliveryPlans(taskId, currentMaterialDeliveryPlans).then((savedPlans) => {
        const normalized = savedPlans.map((plan) => ({
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
        lastSavedMaterialPlanSignatureRef.current[taskId] = JSON.stringify(normalized);
        setMaterialDeliveryPlansByTask((current) => ({ ...current, [taskId]: normalized }));
        if (selectedProject) {
          void recalculateProjectSCurve(selectedProject);
        }
      }).catch((error) => {
        console.error(error);
        toast({ title: "Error", description: "Failed to auto-save material delivery plan", variant: "destructive" });
      });
    }, 700);
    return () => { if (planningSaveTimeoutRef.current) clearTimeout(planningSaveTimeoutRef.current); };
  }, [selectedTask?.id, currentMaterialDeliveryPlans, tasks, toast]);

  useEffect(() => {
    if (!currentLaborCostSummary?.taskId || !tasks.some((task) => task.id === currentLaborCostSummary.taskId)) return;
    const signature = JSON.stringify(currentLaborCostSummary);
    if (signature === lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId]) return;
    if (laborCostSaveTimeoutRef.current) clearTimeout(laborCostSaveTimeoutRef.current);
    laborCostSaveTimeoutRef.current = setTimeout(() => {
      void taskPlanningService.upsertLaborCostSummary(currentLaborCostSummary).then((savedSummary) => {
        lastSavedLaborCostSignatureRef.current[currentLaborCostSummary.taskId] = JSON.stringify({
          dailyCost: savedSummary.dailyCost,
          totalCost: savedSummary.totalCost,
          durationDays: savedSummary.durationDays,
          rateSnapshot: savedSummary.rateSnapshot,
        });
        if (selectedProject) {
          void recalculateProjectSCurve(selectedProject);
        }
      }).catch((error) => {
        console.error(error);
        toast({ title: "Error", description: "Failed to auto-save labor cost summary", variant: "destructive" });
      });
    }, 700);
    return () => { if (laborCostSaveTimeoutRef.current) clearTimeout(laborCostSaveTimeoutRef.current); };
  }, [currentLaborCostSummary, tasks, toast]);

  const handleTaskSelect = (task: EditableProjectTask) => {
    lastSavedSignatureRef.current = getTaskPersistenceSignature(task);
    setSelectedTask(task);
    setPanelOpen(true);
  };

  const handleGanttTaskSelect = (taskId: string) => {
    const matchedTask = sortedTasks.find((task) => task.id === taskId);
    if (!matchedTask) {
      return;
    }

    handleTaskSelect(matchedTask);
  };

  const handleGanttTaskReorder = (draggedTaskId: string, targetTaskId: string) => {
    const reorderedTasks = reorderTasksBySortOrder(sortedTasks, draggedTaskId, targetTaskId);

    if (
      reorderedTasks.length === sortedTasks.length &&
      reorderedTasks.every((task, index) => task.id === sortedTasks[index]?.id)
    ) {
      return;
    }

    const currentSelectedTaskId = selectedTask?.id || null;
    const reorderedSelectedTask = currentSelectedTaskId
      ? reorderedTasks.find((task) => task.id === currentSelectedTaskId) || null
      : null;

    if (reorderedSelectedTask) {
      lastSavedSignatureRef.current = getTaskPersistenceSignature(reorderedSelectedTask);
    }

    setTasks(reorderedTasks);
    setSelectedTask(reorderedSelectedTask);
    void persistTaskOrder(reorderedTasks, sortedTasks, currentSelectedTaskId);
  };

  const handleAddTask = () => {
    if (!selectedProject) {
      toast({ title: "Error", description: "No project selected", variant: "destructive" });
      return;
    }

    // Calculate the highest sort_order to place new task at the end
    const maxSortOrder = tasks.length > 0 
      ? Math.max(...tasks.map(t => t.sort_order ?? 0))
      : -1;
    
    const newSortOrder = maxSortOrder + 1;

    const newTask = createNewTask(selectedProject);
    const taskWithOrder = { ...newTask, sort_order: newSortOrder };

    setTasks((current) => [...current, taskWithOrder]);
    setEditingTaskId(taskWithOrder.id);
  };

  const handleMoveTaskUp = (taskId: string) => {
    setTasks((current) => {
      const index = current.findIndex(t => t.id === taskId);
      if (index <= 0) return current; // Already at top or not found
      
      const newTasks = [...current];
      [newTasks[index - 1], newTasks[index]] = [newTasks[index], newTasks[index - 1]];
      
      // Update sort_order for both tasks
      newTasks[index - 1] = { ...newTasks[index - 1], sort_order: index - 1 };
      newTasks[index] = { ...newTasks[index], sort_order: index };
      
      // Persist the order changes
      void persistTask(newTasks[index - 1]);
      void persistTask(newTasks[index]);
      
      return newTasks;
    });
  };

  const handleMoveTaskDown = (taskId: string) => {
    setTasks((current) => {
      const index = current.findIndex(t => t.id === taskId);
      if (index === -1 || index >= current.length - 1) return current; // Already at bottom or not found
      
      const newTasks = [...current];
      [newTasks[index], newTasks[index + 1]] = [newTasks[index + 1], newTasks[index]];
      
      // Update sort_order for both tasks
      newTasks[index] = { ...newTasks[index], sort_order: index };
      newTasks[index + 1] = { ...newTasks[index + 1], sort_order: index + 1 };
      
      // Persist the order changes
      void persistTask(newTasks[index]);
      void persistTask(newTasks[index + 1]);
      
      return newTasks;
    });
  };

  const handleInlineTaskChange = (taskId: string, field: keyof EditableProjectTask, value: string | number) => {
    setTasks((current) =>
      current.map((task) => {
        if (task.id !== taskId) return task;
        
        const updated = { ...task, [field]: value };
        
        // Recalculate end date if start date or duration changes
        if (field === 'start_date' || field === 'duration_days') {
          const startDate = field === 'start_date' ? String(value) : task.start_date;
          const duration = field === 'duration_days' ? Number(value) : task.duration_days;
          if (startDate && duration > 0) {
            updated.end_date = addDays(startDate, duration);
          }
        }
        
        return syncTaskWithConfiguration(updated);
      })
    );
  };

  const handleSaveInlineTask = async (taskId: string) => {
    const taskToSave = tasks.find(t => t.id === taskId);
    if (!taskToSave) return;
    
    // Check if this is a new unsaved task (not in persistedTaskSignaturesRef)
    const isNewTask = !persistedTaskSignaturesRef.current[taskId];
    
    await persistTask(taskToSave);
    setEditingTaskId(null);
    
    // If it was a new task, the persistTask will add it with a new ID
    // So we need to remove the temporary one to avoid duplication
    if (isNewTask) {
      setTasks(current => current.filter(t => t.id !== taskId));
    }
  };

  return (
    <Layout>
      <div className="-m-3 sm:-m-6 h-[calc(100vh-4rem)] overflow-hidden p-2 sm:p-3 lg:p-4">
        <div className="flex h-full flex-col gap-2 sm:gap-3">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-semibold text-foreground">Project Manager</h1>
                </div>
                {selectedProject ? (
                  <p className="truncate text-xs text-muted-foreground">
                    {selectedProjectName}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
                <div className="flex rounded-lg border bg-card p-1">
                  <Button type="button" variant={viewMode === "list" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("list")}>
                    Task List
                  </Button>
                  <Button type="button" variant={viewMode === "gantt" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("gantt")}>
                    Gantt
                  </Button>
                  <Button type="button" variant={viewMode === "calendar" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("calendar")}>
                    Calendar
                  </Button>
                  <Button type="button" variant={viewMode === "scurve" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("scurve")}>
                    S-Curve
                  </Button>
                  <Button type="button" variant={viewMode === "catalog" ? "default" : "ghost"} size="sm" onClick={() => setViewMode("catalog")}>
                    Manpower Catalog
                  </Button>
                </div>

                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="h-9 w-full sm:w-[240px]">
                    <SelectValue placeholder="Select project" />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button type="button" size="sm" onClick={handleAddTask} disabled={!selectedProject}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Task
                </Button>
              </div>
            </div>

            <div className="hidden flex-wrap items-center gap-2 xl:flex">
              <Badge variant="outline">Tasks {sortedTasks.length}</Badge>
              <Badge variant="outline">Dependencies {dependentTaskCount}</Badge>
              <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700">
                Critical Path {criticalPathTaskIds.length}
              </Badge>
              <Badge variant="outline">Daily Labor AED {Number(currentLaborCostSummary?.dailyCost || 0).toFixed(0)}</Badge>
            </div>
          </div>

          <div className="flex h-full min-h-0 flex-col rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">
                  {selectedTask ? `Selected task: ${selectedTask.name}` : "Select a task to open the configuration panel."}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="hidden xl:inline-flex">
                  {saving ? "Auto-saving" : "Auto-save enabled"}
                </Badge>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-8"
                  onClick={() => setPanelOpen((current) => !current)}
                  disabled={!selectedTask}
                >
                  {panelOpen ? "Hide Panel" : "Show Panel"}
                </Button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden">
              {!selectedProject ? (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Select a project</p>
                    <p className="text-xs text-muted-foreground">
                      Open a project to manage tasks, resources, and performance curves in one workspace.
                    </p>
                  </div>
                </div>
              ) : loading ? (
                <div className="flex h-full items-center justify-center px-6">
                  <p className="text-sm text-muted-foreground">Loading schedule...</p>
                </div>
              ) : tasks.length === 0 && viewMode !== "scurve" ? (
                <div className="flex h-full items-center justify-center px-6 text-center">
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">No tasks yet</p>
                    <p className="text-xs text-muted-foreground">
                      Sync the BOM or add a task manually to start planning this project.
                    </p>
                  </div>
                </div>
              ) : viewMode === "list" ? (
                <div className="h-full overflow-auto -mx-3 px-3 sm:mx-0 sm:px-0">
                  {/* Total Project Duration Summary Card */}
                  <Card className="mb-4 border-2 border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 sticky top-0 z-20 shadow-md">
                    <CardContent className="p-4">
                      <div className="grid gap-4 md:grid-cols-4">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Project Duration</p>
                          <p className="text-3xl font-bold text-primary">
                            {projectDuration.totalDays} days
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {projectDuration.startDate && projectDuration.endDate ? (
                              <>
                                {new Date(projectDuration.startDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {" → "}
                                {new Date(projectDuration.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </>
                            ) : (
                              "No tasks scheduled"
                            )}
                          </p>
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Peak Concurrent Manpower</p>
                          {(() => {
                            // Build a timeline of all project dates and calculate concurrent manpower
                            const dateManpowerMap = new Map<string, Record<string, number>>();
                            
                            tasks.forEach((task) => {
                              if (!task.start_date || !task.end_date) return;
                              
                              const taskConfig = normalizeTaskConfiguration(
                                task.task_config || createDefaultTaskConfiguration(),
                                {
                                  quantity: task.bom_scope?.quantity,
                                  unit: task.bom_scope?.unit,
                                  assignedTeamName: task.assigned_team,
                                }
                              );
                              
                              // Get task's manpower breakdown
                              const taskManpower: Record<string, number> = {};
                              taskConfig.teams.forEach((team) => {
                                team.members.forEach((member) => {
                                  const position = member.positionName || "Unassigned";
                                  taskManpower[position] = (taskManpower[position] || 0) + (member.count || 1) * taskConfig.numberOfTeams;
                                });
                              });
                              
                              // Add this task's manpower to every date it's active
                              const startDate = new Date(task.start_date);
                              const endDate = new Date(task.end_date);
                              
                              for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
                                const dateKey = d.toISOString().split('T')[0];
                                
                                if (!dateManpowerMap.has(dateKey)) {
                                  dateManpowerMap.set(dateKey, {});
                                }
                                
                                const dayManpower = dateManpowerMap.get(dateKey)!;
                                Object.entries(taskManpower).forEach(([position, count]) => {
                                  dayManpower[position] = (dayManpower[position] || 0) + count;
                                });
                              }
                            });
                            
                            // Find the peak day (highest total manpower) - this accounts for overlaps
                            let peakManpowerBreakdown: Record<string, number> = {};
                            let peakTotal = 0;
                            
                            dateManpowerMap.forEach((dayManpower) => {
                              const dayTotal = Object.values(dayManpower).reduce((sum, count) => sum + count, 0);
                              if (dayTotal > peakTotal) {
                                peakTotal = dayTotal;
                                peakManpowerBreakdown = { ...dayManpower };
                              }
                            });

                            return (
                              <>
                                <p className="text-3xl font-bold text-primary">{peakTotal}</p>
                                <div className="space-y-0.5 text-xs text-muted-foreground max-h-16 overflow-y-auto">
                                  {Object.entries(peakManpowerBreakdown)
                                    .sort(([, a], [, b]) => b - a)
                                    .map(([position, count]) => (
                                      <div key={position} className="flex justify-between items-center gap-2">
                                        <span className="truncate">{position}:</span>
                                        <span className="font-semibold whitespace-nowrap">{count}</span>
                                      </div>
                                    ))}
                                  {peakTotal === 0 && (
                                    <p className="text-xs text-muted-foreground italic">No scheduled tasks yet</p>
                                  )}
                                </div>
                                {peakTotal > 0 && (
                                  <p className="text-[10px] text-muted-foreground italic mt-1">
                                    Maximum workers needed simultaneously
                                  </p>
                                )}
                              </>
                            );
                          })()}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total Labor Cost</p>
                          {(() => {
                            const totalLaborCost = tasks.reduce((sum, task) => {
                              const laborCostSummary = calculateTaskLaborCostSummary(task, manpowerCatalogItems);
                              return sum + (laborCostSummary?.totalCost || 0);
                            }, 0);

                            return (
                              <>
                                <p className="text-3xl font-bold text-primary">₱ {totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                                <p className="text-xs text-muted-foreground">
                                  For entire project
                                </p>
                              </>
                            );
                          })()}
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tasks Overview</p>
                          <div className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Total Tasks:</span>
                              <span className="font-semibold text-foreground">{tasks.length}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Critical Path:</span>
                              <span className="font-semibold text-amber-700">{criticalPathTaskIdSet.size}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">With Config:</span>
                              <span className="font-semibold text-foreground">
                                {tasks.filter(t => {
                                  const config = normalizeTaskConfiguration(
                                    t.task_config || createDefaultTaskConfiguration(),
                                    { quantity: t.bom_scope?.quantity, unit: t.bom_scope?.unit, assignedTeamName: t.assigned_team }
                                  );
                                  return config.productivityOutput > 0 && config.scopeQuantity > 0;
                                }).length}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  
                  <table className="w-full text-sm min-w-[900px]">
                    <thead className="sticky top-0 z-10 bg-background">
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-3 py-2 font-medium w-[80px]">Order</th>
                        <th className="px-3 py-2 font-medium w-[200px]">Task Name</th>
                        <th className="px-3 py-2 font-medium w-[120px]">Start Date</th>
                        <th className="px-3 py-2 font-medium w-[120px]">End Date</th>
                        <th className="px-3 py-2 font-medium w-[100px]">Duration</th>
                        <th className="px-3 py-2 font-medium w-[150px]">Dependencies</th>
                        <th className="px-3 py-2 text-right font-medium w-[120px]">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedTasks.map((task, index) => {
                        const isCritical = task.id ? criticalPathTaskIdSet.has(task.id) : false;
                        const isEditing = editingTaskId === task.id;
                        const isEditingDuration = editingDurationTaskId === task.id;

                        return (
                          <tr
                            key={task.id || task.name}
                            className={`border-b ${
                              selectedTask?.id === task.id
                                ? "bg-primary/5"
                                : isCritical
                                  ? "bg-amber-500/5 hover:bg-amber-500/10"
                                  : "hover:bg-muted/30"
                            }`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleMoveTaskUp(task.id)}
                                  disabled={index === 0 || saving}
                                  className="h-6 w-6"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </Button>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => handleMoveTaskDown(task.id)}
                                  disabled={index === sortedTasks.length - 1 || saving}
                                  className="h-6 w-6"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </Button>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <Input
                                  value={task.name}
                                  onChange={(e) => handleInlineTaskChange(task.id, 'name', e.target.value)}
                                  className="h-8 text-sm"
                                  placeholder="Task name"
                                  autoFocus
                                />
                              ) : (
                                <div>
                                  <div className="font-medium">{task.name}</div>
                                  <div className="mt-1 flex flex-wrap gap-1.5">
                                    <Badge variant="outline" className="text-xs">{task.dependencies.length} predecessor(s)</Badge>
                                    {isCritical ? (
                                      <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-700 text-xs">
                                        Critical path
                                      </Badge>
                                    ) : null}
                                  </div>
                                </div>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {isEditing ? (
                                <Input
                                  type="date"
                                  value={task.start_date || ""}
                                  onChange={(e) => handleInlineTaskChange(task.id, 'start_date', e.target.value)}
                                  className="h-8 text-xs"
                                />
                              ) : (
                                task.start_date || "-"
                              )}
                            </td>
                            <td className="px-3 py-2">
                              {task.end_date || "-"}
                            </td>
                            <td className="px-3 py-2">
                              {(() => {
                                const taskConfig = normalizeTaskConfiguration(
                                  task.task_config || createDefaultTaskConfiguration(),
                                  {
                                    quantity: task.bom_scope?.quantity,
                                    unit: task.bom_scope?.unit,
                                    assignedTeamName: task.assigned_team,
                                  }
                                );
                                const hasProductivityConfig = 
                                  taskConfig.productivityOutput > 0 && 
                                  taskConfig.scopeQuantity > 0;
                                const isAutoCalculated = taskConfig.autoCalculateDuration && hasProductivityConfig;
                                
                                return (
                                  <div className="flex items-center gap-1">
                                    <Input
                                      type="number"
                                      min="1"
                                      value={task.duration_days || 1}
                                      onChange={(e) => {
                                        const newDuration = Number(e.target.value);
                                        handleInlineTaskChange(task.id, 'duration_days', newDuration);
                                        // If manually setting duration, mark as manual mode
                                        if (!isEditing) {
                                          setTasks((current) =>
                                            current.map((t) =>
                                              t.id === task.id
                                                ? syncTaskWithConfiguration({
                                                    ...t,
                                                    duration_days: newDuration,
                                                    task_config: normalizeTaskConfiguration(
                                                      {
                                                        ...(t.task_config || createDefaultTaskConfiguration()),
                                                        autoCalculateDuration: false,
                                                      },
                                                      {
                                                        quantity: t.bom_scope?.quantity,
                                                        unit: t.bom_scope?.unit,
                                                        assignedTeamName: t.assigned_team,
                                                      }
                                                    ),
                                                  })
                                                : t
                                            )
                                          );
                                        }
                                      }}
                                      onBlur={async () => {
                                        const taskToSave = tasks.find(t => t.id === task.id);
                                        if (taskToSave) {
                                          await handleSaveInlineTask(task.id);
                                        }
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.currentTarget.blur();
                                        }
                                      }}
                                      className="h-8 text-xs w-20 text-gray-900"
                                      disabled={isEditing || saving || isAutoCalculated}
                                      title={isAutoCalculated ? "Duration is auto-calculated. Configure productivity/scope to change it." : "Enter duration manually"}
                                    />
                                    <span className="text-xs text-muted-foreground">
                                      {isAutoCalculated ? (
                                        <span className="text-blue-600" title="Auto-calculated from configuration">
                                          days ⚙️
                                        </span>
                                      ) : (
                                        "days"
                                      )}
                                    </span>
                                  </div>
                                );
                              })()}
                            </td>
                            <td className="px-3 py-2 text-xs">
                              {task.dependencies.map((dependency) => `${dependency.type}${dependency.lagDays ? ` +${dependency.lagDays}` : ""}`).join(", ") || "-"}
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center justify-end gap-1">
                                {isEditing ? (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="default"
                                      onClick={() => handleSaveInlineTask(task.id)}
                                      disabled={!task.name || saving}
                                      className="h-7 text-xs"
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => {
                                        if (!task.id || persistedTaskSignaturesRef.current[task.id]) {
                                          setEditingTaskId(null);
                                        } else {
                                          // Remove unsaved new task
                                          setTasks(current => current.filter(t => t.id !== task.id));
                                          setEditingTaskId(null);
                                        }
                                      }}
                                      className="h-7 text-xs"
                                    >
                                      Cancel
                                    </Button>
                                  </>
                                ) : (
                                  <>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => setEditingTaskId(task.id)}
                                      className="h-7 text-xs"
                                    >
                                      Edit
                                    </Button>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      onClick={() => handleTaskSelect(task)}
                                      className="h-7 text-xs"
                                    >
                                      Configure
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="icon"
                                      onClick={(event) => {
                                        event.stopPropagation();
                                        if (task.id) void handleDeleteTask(task.id);
                                      }}
                                      disabled={saving}
                                      className="h-7 w-7"
                                    >
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="h-full overflow-auto p-3">
                  {viewMode === "gantt" ? (
                    <GanttView
                      tasks={sortedTasks}
                      criticalTaskIds={criticalPathTaskIds}
                      selectedTaskId={selectedTask?.id || null}
                      onTaskSelect={handleGanttTaskSelect}
                      onTaskReorder={handleGanttTaskReorder}
                    />
                  ) : viewMode === "calendar" ? (
                    <CalendarView tasks={sortedTasks} projectName={selectedProjectName} />
                  ) : viewMode === "catalog" ? (
                    <ProjectManpowerCatalogTab
                      projectId={selectedProject}
                      onCatalogChanged={setManpowerCatalogItems}
                    />
                  ) : (
                    <SCurveView projectId={selectedProject} projectName={selectedProjectName} />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <Dialog open={panelOpen} onOpenChange={setPanelOpen}>
          <DialogContent className="max-w-[90vw] h-[90vh] flex flex-col p-0">
            <DialogHeader className="px-6 py-4 border-b shrink-0">
              <DialogTitle className="text-lg font-semibold">
                {selectedTask ? selectedTask.name || "Task Configuration" : "Task Configuration"}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-hidden">
              <TaskConfigurationPanel
                task={selectedTask}
                tasks={sortedTasks}
                materialDeliveryPlans={currentMaterialDeliveryPlans}
                manpowerCatalogItems={manpowerCatalogItems}
                laborCostSummary={selectedTask?.id ? laborCostSummaries[selectedTask.id] || currentLaborCostSummary : currentLaborCostSummary}
                saving={saving}
                embedded
                onTaskChange={handleTaskChange}
                onMaterialDeliveryPlansChange={(plans) => selectedTask?.id ? setMaterialDeliveryPlansByTask((current) => ({ ...current, [selectedTask.id]: plans })) : undefined}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}