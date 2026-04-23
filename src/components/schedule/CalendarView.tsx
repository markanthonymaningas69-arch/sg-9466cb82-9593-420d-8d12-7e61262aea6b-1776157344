import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  aggregateCalendarDays,
  filterCalendarTasks,
  getCalendarPhase,
  getCalendarTeam,
  getVisibleDateKeys,
  parseDateKey,
  shiftCalendarAnchor,
  weekdayLabels,
  type CalendarResourceType,
  type CalendarTaskLike,
  type CalendarViewMode,
} from "@/lib/scheduleCalendar";
import { CalendarDays, ChevronLeft, ChevronRight, Package, Users, Wrench } from "lucide-react";

interface CalendarViewProps {
  tasks: CalendarTaskLike[];
  projectName: string;
}

const INITIAL_ANCHOR_DATE = new Date("2026-04-23T00:00:00.000Z");

function getStatusClasses(status: string) {
  if (status === "completed") {
    return "bg-green-500";
  }

  if (status === "in_progress") {
    return "bg-blue-500";
  }

  if (status === "delayed") {
    return "bg-red-500";
  }

  return "bg-slate-400";
}

export function CalendarView({ tasks, projectName }: CalendarViewProps) {
  const [calendarMode, setCalendarMode] = useState<CalendarViewMode>("month");
  const [anchorDate, setAnchorDate] = useState(INITIAL_ANCHOR_DATE);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [phaseFilter, setPhaseFilter] = useState("all");
  const [teamFilter, setTeamFilter] = useState("all");
  const [resourceType, setResourceType] = useState<CalendarResourceType>("all");

  const phaseOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => getCalendarPhase(task)))).sort((left, right) => left.localeCompare(right)),
    [tasks]
  );

  const teamOptions = useMemo(
    () => Array.from(new Set(tasks.map((task) => getCalendarTeam(task)))).sort((left, right) => left.localeCompare(right)),
    [tasks]
  );

  const filteredTasks = useMemo(
    () =>
      filterCalendarTasks(tasks, {
        phase: phaseFilter,
        team: teamFilter,
        resourceType,
      }),
    [tasks, phaseFilter, teamFilter, resourceType]
  );

  const visibleCalendar = useMemo(() => getVisibleDateKeys(anchorDate, calendarMode), [anchorDate, calendarMode]);
  const dayAggregates = useMemo(
    () => aggregateCalendarDays(filteredTasks, visibleCalendar.dateKeys),
    [filteredTasks, visibleCalendar.dateKeys]
  );

  const selectedDay = selectedDayKey ? dayAggregates.get(selectedDayKey) || null : null;
  const showLabor = resourceType === "all" || resourceType === "labor";
  const showMaterials = resourceType === "all" || resourceType === "materials";
  const showEquipment = resourceType === "all" || resourceType === "equipment";

  return (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="inline-flex items-center rounded-md border bg-muted/40 p-1">
            {(["month", "week", "day"] as CalendarViewMode[]).map((mode) => (
              <Button
                key={mode}
                size="sm"
                variant={calendarMode === mode ? "default" : "ghost"}
                className="h-8 text-xs capitalize"
                onClick={() => setCalendarMode(mode)}
              >
                {mode} View
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setAnchorDate((current) => shiftCalendarAnchor(current, calendarMode, -1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[180px] text-center text-sm font-medium text-foreground">{visibleCalendar.label}</div>
            <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setAnchorDate((current) => shiftCalendarAnchor(current, calendarMode, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:min-w-[620px]">
          <Select value={phaseFilter} onValueChange={setPhaseFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filter by phase" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All phases</SelectItem>
              {phaseOptions.map((phase) => (
                <SelectItem key={phase} value={phase}>
                  {phase}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filter by team" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All teams</SelectItem>
              {teamOptions.map((team) => (
                <SelectItem key={team} value={team}>
                  {team}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={resourceType} onValueChange={(value) => setResourceType(value as CalendarResourceType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filter by resource type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All resources</SelectItem>
              <SelectItem value="labor">Labor</SelectItem>
              <SelectItem value="materials">Materials</SelectItem>
              <SelectItem value="equipment">Equipment</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {calendarMode !== "day" && (
        <div className="grid grid-cols-7 gap-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {weekdayLabels.map((dayLabel) => (
            <div key={dayLabel} className="rounded-md border bg-muted/40 px-3 py-2 text-center">
              {dayLabel}
            </div>
          ))}
        </div>
      )}

      <div className={calendarMode === "day" ? "grid grid-cols-1 gap-3" : "grid grid-cols-7 gap-3"}>
        {visibleCalendar.dateKeys.map((dateKey) => {
          const day = dayAggregates.get(dateKey);
          const parsedDate = parseDateKey(dateKey);
          const isCurrentMonth = parsedDate.getUTCMonth() === anchorDate.getUTCMonth();
          const tasksForDay = day?.tasks || [];

          return (
            <button
              key={dateKey}
              type="button"
              onClick={() => setSelectedDayKey(dateKey)}
              className={`flex min-h-[180px] flex-col rounded-xl border bg-card p-3 text-left transition hover:border-primary/50 hover:shadow-sm ${
                calendarMode === "month" && !isCurrentMonth ? "opacity-55" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-foreground">{parsedDate.getUTCDate()}</p>
                  <p className="text-[11px] text-muted-foreground">{tasksForDay.length} task{tasksForDay.length === 1 ? "" : "s"}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">
                  {day?.totalWorkers || 0} workers
                </Badge>
              </div>

              <div className="mt-3 flex flex-1 flex-col gap-3">
                {showLabor && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                      <Users className="h-3.5 w-3.5 text-primary" />
                      Workforce
                    </div>
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {(day?.workforceBreakdown || []).slice(0, 3).map((role) => (
                        <p key={role.role}>{role.role}: {role.count}</p>
                      ))}
                      {!day?.workforceBreakdown.length && <p>No labor assigned</p>}
                    </div>
                  </div>
                )}

                {showMaterials && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                      <Package className="h-3.5 w-3.5 text-primary" />
                      Materials
                    </div>
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {(day?.materials || []).slice(0, 3).map((material) => (
                        <p key={material}>{material}</p>
                      ))}
                      {!day?.materials.length && <p>No materials linked</p>}
                    </div>
                  </div>
                )}

                {showEquipment && (
                  <div className="space-y-1">
                    <div className="flex items-center gap-1 text-[11px] font-medium text-foreground">
                      <Wrench className="h-3.5 w-3.5 text-primary" />
                      Equipment
                    </div>
                    <div className="space-y-1 text-[11px] text-muted-foreground">
                      {(day?.equipment || []).slice(0, 3).map((item) => (
                        <p key={item}>{item}</p>
                      ))}
                      {!day?.equipment.length && <p>No tools or equipment</p>}
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-3 flex flex-wrap gap-1">
                {tasksForDay.slice(0, 4).map((task) => (
                  <span key={task.id} className={`h-2.5 w-2.5 rounded-full ${getStatusClasses(task.status || "pending")}`} />
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1 font-medium text-foreground">
          <CalendarDays className="h-3.5 w-3.5 text-primary" />
          {projectName}
        </div>
        <span>Project filter uses the main project selector above.</span>
      </div>

      <Dialog open={Boolean(selectedDayKey)} onOpenChange={(open) => setSelectedDayKey(open ? selectedDayKey : null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{selectedDay ? dateKeyToLabel(selectedDay.dateKey) : "Day detail"}</DialogTitle>
          </DialogHeader>

          {selectedDay ? (
            <div className="space-y-5">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Users className="h-4 w-4 text-primary" />
                    Workforce
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    <p className="font-medium text-foreground">Total workers: {selectedDay.totalWorkers}</p>
                    {selectedDay.workforceBreakdown.map((role) => (
                      <p key={role.role}>{role.role}: {role.count}</p>
                    ))}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Package className="h-4 w-4 text-primary" />
                    Materials
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {selectedDay.materials.length > 0 ? selectedDay.materials.map((material) => <p key={material}>{material}</p>) : <p>No materials linked</p>}
                  </div>
                </div>

                <div className="rounded-lg border bg-muted/20 p-3">
                  <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Wrench className="h-4 w-4 text-primary" />
                    Equipment
                  </div>
                  <div className="space-y-1 text-sm text-muted-foreground">
                    {selectedDay.equipment.length > 0 ? selectedDay.equipment.map((item) => <p key={item}>{item}</p>) : <p>No tools or equipment</p>}
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">Scheduled tasks</h3>
                {selectedDay.tasks.length > 0 ? (
                  <div className="space-y-3">
                    {selectedDay.tasks.map((task) => (
                      <div key={task.id} className="rounded-lg border p-3">
                        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-medium text-foreground">{task.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {getCalendarPhase(task)} • {getCalendarTeam(task)}
                            </p>
                          </div>
                          <Badge variant="outline" className="w-fit capitalize">
                            {task.status?.replace("_", " ") || "pending"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No tasks scheduled for this day.</p>
                )}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function dateKeyToLabel(dateKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(parseDateKey(dateKey));
}