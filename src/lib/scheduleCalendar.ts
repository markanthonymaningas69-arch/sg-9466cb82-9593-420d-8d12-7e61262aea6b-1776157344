import type { TaskRoleAllocation } from "@/lib/schedule";

export type CalendarViewMode = "month" | "week" | "day";
export type CalendarResourceType = "all" | "labor" | "materials" | "equipment";

export interface CalendarTaskScope {
  name?: string | null;
  materials?: string[] | null;
}

export interface CalendarTaskLike {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  assigned_team: string | null;
  resource_labor: TaskRoleAllocation[];
  team_composition: TaskRoleAllocation[];
  equipment: string[];
  bom_scope?: CalendarTaskScope | null;
}

export interface CalendarRoleTotal {
  role: string;
  count: number;
}

export interface CalendarDayAggregate {
  dateKey: string;
  tasks: CalendarTaskLike[];
  totalWorkers: number;
  workforceBreakdown: CalendarRoleTotal[];
  materials: string[];
  equipment: string[];
  statuses: string[];
  phases: string[];
}

interface CalendarFilters {
  phase: string;
  team: string;
  resourceType: CalendarResourceType;
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const compactRangeFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

export const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function normalizeString(value: string) {
  return value.trim().toLowerCase();
}

export function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function toDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

export function addUtcDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function startOfUtcWeek(date: Date) {
  return addUtcDays(date, -date.getUTCDay());
}

function endOfUtcWeek(date: Date) {
  return addUtcDays(startOfUtcWeek(date), 6);
}

function emptyAggregate(dateKey: string): CalendarDayAggregate {
  return {
    dateKey,
    tasks: [],
    totalWorkers: 0,
    workforceBreakdown: [],
    materials: [],
    equipment: [],
    statuses: [],
    phases: [],
  };
}

export function getCalendarPhase(task: CalendarTaskLike) {
  return task.bom_scope?.name?.trim() || "Unassigned scope";
}

export function getCalendarTeam(task: CalendarTaskLike) {
  return task.assigned_team?.trim() || "Unassigned team";
}

function getTaskRoles(task: CalendarTaskLike) {
  const source = task.resource_labor.length > 0 ? task.resource_labor : task.team_composition;
  return source.filter((role) => role.role && Number(role.count) > 0);
}

export function filterCalendarTasks(tasks: CalendarTaskLike[], filters: CalendarFilters) {
  return tasks.filter((task) => {
    const matchesPhase = filters.phase === "all" || getCalendarPhase(task) === filters.phase;
    const matchesTeam = filters.team === "all" || getCalendarTeam(task) === filters.team;
    const materialCount = Array.isArray(task.bom_scope?.materials) ? task.bom_scope?.materials.length || 0 : 0;
    const equipmentCount = Array.isArray(task.equipment) ? task.equipment.filter(Boolean).length : 0;
    const laborCount = getTaskRoles(task).reduce((sum, role) => sum + Number(role.count || 0), 0);

    const matchesResourceType =
      filters.resourceType === "all" ||
      (filters.resourceType === "labor" && laborCount > 0) ||
      (filters.resourceType === "materials" && materialCount > 0) ||
      (filters.resourceType === "equipment" && equipmentCount > 0);

    return matchesPhase && matchesTeam && matchesResourceType;
  });
}

export function getVisibleDateKeys(anchorDate: Date, viewMode: CalendarViewMode) {
  if (viewMode === "day") {
    const dateKey = toDateKey(anchorDate);
    return {
      dateKeys: [dateKey],
      label: dateFormatter.format(anchorDate),
    };
  }

  if (viewMode === "week") {
    const startDate = startOfUtcWeek(anchorDate);
    const dateKeys = Array.from({ length: 7 }, (_, index) => toDateKey(addUtcDays(startDate, index)));
    return {
      dateKeys,
      label: `${compactRangeFormatter.format(parseDateKey(dateKeys[0]))} - ${dateFormatter.format(parseDateKey(dateKeys[6]))}`,
    };
  }

  const startOfMonth = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth(), 1));
  const endOfMonth = new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + 1, 0));
  const gridStart = startOfUtcWeek(startOfMonth);
  const gridEnd = endOfUtcWeek(endOfMonth);
  const totalDays = Math.round((gridEnd.getTime() - gridStart.getTime()) / 86400000) + 1;
  const dateKeys = Array.from({ length: totalDays }, (_, index) => toDateKey(addUtcDays(gridStart, index)));

  return {
    dateKeys,
    label: monthFormatter.format(anchorDate),
  };
}

