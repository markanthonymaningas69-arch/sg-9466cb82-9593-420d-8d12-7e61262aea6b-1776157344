import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { TaskConfigurationPanel, type EditableProjectTask } from "@/components/schedule/TaskConfigurationPanel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Calendar as CalendarIcon } from "lucide-react";
import { createDraftTask, type TaskDependency, type TaskFormData, type TaskRoleAllocation } from "@/lib/schedule";
import {
  calculateRequiredDurationDays,
  createDefaultTaskConfiguration,
  normalizeTaskConfiguration,
} from "@/lib/scheduleTaskConfig";
import { useToast } from "@/hooks/use-toast";
import { projectService } from "@/services/projectService";
import { scheduleService } from "@/services/scheduleService";

function toDateOnly(value: Date) {
  return value.toISOString().split("T")[0];
}

function addDays(dateValue: string, days: number) {
  const date = new Date(dateValue);
  date.setDate(date.getDate() + Math.max(days - 1, 0));
  return toDateOnly(date);
}

function extractDependencyIds(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((dependency) => {
      if (typeof dependency === "string") {
        return dependency;
      }

      if (dependency && typeof dependency === "object") {
        const typedDependency = dependency as { taskId?: unknown; id?: unknown };
        if (typeof typedDependency.taskId === "string") {
          return typedDependency.taskId;
        }
        if (typeof typedDependency.id === "string") {
          return typedDependency.id;
        }
      }

      return null;
    })
    .filter((dependencyId): dependencyId is string => Boolean(dependencyId));
}

