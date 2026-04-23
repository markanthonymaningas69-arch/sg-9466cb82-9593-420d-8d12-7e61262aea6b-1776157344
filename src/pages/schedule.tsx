import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Layout } from "@/components/Layout";
import { TaskConfigurationPanel, type EditableProjectTask } from "@/components/schedule/TaskConfigurationPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createDraftTask, applyDependencyScheduling, type TaskDependency, type TaskFormData, type TaskRoleAllocation } from "@/lib/schedule";
import { calculateRequiredDurationDays, createDefaultTaskConfiguration, normalizeTaskConfiguration } from "@/lib/scheduleTaskConfig";
import { supabase } from "@/integrations/supabase/client";
import { projectService } from "@/services/projectService";
import { scheduleService } from "@/services/scheduleService";
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
  return normalizeTaskConfiguration(task.task_config, {
    quantity: task.bom_scope?.quantity,
    unit: task.bom_scope?.unit,
    assignedTeamName: task.assigned_team,
  }).teamRoles.map((role) => ({ id: role.id, role: role.role, count: Math.max(1, Math.round(role.quantity)) }));
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

function mergeMaterialDeliveryPlans(task: EditableProjectTask, storedPlans: SaveTaskMaterialDeliveryPlanInput[] = []) {
  const defaults = buildDefaultMaterialDeliveryPlans(task);
  const defaultsByName = new Map(defaults.map((plan) => [plan.materialName, plan] as const));
  const linkedMaterials = Array.isArray(task.bom_scope?.materials) ? task.bom_scope.materials : [];
  return linkedMaterials.map((materialName) => {
    const fallback = defaultsByName.get(materialName);
    const stored = storedPlans.find((plan) => plan.materialName === materialName);
    return fallback && stored
      ? { ...fallback, ...stored, materialName, plannedUsagePeriod: fallback.plannedUsagePeriod }
      : fallback || {
          materialId: materialName,
          materialName,
          deliveryScheduleType: "one_time",
          deliveryStartDate: task.start_date || null,
          deliveryFrequency: "daily",
          deliveryDurationDays: Math.max(1, Number(task.duration_days || 1)),
          customIntervalDays: null,
          quantityMode: "even",
          deliveryDates: task.start_date ? [task.start_date] : [],
          plannedUsagePeriod: task.start_date ? { startDate: task.start_date, endDate: task.end_date || task.start_date } : null,
          totalQuantity: 0,
          unit: task.scope_unit || task.bom_scope?.unit || "unit",
        };
  });
}

function calculateTaskLaborCostSummary(task: EditableProjectTask, rates: ManpowerRateRecord[]): ComputedTaskLaborCostSummary {
  const taskConfig = normalizeTaskConfiguration(task.task_config, {
    quantity: task.bom_scope?.quantity,
    unit: task.bom_scope?.unit,
    assignedTeamName: task.assigned_team,
  });
  const rateMap = new Map(rates.map((rate) => [rate.positionName.trim().toLowerCase(), rate] as const));
  const teams = Math.max(1, Number(taskConfig.numberOfTeams || task.number_of_teams || 1));
  const durationDays = Math.max(1, Number(task.duration_days || calculateRequiredDurationDays(taskConfig)));
  const rateSnapshot = taskConfig.teamRoles.map((role) => {
    const matched = rateMap.get(role.role.trim().toLowerCase());
    return {
      role: role.role,
      count: Math.max(1, Math.round(role.quantity)) * teams,
      dailyRate: Number(matched?.dailyRate || 0),
      overtimeRate: Number(matched?.overtimeRate || 0),
    };
  });
  const dailyCost = rateSnapshot.reduce((total, item) => total + item.count * item.dailyRate, 0);
  return { taskId: task.id || "", dailyCost: Number(dailyCost.toFixed(2)), totalCost: Number((dailyCost * durationDays).toFixed(2)), durationDays, rateSnapshot };
}

