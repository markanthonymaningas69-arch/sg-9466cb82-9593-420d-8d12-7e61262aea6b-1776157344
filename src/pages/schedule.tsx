import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { CalendarView } from "@/components/schedule/CalendarView";
import { GanttView } from "@/components/schedule/GanttView";
import { ProjectManpowerCatalogTab } from "@/components/schedule/ProjectManpowerCatalogTab";
import { SCurveView } from "@/components/schedule/SCurveView";
import { TaskConfigurationPanel, type EditableProjectTask } from "@/components/schedule/TaskConfigurationPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  applyDependencyScheduling,
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
import { PlanningWorkspaceShell } from "@/components/schedule/PlanningWorkspaceShell";

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

const toDateOnly = (value: Date) => value.toISOString().split("T")[0];

function addDays(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Math.max(days - 1, 0));
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
    plannedUsagePeriod: startDate && endDate ? { startDate, endDate } : null,
    totalQuantity: 0,
    unit: task.scope_unit || task.bom_scope?.unit || "unit",
  }));
}

function mergeMaterialDeliveryPlans(task: EditableProjectTask, storedPlans: SaveTaskMaterialDeliveryPlanInput[] = []): SaveTaskMaterialDeliveryPlanInput[] {
  const defaults = buildDefaultMaterialDeliveryPlans(task);
  const defaultsByName = new Map(defaults.map((plan) => [plan.materialName, plan] as const));
  const linkedMaterials = Array.isArray(task.bom_scope?.materials) ? task.bom_scope.materials : [];
  return linkedMaterials.map<SaveTaskMaterialDeliveryPlanInput>((materialName) => {
    const fallback = defaultsByName.get(materialName);
    const stored = storedPlans.find((plan) => plan.materialName === materialName);

    if (fallback && stored) {
      return {
        ...fallback,
        ...stored,
        materialName,
        plannedUsagePeriod: fallback.plannedUsagePeriod,
      };
    }

    if (fallback) {
      return fallback;
    }

    const fallbackPlan: SaveTaskMaterialDeliveryPlanInput = {
      materialId: materialName,
      materialName,
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

    return fallbackPlan;
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
  const autoSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const planningSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laborCostSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedSignatureRef = useRef("");
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
    const signature = getTaskPersistenceSignature(syncedTask);
    if (!selectedProject || signature === lastSavedSignatureRef.current) return;

    try {
      setSaving(true);
      const savedTask = syncedTask.id ? await scheduleService.updateTask(syncedTask.id, toTaskFormData(syncedTask)) : await scheduleService.createTask(toTaskFormData(syncedTask));
      const normalizedSavedTask = normalizeEditableTask(savedTask as ScheduleTaskRecord);
      lastSavedSignatureRef.current = getTaskPersistenceSignature(normalizedSavedTask);
      setTasks((current) => applyScheduleToEditableTasks([...current.filter((item) => item.id !== normalizedSavedTask.id), normalizedSavedTask]).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)));
      setSelectedTask(normalizedSavedTask);
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
    try {
      setSaving(true);
      await scheduleService.deleteTask(taskId);
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

  const handleCreateTask = () => {
    if (!selectedProject) return;
    lastSavedSignatureRef.current = "";
    setSelectedTask(createNewTask(selectedProject));
    setPanelOpen(true);
  };

  return (
    <Layout>
      <div className="-m-6 h-[calc(100vh-4rem)] overflow-hidden p-3 lg:p-4">
        <PlanningWorkspaceShell
          className="h-full"
          workspaceHeightClassName="h-full"
          panelOpen={panelOpen}
          onPanelOpenChange={setPanelOpen}
          panelTitle={selectedTask ? selectedTask.name || "Task Configuration" : "Task Configuration"}
          panelDescription={undefined}
          sidePanel={
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
          }
          toolbar={
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

                  <Button type="button" size="sm" variant="outline" onClick={() => void handleGenerateFromBOM()} disabled={!selectedProject || loading}>
                    Sync BOM
                  </Button>
                  <Button type="button" size="sm" onClick={handleCreateTask} disabled={!selectedProject}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Task
                  </Button>
                </div>
              </div>

              <div className="hidden flex-wrap items-center gap-2 xl:flex">
                <Badge variant="outline">Tasks {sortedTasks.length}</Badge>
                <Badge variant="outline">Dependencies {dependentTaskCount}</Badge>
                <Badge variant="outline">Daily Labor AED {Number(currentLaborCostSummary?.dailyCost || 0).toFixed(0)}</Badge>
              </div>
            </div>
          }
          mainContent={
            <div className="flex h-full min-h-0 flex-col">
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
                  <div className="h-full overflow-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-background">
                        <tr className="border-b text-left text-muted-foreground">
                          <th className="px-3 py-2 font-medium">Task</th>
                          <th className="px-3 py-2 font-medium">Start</th>
                          <th className="px-3 py-2 font-medium">Duration</th>
                          <th className="px-3 py-2 font-medium">Dependencies</th>
                          <th className="px-3 py-2 text-right font-medium">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedTasks.map((task) => (
                          <tr
                            key={task.id || task.name}
                            className={`cursor-pointer border-b ${selectedTask?.id === task.id ? "bg-primary/5" : "hover:bg-muted/30"}`}
                            onClick={() => handleTaskSelect(task)}
                          >
                            <td className="px-3 py-3 font-medium">
                              {task.name}
                              <div className="mt-1">
                                <Badge variant="outline">{task.dependencies.length} predecessor(s)</Badge>
                              </div>
                            </td>
                            <td className="px-3 py-3">{task.start_date || "-"}</td>
                            <td className="px-3 py-3">{task.duration_days || 0} day(s)</td>
                            <td className="px-3 py-3">
                              {task.dependencies.map((dependency) => `${dependency.type}${dependency.lagDays ? ` +${dependency.lagDays}` : ""}`).join(", ") || "-"}
                            </td>
                            <td className="px-3 py-3 text-right">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (task.id) void handleDeleteTask(task.id);
                                }}
                                disabled={!task.id || saving}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="h-full overflow-auto p-3">
                    {viewMode === "gantt" ? (
                      <GanttView tasks={sortedTasks} />
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
          }
        />
      </div>
    </Layout>
  );
}