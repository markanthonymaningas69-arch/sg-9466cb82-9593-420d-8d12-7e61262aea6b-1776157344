import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  calculateRequiredDurationDays,
  createTeamRole,
  getProductivitySummary,
  normalizeTaskConfiguration,
  type TaskConfiguration,
} from "@/lib/scheduleTaskConfig";
import type { TaskFormData } from "@/lib/schedule";
import { AlignLeft, Clock, DollarSign, Plus, Save, Settings2, Trash2, Users, X } from "lucide-react";

type EditableTaskScope = NonNullable<TaskFormData["bom_scope"]>;

export interface EditableProjectTask extends Omit<TaskFormData, "bom_scope" | "task_config" | "dependencies"> {
  bom_scope: EditableTaskScope | null;
  task_config: TaskConfiguration;
  dependencies: string[];
}

interface TaskConfigurationPanelProps {
  task: EditableProjectTask | null;
  tasks: EditableProjectTask[];
  saving: boolean;
  onTaskChange: (task: EditableProjectTask) => void;
  onSave: () => void;
  onDelete: () => void;
}

function formatScopeBudget(task: EditableProjectTask) {
  const materials = Number(task.bom_scope?.total_materials || 0);
  const labor = Number(task.bom_scope?.total_labor || 0);
  return materials + labor;
}

function getDependencyIds(task: EditableProjectTask) {
  return Array.isArray(task.dependencies) ? task.dependencies.filter((value): value is string => typeof value === "string") : [];
}

