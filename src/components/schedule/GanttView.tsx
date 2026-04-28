import type { TaskDependency } from "@/lib/schedule";

interface GanttTaskItem {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  duration_days: number | null;
  sort_order?: number | null;
  status?: string | null;
  dependencies: TaskDependency[];
}

interface GanttViewProps {
  tasks: GanttTaskItem[];
}

const DAY_WIDTH = 38;
const ROW_HEIGHT = 52;
const HEADER_HEIGHT = 40;
const LABEL_WIDTH = 280;
const BAR_HEIGHT = 30;
const BAR_HORIZONTAL_INSET = 4;
const BAR_MIN_WIDTH = 52;

const dependencyColors: Record<TaskDependency["type"], string> = {
  FS: "#2563eb",
  SS: "#0f766e",
  FF: "#9333ea",
  SF: "#ea580c",
};

function parseDate(value: string) {
  return new Date(`${value}T00:00:00.000Z`);
}

function toDateKey(date: Date) {
  return date.toISOString().split("T")[0];
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function diffInDays(startDate: Date, endDate: Date) {
  return Math.round((endDate.getTime() - startDate.getTime()) / 86400000);
}

function formatTimelineDate(value: string) {
  const date = parseDate(value);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function getTaskTone(status?: string | null) {
  if (status === "completed") {
    return "bg-emerald-500/15 border-emerald-500/30 text-emerald-700";
  }
  if (status === "in_progress") {
    return "bg-blue-500/15 border-blue-500/30 text-blue-700";
  }
  if (status === "delayed") {
    return "bg-rose-500/15 border-rose-500/30 text-rose-700";
  }
  return "bg-slate-500/10 border-slate-500/20 text-slate-700";
}

function getDependencyLabel(dependency: TaskDependency) {
  return dependency.lagDays > 0 ? `${dependency.type} +${dependency.lagDays}` : dependency.type;
}

export function GanttView({ tasks }: GanttViewProps) {
  const scheduledTasks = tasks
    .filter((task) => task.id && task.start_date && task.end_date)
    .sort((left, right) => {
      const sortDelta = Number(left.sort_order || 0) - Number(right.sort_order || 0);
      if (sortDelta !== 0) {
        return sortDelta;
      }
      return String(left.name).localeCompare(String(right.name));
    });

  if (scheduledTasks.length === 0) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">No scheduled tasks yet</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Add tasks with dates to see the dependency-aware Gantt timeline.
        </p>
      </div>
    );
  }

  const firstDate = scheduledTasks.reduce((earliest, task) => {
    const taskDate = parseDate(task.start_date || toDateKey(new Date()));
    return taskDate < earliest ? taskDate : earliest;
  }, parseDate(scheduledTasks[0].start_date || toDateKey(new Date())));

  const lastDate = scheduledTasks.reduce((latest, task) => {
    const taskDate = parseDate(task.end_date || task.start_date || toDateKey(new Date()));
    return taskDate > latest ? taskDate : latest;
  }, parseDate(scheduledTasks[0].end_date || scheduledTasks[0].start_date || toDateKey(new Date())));

  const timelineStart = addDays(firstDate, -1);
  const timelineEnd = addDays(lastDate, 2);
  const totalDays = diffInDays(timelineStart, timelineEnd) + 1;
  const dates = Array.from({ length: totalDays }, (_, index) => toDateKey(addDays(timelineStart, index)));
  const timelineWidth = dates.length * DAY_WIDTH;
  const chartHeight = HEADER_HEIGHT + scheduledTasks.length * ROW_HEIGHT;
  const rowCenterY = (rowIndex: number) => HEADER_HEIGHT + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;

  const taskGeometry = new Map(
    scheduledTasks.map((task, index) => {
      const barStart = diffInDays(timelineStart, parseDate(task.start_date || toDateKey(new Date()))) * DAY_WIDTH;
      const duration = Math.max(1, Number(task.duration_days || 1));
      const fullBarWidth = duration * DAY_WIDTH;
      const barTop = HEADER_HEIGHT + index * ROW_HEIGHT + (ROW_HEIGHT - BAR_HEIGHT) / 2;
      const barLeft = barStart + BAR_HORIZONTAL_INSET;
      const barWidth = Math.max(BAR_MIN_WIDTH, fullBarWidth - BAR_HORIZONTAL_INSET * 2);
      const connectorY = barTop + BAR_HEIGHT / 2;

      return [
        task.id,
        {
          rowIndex: index,
          startX: barStart,
          endX: barStart + fullBarWidth,
          startY: rowCenterY(index),
          barInsetTop: (ROW_HEIGHT - BAR_HEIGHT) / 2,
          barTop,
          barHeight: BAR_HEIGHT,
          barLeft,
          barWidth,
          connectorLeft: barLeft,
          connectorRight: barLeft + barWidth,
          connectorY,
        },
      ] as const;
    })
  );

  const dependencyPaths = scheduledTasks.flatMap((task) =>
    task.dependencies.map((dependency) => {
      const predecessor = taskGeometry.get(dependency.taskId);
      const successor = taskGeometry.get(task.id);

      if (!predecessor || !successor) {
        return null;
      }

      const predecessorBarLeft = predecessor.connectorLeft;
      const predecessorBarRight = predecessor.connectorRight;
      const successorBarLeft = successor.connectorLeft;
      const successorBarRight = successor.connectorRight;
      const startX =
        dependency.type === "SS" || dependency.type === "SF" ? predecessorBarLeft : predecessorBarRight;
      const endX =
        dependency.type === "SS" || dependency.type === "FS" ? successorBarLeft : successorBarRight;
      const startY = predecessor.connectorY;
      const endY = successor.connectorY;
      const horizontalGap = Math.max(16, Math.abs(endX - startX) / 2);
      const elbowX = startX + (endX >= startX ? horizontalGap : -horizontalGap);

      return {
        key: `${task.id}-${dependency.taskId}-${dependency.type}-${dependency.lagDays}`,
        color: dependencyColors[dependency.type],
        points: `${LABEL_WIDTH + startX},${startY} ${LABEL_WIDTH + elbowX},${startY} ${LABEL_WIDTH + elbowX},${endY} ${LABEL_WIDTH + endX},${endY}`,
        label: getDependencyLabel(dependency),
        labelX: LABEL_WIDTH + elbowX + (endX >= startX ? 5 : -5),
        labelY: startY === endY ? startY - 9 : Math.min(startY, endY) + Math.abs(endY - startY) / 2 - 5,
      };
    })
  ).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {(["FS", "SS", "FF", "SF"] as TaskDependency["type"][]).map((type) => (
          <div key={type} className="flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs text-muted-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: dependencyColors[type] }} />
            <span>{type} dependency</span>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <div style={{ width: LABEL_WIDTH + timelineWidth, minWidth: "100%" }} className="relative">
          <div className="sticky left-0 z-20 flex border-b bg-card">
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-card px-4"
              style={{ width: LABEL_WIDTH, height: HEADER_HEIGHT }}
            >
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Task / dependency map
              </span>
            </div>
            <div className="flex">
              {dates.map((dateKey) => (
                <div
                  key={dateKey}
                  className="flex shrink-0 flex-col items-center justify-center border-r text-[11px] text-muted-foreground"
                  style={{ width: DAY_WIDTH, height: HEADER_HEIGHT }}
                >
                  <span>{formatTimelineDate(dateKey)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="relative" style={{ height: chartHeight - HEADER_HEIGHT }}>
            <svg
              className="pointer-events-none absolute left-0 top-0 z-10"
              width={LABEL_WIDTH + timelineWidth}
              height={chartHeight}
              viewBox={`0 0 ${LABEL_WIDTH + timelineWidth} ${chartHeight}`}
              fill="none"
            >
              <defs>
                <marker
                  id="gantt-arrow"
                  markerWidth="4"
                  markerHeight="4"
                  refX="3.4"
                  refY="1.6"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0 0 L3.4 1.6 L0 3.2 Z" fill="context-stroke" />
                </marker>
              </defs>

              {dependencyPaths.map((path) => (
                <g key={path.key}>
                  <polyline
                    points={path.points}
                    stroke={path.color}
                    strokeWidth="1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                    markerEnd="url(#gantt-arrow)"
                  />
                  <rect
                    x={path.labelX - 4}
                    y={path.labelY - 11}
                    width={44}
                    height={18}
                    rx={9}
                    fill="hsl(var(--card))"
                    stroke={path.color}
                    strokeWidth="1"
                  />
                  <text
                    x={path.labelX + 18}
                    y={path.labelY + 1}
                    textAnchor="middle"
                    fontSize="9"
                    fontWeight="600"
                    fill={path.color}
                  >
                    {path.label}
                  </text>
                </g>
              ))}
            </svg>

            <div className="relative z-20">
              {scheduledTasks.map((task) => {
                const geometry = taskGeometry.get(task.id);
                if (!geometry) {
                  return null;
                }

                return (
                  <div
                    key={task.id}
                    className="flex border-b"
                    style={{ minHeight: ROW_HEIGHT }}
                  >
                    <div
                      className="sticky left-0 z-30 flex shrink-0 items-center border-r bg-card px-4"
                      style={{ width: LABEL_WIDTH }}
                    >
                      <div className="space-y-1.5">
                        <p className="text-sm font-semibold leading-tight text-foreground">{task.name}</p>
                        <div className="flex flex-wrap gap-1.5">
                          <span className={`rounded-full border px-2 py-0.5 text-[9px] font-medium ${getTaskTone(task.status)}`}>
                            {task.status?.replaceAll("_", " ") || "pending"}
                          </span>
                          {task.dependencies.map((dependency) => (
                            <span
                              key={`${task.id}-${dependency.taskId}-${dependency.type}`}
                              className="rounded-full border border-border bg-muted px-2 py-0.5 text-[9px] text-muted-foreground"
                            >
                              {getDependencyLabel(dependency)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="relative" style={{ width: timelineWidth, height: ROW_HEIGHT }}>
                      <div
                        className={`absolute flex flex-col justify-center overflow-hidden rounded-lg border px-2 py-1 shadow-sm ${getTaskTone(task.status)}`}
                        style={{
                          left: geometry.barLeft,
                          top: geometry.barInsetTop,
                          width: geometry.barWidth,
                          height: geometry.barHeight,
                        }}
                      >
                        <p className="truncate text-[10px] font-semibold leading-none">{task.name}</p>
                        {geometry.barWidth >= 128 ? (
                          <p className="mt-0.5 truncate text-[8px] leading-none opacity-75">
                            {task.start_date} → {task.end_date}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}