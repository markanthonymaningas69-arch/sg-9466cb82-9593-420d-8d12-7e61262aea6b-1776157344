import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { TeamCompositionEditor } from "@/components/schedule/TeamCompositionEditor";
import type { TaskDependency, TaskFormData } from "@/lib/schedule";
import type {
  SaveTaskMaterialDeliveryPlanInput,
  TaskLaborCostSummary,
} from "@/services/taskPlanningService";
import type { ProjectManpowerCatalogItem } from "@/services/projectManpowerCatalogService";
import {
  calculateRequiredDurationDays,
  calculateTotalDailyOutput,
  calculateTotalTeamDailyCost,
  calculateTotalTeamMembers,
  getMemberDailyRate,
  getProductivitySummary,
  getTaskConfigurationValidation,
  normalizeTaskConfiguration,
  type TaskConfiguration,
} from "@/lib/scheduleTaskConfig";
import type { MasterTeamTemplate } from "@/services/masterCatalogService";
import { AlignLeft, Clock, Settings2, Wrench } from "lucide-react";

type EditableTaskScope = NonNullable<TaskFormData["bom_scope"]>;

export interface EditableProjectTask extends Omit<TaskFormData, "bom_scope" | "task_config" | "dependencies"> {
  bom_scope: EditableTaskScope | null;
  task_config: TaskConfiguration;
  dependencies: TaskDependency[];
}

interface ManpowerRateOption {
  positionName: string;
  dailyRate: number;
  overtimeRate: number;
}

interface TaskConfigurationPanelProps {
  task: EditableProjectTask | null;
  tasks: EditableProjectTask[];
  materialDeliveryPlans?: SaveTaskMaterialDeliveryPlanInput[];
  manpowerCatalogItems?: ProjectManpowerCatalogItem[];
  laborCostSummary?: Pick<TaskLaborCostSummary, "dailyCost" | "totalCost" | "durationDays" | "rateSnapshot"> | null;
  saving: boolean;
  embedded?: boolean;
  onTaskChange: (task: EditableProjectTask) => void;
  onMaterialDeliveryPlansChange?: (plans: SaveTaskMaterialDeliveryPlanInput[]) => void;
}

function getTaskDependencies(task: EditableProjectTask) {
  return Array.isArray(task.dependencies)
    ? task.dependencies.filter(
        (value): value is TaskDependency =>
          typeof value === "object" &&
          value !== null &&
          typeof value.taskId === "string" &&
          value.taskId.length > 0
      )
    : [];
}

const dependencyTypeOptions: { value: TaskDependency["type"]; label: string }[] = [
  { value: "FS", label: "FS" },
  { value: "SS", label: "SS" },
  { value: "FF", label: "FF" },
  { value: "SF", label: "SF" },
];

function toDateOnly(value: Date) {
  return value.toISOString().split("T")[0];
}