export default function SchedulePage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [tasks, setTasks] = useState<EditableProjectTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<EditableProjectTask | null>(null);
  const [manpowerRates, setManpowerRates] = useState<ManpowerRateRecord[]>([]);
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

  useEffect(() => { void loadProjects(); void loadManpowerRates(); }, []);
  useEffect(() => { if (selectedProject) { void loadTasks(selectedProject); } else { setTasks([]); setSelectedTask(null); setLoading(false); } }, [selectedProject]);

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

  async function loadManpowerRates() {
    try {
      const { data, error } = await supabase.from("manpower_rate_catalog").select("id, position_name, daily_rate, overtime_rate").order("position_name", { ascending: true });
      if (error) throw error;
      setManpowerRates((data || []).map((rate) => ({ id: rate.id, positionName: rate.position_name, dailyRate: Number(rate.daily_rate || 0), overtimeRate: Number(rate.overtime_rate || 0) })));
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

  async function handleGenerateFromBOM() {
    if (!selectedProject) return;
    try {
      setLoading(true);
      const result = await scheduleService.generateTasksFromBOM(selectedProject);
      await loadTasks(selectedProject);
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
      toast({ title: "Success", description: "Task deleted successfully" });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to delete task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const currentMaterialDeliveryPlans = useMemo(() => selectedTask ? mergeMaterialDeliveryPlans(selectedTask, selectedTask.id ? materialDeliveryPlansByTask[selectedTask.id] || [] : []) : [], [selectedTask, materialDeliveryPlansByTask]);
  const currentLaborCostSummary = useMemo(() => selectedTask ? calculateTaskLaborCostSummary(selectedTask, manpowerRates) : null, [selectedTask, manpowerRates]);

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
      }).catch((error) => {
        console.error(error);
        toast({ title: "Error", description: "Failed to auto-save labor cost summary", variant: "destructive" });
      });
    }, 700);
    return () => { if (laborCostSaveTimeoutRef.current) clearTimeout(laborCostSaveTimeoutRef.current); };
  }, [currentLaborCostSummary, tasks, toast]);

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Project Manager</h1>
            <p className="text-sm text-muted-foreground">Dynamic task scheduling with dependency logic, delivery planning, and labor costing.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger className="w-full sm:w-[260px]">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => void handleGenerateFromBOM()} disabled={!selectedProject || loading}>Sync BOM</Button>
            <Button onClick={() => { lastSavedSignatureRef.current = ""; setSelectedTask(createNewTask(selectedProject)); }} disabled={!selectedProject}>
              <Plus className="mr-2 h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Tasks</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{tasks.length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Dependent Tasks</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">{tasks.filter((task) => task.dependencies.length > 0).length}</p></CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="text-sm">Selected Daily Labor Cost</CardTitle></CardHeader><CardContent><p className="text-2xl font-semibold">AED {Number(currentLaborCostSummary?.dailyCost || 0).toFixed(2)}</p></CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
          <Card>
            <CardHeader><CardTitle>Task List</CardTitle></CardHeader>
            <CardContent>
              {!selectedProject ? (
                <p className="text-sm text-muted-foreground">Select a project to manage task schedule, resources, and cost planning.</p>
              ) : loading ? (
                <p className="text-sm text-muted-foreground">Loading schedule...</p>
              ) : tasks.length === 0 ? (
                <p className="text-sm text-muted-foreground">No tasks yet. Sync the BOM or add a task manually.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b text-left text-muted-foreground"><th className="py-2">Task</th><th className="py-2">Start</th><th className="py-2">Duration</th><th className="py-2">Dependencies</th><th className="py-2 text-right">Action</th></tr></thead>
                    <tbody>
                      {tasks.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)).map((task) => (
                        <tr key={task.id || task.name} className={`border-b cursor-pointer ${selectedTask?.id === task.id ? "bg-primary/5" : ""}`} onClick={() => { lastSavedSignatureRef.current = getTaskPersistenceSignature(task); setSelectedTask(task); }}>
                          <td className="py-3 font-medium">{task.name}<div className="mt-1"><Badge variant="outline">{task.dependencies.length} predecessor(s)</Badge></div></td>
                          <td className="py-3">{task.start_date || "-"}</td>
                          <td className="py-3">{task.duration_days || 0} day(s)</td>
                          <td className="py-3">{task.dependencies.map((dependency) => `${dependency.type}${dependency.lagDays ? ` +${dependency.lagDays}` : ""}`).join(", ") || "-"}</td>
                          <td className="py-3 text-right">
                            <Button type="button" variant="ghost" size="icon" onClick={(event) => { event.stopPropagation(); if (task.id) void handleDeleteTask(task.id); }} disabled={!task.id || saving}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          <TaskConfigurationPanel
            task={selectedTask}
            tasks={tasks}
            materialDeliveryPlans={currentMaterialDeliveryPlans}
            manpowerRates={manpowerRates}
            laborCostSummary={selectedTask?.id ? laborCostSummaries[selectedTask.id] || currentLaborCostSummary : currentLaborCostSummary}
            saving={saving}
            onTaskChange={handleTaskChange}
            onMaterialDeliveryPlansChange={(plans) => selectedTask?.id ? setMaterialDeliveryPlansByTask((current) => ({ ...current, [selectedTask.id]: plans })) : undefined}
          />
        </div>
      </div>
    </Layout>
  );
}