export function shiftCalendarAnchor(anchorDate: Date, viewMode: CalendarViewMode, direction: -1 | 1) {
  if (viewMode === "day") {
    return addUtcDays(anchorDate, direction);
  }

  if (viewMode === "week") {
    return addUtcDays(anchorDate, direction * 7);
  }

  return new Date(Date.UTC(anchorDate.getUTCFullYear(), anchorDate.getUTCMonth() + direction, 1));
}

export function aggregateCalendarDays(tasks: CalendarTaskLike[], dateKeys: string[]) {
  const visibleDays = new Map<string, CalendarDayAggregate>();
  const visibleDaySet = new Set(dateKeys);
  const firstDateKey = dateKeys[0];
  const lastDateKey = dateKeys[dateKeys.length - 1];

  dateKeys.forEach((dateKey) => {
    visibleDays.set(dateKey, emptyAggregate(dateKey));
  });

  tasks.forEach((task) => {
    if (!task.start_date || !task.end_date) {
      return;
    }

    const startDateKey = task.start_date > firstDateKey ? task.start_date : firstDateKey;
    const endDateKey = task.end_date < lastDateKey ? task.end_date : lastDateKey;

    if (startDateKey > endDateKey) {
      return;
    }

    const roles = getTaskRoles(task);
    const materials = Array.isArray(task.bom_scope?.materials)
      ? Array.from(new Set(task.bom_scope?.materials.filter(Boolean)))
      : [];
    const equipment = Array.isArray(task.equipment)
      ? Array.from(new Set(task.equipment.map((item) => item.trim()).filter(Boolean)))
      : [];
    const phase = getCalendarPhase(task);

    for (let cursor = parseDateKey(startDateKey); toDateKey(cursor) <= endDateKey; cursor = addUtcDays(cursor, 1)) {
      const dateKey = toDateKey(cursor);

      if (!visibleDaySet.has(dateKey)) {
        continue;
      }

      const day = visibleDays.get(dateKey);
      if (!day) {
        continue;
      }

      day.tasks.push(task);
      const roleTotals = new Map(day.workforceBreakdown.map((role) => [normalizeString(role.role), role]));

      roles.forEach((role) => {
        const lookupKey = normalizeString(role.role);
        const currentRole = roleTotals.get(lookupKey);

        if (currentRole) {
          currentRole.count += Number(role.count || 0);
        } else {
          const nextRole = {
            role: role.role,
            count: Number(role.count || 0),
          };
          day.workforceBreakdown.push(nextRole);
          roleTotals.set(lookupKey, nextRole);
        }

        day.totalWorkers += Number(role.count || 0);
      });

      day.materials = Array.from(new Set([...day.materials, ...materials]));
      day.equipment = Array.from(new Set([...day.equipment, ...equipment]));
      day.statuses = Array.from(new Set([...day.statuses, task.status || "pending"]));
      day.phases = Array.from(new Set([...day.phases, phase]));
    }
  });

  visibleDays.forEach((day) => {
    day.workforceBreakdown = [...day.workforceBreakdown].sort((left, right) => right.count - left.count || left.role.localeCompare(right.role));
    day.materials.sort((left, right) => left.localeCompare(right));
    day.equipment.sort((left, right) => left.localeCompare(right));
    day.tasks.sort((left, right) => left.name.localeCompare(right.name));
  });

  return visibleDays;
}