function shiftDate(dateValue: string, offsetDays: number) {
  const date = new Date(`${dateValue}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return toDateOnly(date);
}

function buildMaterialDeliveryDates(plan: SaveTaskMaterialDeliveryPlanInput) {
  if (!plan.deliveryStartDate) {
    return [];
  }

  if (plan.deliveryScheduleType === "one_time") {
    return [plan.deliveryStartDate];
  }

  const intervalDays =
    plan.deliveryFrequency === "weekly"
      ? 7
      : plan.deliveryFrequency === "custom"
        ? Math.max(1, Math.round(Number(plan.customIntervalDays || 1)))
        : 1;

  const durationDays = Math.max(1, Math.round(Number(plan.deliveryDurationDays || 1)));
  const dates: string[] = [];

  for (let offset = 0; offset < durationDays; offset += intervalDays) {
    dates.push(shiftDate(plan.deliveryStartDate, offset));
  }

  return dates;
}

export function TaskConfigurationPanel({
  task,
  tasks,
  materialDeliveryPlans = [],
  manpowerCatalogItems = [],
  laborCostSummary = null,
  saving,
  onTaskChange,
  onMaterialDeliveryPlansChange,
  embedded = false,
}: TaskConfigurationPanelProps) {
  const containerClassName = embedded
    ? "flex h-full min-h-0 flex-col overflow-hidden rounded-none border-0 shadow-none"
    : "lg:col-span-1 flex flex-col h-[600px] overflow-hidden";

  if (!task) {
    return (
      <Card className={containerClassName}>
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
  const dependencies = getTaskDependencies(task);
  const dependencyIds = dependencies.map((dependency) => dependency.taskId);
  const otherTasks = tasks.filter((item) => item.id !== task.id);
  const linkedMaterials = Array.isArray(task.bom_scope?.materials) ? task.bom_scope.materials : [];
  const equipmentValue = Array.isArray(task.equipment) ? task.equipment.join("\n") : "";
  const productivitySummary = getProductivitySummary(taskConfig);
  const validation = getTaskConfigurationValidation(taskConfig, manpowerCatalogItems);
  const estimatedDuration = calculateRequiredDurationDays(taskConfig);
  const totalDailyOutput = calculateTotalDailyOutput(taskConfig);
  const totalTeamMembers = calculateTotalTeamMembers(taskConfig);
  const totalDailyLaborCost = calculateTotalTeamDailyCost(taskConfig);
  const selectedTemplate = teamTemplates.find((template) => template.id === taskConfig.teamTemplateId) || null;
  const ratesByPosition = new Map(
    manpowerCatalogItems.map((item) => [item.positionName.trim().toLowerCase(), item] as const)
  );
  const resourceMaterialPlans =
    materialDeliveryPlans.length > 0
      ? materialDeliveryPlans
      : linkedMaterials.map((materialName, index) => ({
          materialId: `${task.id || "draft"}-${index}-${materialName.toLowerCase().replace(/\s+/g, "-")}`,
          materialName,
          deliveryScheduleType: "one_time" as const,
          deliveryStartDate: task.start_date || null,
          deliveryFrequency: "daily" as const,
          deliveryDurationDays: Math.max(1, Number(task.duration_days || estimatedDuration || 1)),
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
        }));

  const updateMaterialPlan = (
    materialId: string,
    updates: Partial<SaveTaskMaterialDeliveryPlanInput>
  ) => {
    if (!onMaterialDeliveryPlansChange) {
      return;
    }

    const nextPlans = resourceMaterialPlans.map((plan) => {
      if (plan.materialId !== materialId) {
        return plan;
      }

      const nextPlan: SaveTaskMaterialDeliveryPlanInput = {
        ...plan,
        ...updates,
        deliveryDurationDays:
          (updates.deliveryScheduleType || plan.deliveryScheduleType) === "one_time"
            ? 1
            : Math.max(
                1,
                Math.round(
                  Number(
                    updates.deliveryDurationDays ?? plan.deliveryDurationDays ?? estimatedDuration ?? 1
                  )
                )
              ),
        customIntervalDays:
          (updates.deliveryScheduleType || plan.deliveryScheduleType) === "staggered" &&
          (updates.deliveryFrequency || plan.deliveryFrequency) === "custom"
            ? Math.max(
                1,
                Math.round(Number(updates.customIntervalDays ?? plan.customIntervalDays ?? 1))
              )
            : null,
        quantityMode: "even",
        plannedUsagePeriod: task.start_date
          ? {
              startDate: task.start_date,
              endDate: task.end_date || task.start_date,
            }
          : null,
        totalQuantity: Number(plan.totalQuantity || 0),
      };

      return {
        ...nextPlan,
        deliveryDates: buildMaterialDeliveryDates(nextPlan),
      };
    });

    onMaterialDeliveryPlansChange(nextPlans);
  };

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

  const toggleDependency = (dependencyId: string) => {
    const nextDependencies: TaskDependency[] = dependencyIds.includes(dependencyId)
      ? dependencies.filter((item) => item.taskId !== dependencyId)
      : [
          ...dependencies,
          {
            id: `dependency-${dependencyId}`,
            taskId: dependencyId,
            type: "FS",
            lagDays: 0,
          },
        ];

    onTaskChange({
      ...task,
      dependencies: nextDependencies,
    });
  };

  const updateDependency = (dependencyId: string, updates: Partial<TaskDependency>) => {
    onTaskChange({
      ...task,
      dependencies: dependencies.map((item) =>
        item.taskId === dependencyId
          ? {
              ...item,
              ...updates,
            }
          : item
      ),
    });
  };

  return (
    <Card className={containerClassName}>
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
              <section className="space-y-3 rounded-md border p-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Basic Info</h3>
                  <p className="text-[11px] text-muted-foreground">These values are synced from the linked BOM scope and can only be changed in the BOM module.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Task Name</Label>
                  <Input value={task.bom_scope?.name || task.name || ""} readOnly className="h-8 text-sm bg-muted/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Scope Quantity</Label>
                  <div className="grid grid-cols-[1fr_110px] gap-2">
                    <Input value={String(task.bom_scope?.quantity ?? taskConfig.scopeQuantity)} readOnly className="h-8 text-sm bg-muted/50" />
                    <Input value={task.bom_scope?.unit || taskConfig.scopeUnit} readOnly className="h-8 text-sm bg-muted/50" />
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-md border p-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Productivity</h3>
                  <p className="text-[11px] text-muted-foreground">Enter the daily output of one team. The schedule will multiply it by the number of teams.</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">Output per team per day</Label>
                  <Input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={taskConfig.productivityOutput}
                    onChange={(event) =>
                      handleTaskConfigChange({
                        productivityOutput: Number(event.target.value) || 0,
                      })
                    }
                    className="h-8 text-sm"
                  />
                </div>
                {!validation.productivityValid && <p className="text-[11px] text-destructive">Productivity must be greater than 0.</p>}
              </section>

              <section className="space-y-3 rounded-md border p-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-foreground">Team Composition</h3>
                  <p className="text-[11px] text-muted-foreground">Choose a team template from the Master Catalog Engine and set how many teams will work on this scope.</p>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Team Type</Label>
                  <Select
                    value={taskConfig.teamTemplateId || undefined}
                    onValueChange={(templateId) => {
                      const template = teamTemplates.find((item) => item.id === templateId);
                      if (!template) {
                        return;
                      }

                      const nextConfig = applyTeamTemplate(taskConfig, template);

                      onTaskChange({
                        ...task,
                        assigned_team: template.name,
                        team_template_id: template.id,
                        number_of_teams: nextConfig.numberOfTeams,
                        task_config: nextConfig,
                      });
                    }}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Select a team template" />
                    </SelectTrigger>
                    <SelectContent>
                      {teamTemplates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {teamTemplates.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">No team templates found in the Master Catalog Engine yet.</p>
                  )}
                  {!validation.teamTemplateValid && teamTemplates.length > 0 && (
                    <p className="text-[11px] text-destructive">Team Type is required.</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Team Members</Label>
                  <div className="rounded-md border bg-muted/20 p-3">
                    {taskConfig.teamRoles.length > 0 ? (
                      <div className="space-y-2">
                        {taskConfig.teamRoles.map((role) => (
                          <div key={role.id} className="flex items-center justify-between text-xs">
                            <span className="text-foreground">{role.role}</span>
                            <Badge variant="outline">{role.quantity}</Badge>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Select a team type to load the member breakdown.</p>
                    )}
                  </div>
                  {selectedTemplate && <p className="text-[11px] text-muted-foreground">Template: {selectedTemplate.name}</p>}
                </div>

                <div className="space-y-2">
                  <Label className="text-xs">Number of Teams</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={taskConfig.numberOfTeams}
                    onChange={(event) => {
                      const value = Math.max(1, Math.round(Number(event.target.value) || 1));
                      handleTaskConfigChange({ numberOfTeams: value });
                      onTaskChange({
                        ...task,
                        number_of_teams: value,
                      });
                    }}
                    className="h-8 text-sm"
                  />
                  {!validation.numberOfTeamsValid && <p className="text-[11px] text-destructive">Number of Teams must be at least 1.</p>}
                </div>

                <div className="rounded-md border bg-primary/5 p-3 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">Estimated Duration</span>
                    <Badge>{estimatedDuration} days</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{productivitySummary.teamLabel || "No team members selected"}</p>
                  <p className="text-xs text-muted-foreground">Output per team: {productivitySummary.perTeamOutputLabel}</p>
                  <p className="text-xs text-muted-foreground">Total output with {taskConfig.numberOfTeams} team(s): {totalDailyOutput} {taskConfig.scopeUnit} per day</p>
                </div>
              </section>
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
                  <Input type="date" value={task.end_date || ""} readOnly className="h-8 text-xs bg-muted/50" />
                </div>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-xs font-semibold">Calculated Duration</Label>
                <Input type="number" value={estimatedDuration} readOnly className="h-8 text-sm bg-muted/50" />
                <p className="text-xs text-muted-foreground">Duration updates automatically from scope quantity, productivity, and number of teams.</p>
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <Label className="text-xs flex items-center">
                  <Clock className="h-3 w-3 mr-1" />
                  Dependencies
                </Label>
                {otherTasks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">Add more tasks to set predecessor dependencies.</p>
                ) : (
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {otherTasks.map((dependencyTask) => {
                      const selectedDependency = dependencies.find((item) => item.taskId === dependencyTask.id);

                      return (
                        <div key={dependencyTask.id} className="rounded-md border p-3 space-y-3">
                          <label className="flex items-center gap-2 text-xs font-medium">
                            <Checkbox
                              checked={Boolean(selectedDependency)}
                              onCheckedChange={() => toggleDependency(dependencyTask.id)}
                            />
                            <span>{dependencyTask.name}</span>
                          </label>

                          {selectedDependency ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="space-y-2">
                                <Label className="text-[11px]">Dependency Type</Label>
                                <Select
                                  value={selectedDependency.type}
                                  onValueChange={(value) =>
                                    updateDependency(dependencyTask.id, {
                                      type: value as TaskDependency["type"],
                                    })
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {dependencyTypeOptions.map((option) => (
                                      <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              <div className="space-y-2">
                                <Label className="text-[11px]">Lag Days</Label>
                                <Input
                                  type="number"
                                  min="0"
                                  step="1"
                                  value={selectedDependency.lagDays}
                                  onChange={(event) =>
                                    updateDependency(dependencyTask.id, {
                                      lagDays: Math.max(0, Math.round(Number(event.target.value) || 0)),
                                    })
                                  }
                                  className="h-8 text-xs"
                                />
                              </div>
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              Enable this predecessor to configure link type and lag time.
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="resources" className="space-y-4 mt-0">
              <section className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Team Assignment</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Member positions and default rates come from the project Manpower Catalog only.
                    </p>
                  </div>
                  <Badge variant="outline">{taskConfig.teams.length} team setup(s)</Badge>
                </div>

                {taskConfig.teams.length > 0 ? (
                  <div className="space-y-3">
                    {taskConfig.teams.map((team) => (
                      <div key={team.id} className="rounded-md border bg-muted/20 p-3 text-xs">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-foreground">{team.teamName}</p>
                            <p className="text-muted-foreground">
                              {team.members.length} member(s) per team × {team.numberOfTeams} team(s)
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-foreground">
                              {team.members.length * team.numberOfTeams} total personnel
                            </p>
                            <p className="text-muted-foreground">
                              Daily subtotal AED {calculateTotalTeamDailyCost({ ...taskConfig, teams: [team] }).toFixed(2)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-3 space-y-2">
                          {team.members.map((member) => (
                            <div key={member.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                              <div>
                                <p className="font-medium text-foreground">{member.positionName || "Unassigned"}</p>
                                <p className="text-muted-foreground">
                                  Rate can be overridden per member while keeping the catalog default available.
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-foreground">
                                  AED {Number(member.rate || 0).toFixed(2)}/{member.unit === "hour" ? "hr" : "day"}
                                </p>
                                <p className="text-muted-foreground">
                                  Daily equivalent AED {getMemberDailyRate(member, taskConfig.workHoursPerDay).toFixed(2)}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">Add at least one team in Parameters to populate this manpower plan.</p>
                )}
              </section>

              <section className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Material Delivery Planning</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Delivery schedules are linked to the task timeline and saved for future procurement and cash flow forecasting.
                    </p>
                  </div>
                  <Badge variant="outline">{resourceMaterialPlans.length} material(s)</Badge>
                </div>

                {resourceMaterialPlans.length > 0 ? (
                  <div className="space-y-3">
                    {resourceMaterialPlans.map((plan) => (
                      <div key={plan.materialId} className="rounded-md border bg-muted/20 p-3 space-y-3">
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">{plan.materialName}</p>
                            <p className="text-[11px] text-muted-foreground">
                              Planned usage: {plan.plannedUsagePeriod?.startDate || "-"} → {plan.plannedUsagePeriod?.endDate || "-"}
                            </p>
                          </div>
                          <Badge variant="outline">{plan.unit}</Badge>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2">
                          <div className="space-y-2">
                            <Label className="text-[11px]">Delivery Type</Label>
                            <Select
                              value={plan.deliveryScheduleType}
                              onValueChange={(value) =>
                                updateMaterialPlan(plan.materialId, {
                                  deliveryScheduleType: value as "one_time" | "staggered",
                                })
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select delivery type" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="one_time">One-time delivery</SelectItem>
                                <SelectItem value="staggered">Staggered delivery</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px]">Delivery Start Date</Label>
                            <Input
                              type="date"
                              value={plan.deliveryStartDate || ""}
                              onChange={(event) =>
                                updateMaterialPlan(plan.materialId, {
                                  deliveryStartDate: event.target.value || null,
                                })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="space-y-2">
                            <Label className="text-[11px]">Frequency</Label>
                            <Select
                              value={plan.deliveryFrequency}
                              onValueChange={(value) =>
                                updateMaterialPlan(plan.materialId, {
                                  deliveryFrequency: value as "daily" | "weekly" | "custom",
                                })
                              }
                              disabled={plan.deliveryScheduleType === "one_time"}
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="custom">Custom interval</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px]">Delivery Duration (days)</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={plan.deliveryScheduleType === "one_time" ? 1 : plan.deliveryDurationDays}
                              onChange={(event) =>
                                updateMaterialPlan(plan.materialId, {
                                  deliveryDurationDays: Math.max(
                                    1,
                                    Math.round(Number(event.target.value) || 1)
                                  ),
                                })
                              }
                              className="h-8 text-xs"
                              disabled={plan.deliveryScheduleType === "one_time"}
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-[11px]">Quantity Option</Label>
                            <Input value="Even distribution" readOnly className="h-8 text-xs bg-muted/50" />
                          </div>
                        </div>

                        {plan.deliveryScheduleType === "staggered" && plan.deliveryFrequency === "custom" ? (
                          <div className="space-y-2">
                            <Label className="text-[11px]">Custom Interval (days)</Label>
                            <Input
                              type="number"
                              min="1"
                              step="1"
                              value={plan.customIntervalDays || 1}
                              onChange={(event) =>
                                updateMaterialPlan(plan.materialId, {
                                  customIntervalDays: Math.max(
                                    1,
                                    Math.round(Number(event.target.value) || 1)
                                  ),
                                })
                              }
                              className="h-8 text-xs"
                            />
                          </div>
                        ) : null}

                        <div className="space-y-2">
                          <Label className="text-[11px]">Delivery Timeline</Label>
                          {plan.deliveryDates.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {plan.deliveryDates.map((date) => (
                                <Badge key={`${plan.materialId}-${date}`} variant="outline" className="text-[10px]">
                                  {date}
                                </Badge>
                              ))}
                            </div>
                          ) : (
                            <p className="text-[11px] text-muted-foreground">
                              Set the delivery start date to generate the material delivery timeline.
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No BOM materials are linked to this task scope yet.</p>
                )}
              </section>

              <section className="space-y-3 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Labor Cost Summary</h3>
                    <p className="text-[11px] text-muted-foreground">
                      Costs update automatically whenever team composition, duration, or HR rates change.
                    </p>
                  </div>
                  <Badge variant="outline">{laborCostSummary?.durationDays || estimatedDuration} days</Badge>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-md border bg-primary/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Daily Labor Cost</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      AED {Number(laborCostSummary?.dailyCost || 0).toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-md border bg-primary/5 p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Total Labor Cost</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">
                      AED {Number(laborCostSummary?.totalCost || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {laborCostSummary?.rateSnapshot?.length ? (
                  <div className="space-y-2">
                    {laborCostSummary.rateSnapshot.map((rate) => (
                      <div key={`${rate.role}-${rate.count}`} className="rounded-md border bg-muted/20 p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-foreground">{rate.role}</p>
                            <p className="text-muted-foreground">{rate.count} personnel assigned</p>
                          </div>
                          <div className="text-right">
                            <p className="text-foreground">AED {Number(rate.dailyRate || 0).toFixed(2)}/day</p>
                            <p className="text-muted-foreground">OT AED {Number(rate.overtimeRate || 0).toFixed(2)}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    No labor rate snapshot available yet. Add manpower rates in HR to populate this summary.
                  </p>
                )}
              </section>

              <div className="space-y-2">
                <Label className="text-xs flex items-center">
                  <Wrench className="h-3 w-3 mr-1" />
                  Tools & Equipment
                </Label>
                <Textarea
                  className="min-h-[110px] text-sm"
                  placeholder="Enter one tool or equipment item per line..."
                  value={equipmentValue}
                  onChange={(event) =>
                    onTaskChange({
                      ...task,
                      equipment: Array.from(
                        new Set(
                          event.target.value
                            .split("\n")
                            .map((item) => item.trim())
                            .filter(Boolean)
                        )
                      ),
                    })
                  }
                />
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

      <div className="p-4 border-t bg-muted/10 shrink-0">
        <p className="text-xs font-medium text-foreground">{saving ? "Auto-saving task changes..." : "Changes save automatically."}</p>
        <p className="text-[11px] text-muted-foreground mt-1">Delete tasks from the main task list only.</p>
      </div>
    </Card>
  );
}