function createTaskDependencies(dependencyIds: string[]): TaskDependency[] {
  return dependencyIds.map((dependencyId) => ({
    id: `dependency-${dependencyId}`,
    taskId: dependencyId,
    type: "FS",
    lagDays: 0,
  }));
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
    dependencies: extractDependencyIds(task.dependencies),
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
    dependencies: createTaskDependencies(task.dependencies),
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

export default function SchedulePage() {
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [tasks, setTasks] = useState<EditableProjectTask[]>([]);
  const [selectedTask, setSelectedTask] = useState<EditableProjectTask | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const { toast } = useToast();

  useEffect(() => {
    void loadProjects();
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

  const loadTasks = async (projectId: string) => {
    try {
      setLoading(true);
      const data = await scheduleService.getTasksByProject(projectId);
      const normalizedTasks = (data || []).map((task) => normalizeEditableTask(task as ScheduleTaskRecord));
      setTasks(normalizedTasks);
      setSelectedTask((currentTask) => {
        if (!currentTask?.id) {
          return currentTask;
        }

        const refreshedTask = normalizedTasks.find((task) => task.id === currentTask.id);
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
    setSelectedTask(syncTaskWithConfiguration(task));
  };

  const handleAddTask = () => {
    setSelectedTask(createNewTask(selectedProject));
  };

  const handleUpdateTask = async () => {
    if (!selectedTask) {
      return;
    }

    const syncedTask = syncTaskWithConfiguration(selectedTask);
    const taskPayload = toTaskFormData(syncedTask);

    try {
      setSaving(true);

      if (syncedTask.id) {
        await scheduleService.updateTask(syncedTask.id, taskPayload);
        toast({ title: "Success", description: "Task updated successfully" });
      } else {
        await scheduleService.createTask(taskPayload);
        toast({ title: "Success", description: "Task created successfully" });
        setSelectedTask(null);
      }

      await loadTasks(selectedProject);
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to save task", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!selectedTask?.id) {
      setSelectedTask(null);
      return;
    }

    try {
      setSaving(true);
      await scheduleService.deleteTask(selectedTask.id);
      toast({ title: "Success", description: "Task deleted successfully" });
      setSelectedTask(null);
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

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold">Project Manager</h1>
            <p className="text-muted-foreground mt-1">Interactive Gantt Chart and Scheduling</p>
          </div>
          <Select value={selectedProject} onValueChange={setSelectedProject}>
            <SelectTrigger className="w-full sm:w-[280px]">
              <SelectValue placeholder="Select a project" />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!selectedProject ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Please select a project to view its schedule and Gantt chart.
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <Card className="lg:col-span-3 min-h-[600px] flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between pb-2 border-b">
                <CardTitle className="text-lg">Project Schedule</CardTitle>
                <div className="flex flex-wrap items-center gap-2 mt-2 sm:mt-0">
                  <div className="flex items-center space-x-2 mr-4 bg-muted/50 p-1 rounded-md">
                    <Button size="sm" variant={viewMode === "list" ? "default" : "ghost"} onClick={() => setViewMode("list")} className="h-7 text-xs">List View</Button>
                    <Button size="sm" variant={viewMode === "gantt" ? "default" : "ghost"} onClick={() => setViewMode("gantt")} className="h-7 text-xs">Gantt View</Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleGenerateFromBOM}>
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Auto-generate from BOM
                  </Button>
                  <Button size="sm" onClick={handleAddTask}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Task
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 relative bg-background overflow-hidden flex flex-col">
                {loading ? (
                  <div className="flex items-center justify-center h-full min-h-[400px]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : tasks.length === 0 && !selectedTask ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-[400px] text-muted-foreground p-8 text-center">
                    <div className="bg-muted h-16 w-16 rounded-full flex items-center justify-center mb-4">
                      <CalendarIcon className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <p className="text-lg font-medium text-foreground">No tasks found for this project</p>
                    <p className="text-sm mt-1 max-w-md">Generate your schedule automatically from the current Bill of Materials scopes, or create tasks manually to build your Gantt chart.</p>
                    <Button className="mt-6" onClick={handleGenerateFromBOM}>Auto-generate from BOM</Button>
                  </div>
                ) : viewMode === "list" ? (
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-muted text-muted-foreground sticky top-0 z-10">
                        <tr>
                          <th className="px-4 py-3 font-medium min-w-[200px]">Task Name</th>
                          <th className="px-4 py-3 font-medium min-w-[100px]">Start Date</th>
                          <th className="px-4 py-3 font-medium min-w-[100px]">End Date</th>
                          <th className="px-4 py-3 font-medium min-w-[100px]">Duration</th>
                          <th className="px-4 py-3 font-medium min-w-[120px]">Progress</th>
                          <th className="px-4 py-3 font-medium min-w-[100px]">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tasks.map((task) => (
                          <tr
                            key={task.id || task.name}
                            onClick={() => setSelectedTask(task)}
                            className={`border-b cursor-pointer transition-colors ${selectedTask?.id === task.id ? "bg-primary/10 border-primary/20" : "bg-card hover:bg-muted/50"}`}
                          >
                            <td className="px-4 py-3 font-medium">
                              <div className="flex flex-col">
                                <span className={selectedTask?.id === task.id ? "text-primary" : "text-foreground"}>{task.name}</span>
                                {task.bom_scope && <span className="text-[10px] text-muted-foreground truncate max-w-[250px]">Scope: {task.bom_scope.name}</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-xs">{task.start_date ? new Date(task.start_date).toLocaleDateString() : "-"}</td>
                            <td className="px-4 py-3 text-xs">{task.end_date ? new Date(task.end_date).toLocaleDateString() : "-"}</td>
                            <td className="px-4 py-3 text-xs">{task.duration_days ? `${task.duration_days} d` : "-"}</td>
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2">
                                <div className="w-full bg-muted rounded-full h-1.5 min-w-[60px]">
                                  <div className="bg-primary h-1.5 rounded-full" style={{ width: `${task.progress || 0}%` }}></div>
                                </div>
                                <span className="text-xs font-semibold">{task.progress || 0}%</span>
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <Badge
                                variant="outline"
                                className={`text-[10px] capitalize ${
                                  task.status === "completed"
                                    ? "bg-green-500/10 text-green-600 border-green-500/20"
                                    : task.status === "in_progress"
                                      ? "bg-blue-500/10 text-blue-600 border-blue-500/20"
                                      : task.status === "delayed"
                                        ? "bg-red-500/10 text-red-600 border-red-500/20"
                                        : "bg-muted text-muted-foreground border-border"
                                }`}
                              >
                                {task.status?.replace("_", " ") || "Pending"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex-1 overflow-auto relative flex flex-col bg-background">
                    {timelineBounds ? (
                      <div className="min-w-max">
                        <div className="flex border-b bg-muted/30 sticky top-0 z-20">
                          <div className="w-[250px] shrink-0 border-r p-3 font-medium text-xs text-muted-foreground bg-card sticky left-0 z-30">Task Name</div>
                          <div className="flex-1 relative h-10 flex">
                            {Array.from({ length: timelineBounds.totalDays }).map((_, index) => {
                              const date = new Date(timelineBounds.minDate);
                              date.setDate(date.getDate() + index);
                              const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                              const isStartOfMonth = date.getDate() === 1;

                              return (
                                <div
                                  key={index}
                                  className={`w-[30px] shrink-0 border-r text-[9px] flex flex-col items-center justify-center ${isWeekend ? "bg-muted/50 text-muted-foreground/50" : "text-muted-foreground"}`}
                                >
                                  {isStartOfMonth && <span className="font-bold text-foreground absolute -top-4 whitespace-nowrap">{date.toLocaleString("default", { month: "short" })}</span>}
                                  <span>{date.getDate()}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>

                        {tasks.map((task) => {
                          let leftOffset = 0;
                          let barWidth = 0;
                          if (task.start_date && task.end_date) {
                            const startDate = new Date(task.start_date);
                            const endDate = new Date(task.end_date);
                            leftOffset = Math.max(0, Math.floor((startDate.getTime() - timelineBounds.minDate.getTime()) / (1000 * 3600 * 24))) * 30;
                            barWidth = Math.max(1, Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24))) * 30;
                          }

                          const isSelected = selectedTask?.id === task.id;

                          return (
                            <div
                              key={task.id || task.name}
                              className={`flex border-b hover:bg-muted/50 cursor-pointer ${isSelected ? "bg-primary/10" : ""}`}
                              onClick={() => setSelectedTask(task)}
                            >
                              <div className={`w-[250px] shrink-0 border-r p-2 text-xs truncate bg-card text-foreground sticky left-0 z-10 ${isSelected ? "border-primary/30 font-medium" : ""}`}>{task.name}</div>
                              <div className="flex-1 relative h-10 flex border-l border-border/50" style={{ backgroundImage: "linear-gradient(to right, hsl(var(--border) / 0.5) 1px, transparent 1px)", backgroundSize: "30px 100%" }}>
                                {task.start_date && task.end_date && (
                                  <div
                                    className={`absolute top-2 h-6 rounded-md shadow-sm border overflow-hidden flex items-center group transition-all ${
                                      task.status === "completed"
                                        ? "bg-green-500 border-green-600"
                                        : task.status === "in_progress"
                                          ? "bg-blue-500 border-blue-600"
                                          : task.status === "delayed"
                                            ? "bg-red-500 border-red-600"
                                            : "bg-slate-400 border-slate-500"
                                    } ${isSelected ? "ring-2 ring-primary ring-offset-1" : ""}`}
                                    style={{ left: `${leftOffset}px`, width: `${barWidth}px`, minWidth: "4px" }}
                                  >
                                    <div className="h-full bg-black/20" style={{ width: `${task.progress || 0}%` }}></div>
                                    <div className="absolute inset-0 px-2 flex items-center justify-between text-[10px] text-white font-medium opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap overflow-hidden">
                                      <span>{task.progress || 0}%</span>
                                      {barWidth > 60 && <span>{task.duration_days}d</span>}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                        Define start and end dates for your tasks to generate the timeline view.
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <TaskConfigurationPanel
              task={selectedTask}
              tasks={tasks}
              saving={saving}
              onTaskChange={handleTaskChange}
              onSave={handleUpdateTask}
              onDelete={handleDeleteTask}
            />
          </div>
        )}
      </div>
    </Layout>
  );
}