export function TaskConfigurationPanel({
  task,
  tasks,
  saving,
  onTaskChange,
  onSave,
  onDelete,
}: TaskConfigurationPanelProps) {
  if (!task) {
    return (
      <Card className="lg:col-span-1 flex flex-col h-[600px] overflow-hidden">
        <CardHeader className="pb-3 border-b shrink-0 bg-muted/10">
          <CardTitle className="text-base flex items-center">
            <Settings2 className="h-4 w-4 mr-2 text-primary" />
            Task Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
          <div className="bg-muted h-12 w-12 rounded-full flex items-center justify-center mb-3">
            <AlignLeft className="h-6 w-6 text-muted-foreground/70" />
          </div>
          <p className="text-sm">Select a task from the schedule to configure parameters, schedule logic, and assigned resources.</p>
        </CardContent>
      </Card>
    );
  }

  const taskConfig = normalizeTaskConfiguration(task.task_config, {
    quantity: task.bom_scope?.quantity,
    unit: task.bom_scope?.unit,
    assignedTeamName: task.assigned_team,
  });
  const otherTasks = tasks.filter((item) => item.id !== task.id);
  const dependencyIds = getDependencyIds(task);
  const productivitySummary = getProductivitySummary(taskConfig);
  const requiredDays = calculateRequiredDurationDays(taskConfig);

  const handleTaskConfigChange = (updates: Partial<TaskConfiguration>) => {
    onTaskChange({
      ...task,
      task_config: normalizeTaskConfiguration(
        {
          ...taskConfig,
          ...updates,
        },
        {
          quantity: task.bom_scope?.quantity,
          unit: task.bom_scope?.unit,
          assignedTeamName: task.assigned_team,
        }
      ),
    });
  };

  const handleRoleChange = (roleId: string, updates: { role?: string; quantity?: number }) => {
    handleTaskConfigChange({
      teamRoles: taskConfig.teamRoles.map((role) =>
        role.id === roleId
          ? {
              ...role,
              role: updates.role ?? role.role,
              quantity: Math.max(1, Math.round(updates.quantity ?? role.quantity)),
            }
          : role
      ),
    });
  };

  const handleAddRole = () => {
    handleTaskConfigChange({
      teamRoles: [...taskConfig.teamRoles, createTeamRole("Worker", 1)],
    });
  };

  const handleRemoveRole = (roleId: string) => {
    handleTaskConfigChange({
      teamRoles: taskConfig.teamRoles.filter((role) => role.id !== roleId),
    });
  };

  const toggleDependency = (dependencyId: string) => {
    const nextDependencies = dependencyIds.includes(dependencyId)
      ? dependencyIds.filter((item) => item !== dependencyId)
      : [...dependencyIds, dependencyId];

    onTaskChange({
      ...task,
      dependencies: nextDependencies,
    });
  };

  return (
    <Card className="lg:col-span-1 flex flex-col h-[600px] overflow-hidden">
      <CardHeader className="pb-3 border-b shrink-0 bg-muted/10">
        <CardTitle className="text-base flex items-center">
          <Settings2 className="h-4 w-4 mr-2 text-primary" />
          Task Configuration
        </CardTitle>
      </CardHeader>

      <div className="flex-1 overflow-y-auto">
        <Tabs defaultValue="parameters" className="w-full">
          <TabsList className="w-full rounded-none border-b bg-transparent p-0 h-10">
            <TabsTrigger value="parameters" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              Parameters
            </TabsTrigger>
            <TabsTrigger value="schedule" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              Schedule
            </TabsTrigger>
            <TabsTrigger value="resources" className="flex-1 rounded-none data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:shadow-none">
              Resources
            </TabsTrigger>
          </TabsList>

          <div className="p-4 space-y-4">
            <TabsContent value="parameters" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label htmlFor="task-name" className="text-xs">Task Name</Label>
                <Input
                  id="task-name"
                  value={task.name || ""}
                  onChange={(event) => onTaskChange({ ...task, name: event.target.value })}
                  className="h-8 text-sm"
                />
              </div>

              {task.bom_scope && (
                <div className="bg-muted/50 p-3 rounded-md border text-sm space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="font-semibold">Linked Scope</span>
                  </div>
                  <p className="text-muted-foreground text-xs">{task.bom_scope.name}</p>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <Badge variant="outline">
                      Qty: {taskConfig.scopeQuantity} {taskConfig.scopeUnit}
                    </Badge>
                    <Badge variant="outline">
                      Budget: AED {formatScopeBudget(task).toLocaleString()}
                    </Badge>
                    <Badge variant="outline">
                      Required days: {requiredDays}
                    </Badge>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Status</Label>
                  <Select value={task.status || "pending"} onValueChange={(value) => onTaskChange({ ...task, status: value })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="delayed">Delayed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Priority</Label>
                  <Select value={task.priority || "medium"} onValueChange={(value) => onTaskChange({ ...task, priority: value })}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Scope Quantity</Label>
                <div className="grid grid-cols-[1fr_120px] gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={taskConfig.scopeQuantity}
                    onChange={(event) =>
                      handleTaskConfigChange({
                        scopeQuantity: Number(event.target.value) || 1,
                      })
                    }
                    className="h-8 text-sm"
                  />
                  <Input
                    value={taskConfig.scopeUnit}
                    onChange={(event) =>
                      handleTaskConfigChange({
                        scopeUnit: event.target.value || "lot",
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Team productivity rate</Label>
                  <Badge variant="secondary">{productivitySummary.durationDays} day estimate</Badge>
                </div>
                <div className="grid grid-cols-[1fr_110px] gap-2">
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={taskConfig.productivityOutput}
                    onChange={(event) =>
                      handleTaskConfigChange({
                        productivityOutput: Number(event.target.value) || 1,
                      })
                    }
                    className="h-8 text-sm"
                  />
                  <Select
                    value={taskConfig.productivityUnit}
                    onValueChange={(value) =>
                      handleTaskConfigChange({
                        productivityUnit: value === "hour" ? "hour" : "day",
                      })
                    }
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="hour">Per Hour</SelectItem>
                      <SelectItem value="day">Per Day</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-xs text-muted-foreground">
                  Current setup: {productivitySummary.teamLabel || "No roles"} completes {productivitySummary.outputLabel}
                </p>
                {taskConfig.productivityUnit === "hour" && (
                  <div className="space-y-2">
                    <Label className="text-xs">Work hours per day</Label>
                    <Input
                      type="number"
                      min="1"
                      step="0.5"
                      value={taskConfig.workHoursPerDay}
                      onChange={(event) =>
                        handleTaskConfigChange({
                          workHoursPerDay: Number(event.target.value) || 8,
                        })
                      }
                      className="h-8 text-sm"
                    />
                  </div>
                )}
              </div>

              <div className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Team composition</Label>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleAddRole}>
                    <Plus className="h-3 w-3 mr-1" />
                    Add Role
                  </Button>
                </div>
                <div className="space-y-2">
                  {taskConfig.teamRoles.map((role) => (
                    <div key={role.id} className="grid grid-cols-[1fr_80px_32px] gap-2 items-center">
                      <Input
                        value={role.role}
                        onChange={(event) => handleRoleChange(role.id, { role: event.target.value })}
                        className="h-8 text-sm"
                      />
                      <Input
                        type="number"
                        min="1"
                        step="1"
                        value={role.quantity}
                        onChange={(event) => handleRoleChange(role.id, { quantity: Number(event.target.value) || 1 })}
                        className="h-8 text-sm"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleRemoveRole(role.id)}
                        disabled={taskConfig.teamRoles.length === 1}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Progress ({task.progress || 0}%)</Label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={task.progress || 0}
                  onChange={(event) => onTaskChange({ ...task, progress: parseInt(event.target.value, 10) || 0 })}
                  className="w-full accent-primary"
                />
              </div>
            </TabsContent>

            <TabsContent value="schedule" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Start Date</Label>
                  <Input
                    type="date"
                    value={task.start_date || ""}
                    onChange={(event) => onTaskChange({ ...task, start_date: event.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">End Date</Label>
                  <Input
                    type="date"
                    value={task.end_date || ""}
                    onChange={(event) => onTaskChange({ ...task, end_date: event.target.value })}
                    className="h-8 text-xs"
                    disabled={taskConfig.autoCalculateDuration}
                  />
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Duration</Label>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="auto-duration"
                      checked={taskConfig.autoCalculateDuration}
                      onCheckedChange={(checked) =>
                        handleTaskConfigChange({
                          autoCalculateDuration: checked,
                        })
                      }
                    />
                    <Label htmlFor="auto-duration" className="text-[10px]">Auto-calc</Label>
                  </div>
                </div>
                <Input
                  type="number"
                  min="1"
                  step="1"
                  value={task.duration_days || requiredDays}
                  onChange={(event) => onTaskChange({ ...task, duration_days: Number(event.target.value) || 1 })}
                  className="h-8 text-sm"
                  disabled={taskConfig.autoCalculateDuration}
                />
                <p className="text-xs text-muted-foreground">
                  Required duration from parameters: {requiredDays} day(s)
                </p>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-xs flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Dependencies
                </Label>
                {otherTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Add more tasks to set predecessor dependencies.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {otherTasks.map((dependencyTask) => (
                      <label key={dependencyTask.id} className="flex items-center gap-2 text-xs">
                        <Checkbox
                          checked={dependencyIds.includes(dependencyTask.id)}
                          onCheckedChange={() => toggleDependency(dependencyTask.id)}
                        />
                        <span>{dependencyTask.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="resources" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label className="text-xs flex items-center">
                  <Users className="h-3 w-3 mr-1" />
                  Assigned Team Name
                </Label>
                <Input
                  value={taskConfig.assignedTeamName}
                  onChange={(event) =>
                    handleTaskConfigChange({
                      assignedTeamName: event.target.value,
                    })
                  }
                  className="h-8 text-sm"
                  placeholder="Masonry Team A"
                />
              </div>

              <div className="rounded-md border p-3 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">Resource summary</span>
                  <Badge variant="outline">{requiredDays} days</Badge>
                </div>
                <p className="text-muted-foreground">{productivitySummary.teamLabel || "No roles assigned"}</p>
                <p className="text-muted-foreground">Output: {productivitySummary.outputLabel}</p>
              </div>

              <div className="space-y-2">
                <Label className="text-xs">Execution Notes / Constraints</Label>
                <Textarea
                  className="min-h-[120px] text-sm"
                  placeholder="Enter schedule constraints, weather risks, or execution notes..."
                  value={task.description || ""}
                  onChange={(event) => onTaskChange({ ...task, description: event.target.value })}
                />
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      <div className="p-4 border-t bg-muted/10 shrink-0 flex gap-2">
        <Button className="flex-1 h-9 text-xs" onClick={onSave} disabled={saving}>
          {saving ? (
            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
          ) : (
            <Save className="h-3 w-3 mr-1.5" />
          )}
          Save Task
        </Button>
        <Button variant="outline" className="h-9 w-9 p-0 shrink-0 text-destructive hover:bg-destructive/10" onClick={onDelete}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </Card>
  );
}