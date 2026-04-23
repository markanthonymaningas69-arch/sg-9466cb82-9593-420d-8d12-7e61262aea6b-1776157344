export interface PlannedTaskCost {
  taskId: string;
  projectId: string;
  bomScopeId: string | null;
  startDate: string;
  endDate: string;
  durationDays: number;
  plannedLaborCost: number;
  plannedMaterialCost: number;
}

export interface ActualCostEntry {
  date: string;
  cost: number;
}

export interface TaskProgressSnapshot {
  taskId: string;
  date: string;
  progress: number;
  plannedCost: number;
}

export interface SCurveStoredDailyValue {
  date: string;
  plannedValue: number;
  actualValue: number;
  earnedValue: number;
}

export interface SCurveDailyValue extends SCurveStoredDailyValue {
  cumulativePlannedValue: number;
  cumulativeActualValue: number;
  cumulativeEarnedValue: number;
}

export interface SCurvePerformanceIndicators {
  costVariance: number;
  scheduleVariance: number;
  costPerformanceIndex: number | null;
  schedulePerformanceIndex: number | null;
  budgetStatus: string;
  scheduleStatus: string;
}

function toNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function clampPercentage(value: number) {
  return Math.max(0, Math.min(100, value));
}

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

function addValue(map: Map<string, number>, date: string, amount: number) {
  const currentValue = map.get(date) || 0;
  map.set(date, Number((currentValue + amount).toFixed(2)));
}

export function calculateTaskPlannedCost(task: PlannedTaskCost) {
  return Number((toNumber(task.plannedLaborCost) + toNumber(task.plannedMaterialCost)).toFixed(2));
}

export function buildDailyPlannedValue(tasks: PlannedTaskCost[]) {
  const plannedByDate = new Map<string, number>();

  tasks.forEach((task) => {
    const totalPlannedCost = calculateTaskPlannedCost(task);
    const durationDays = Math.max(1, Math.round(toNumber(task.durationDays, 1)));
    const dailyPlannedValue = totalPlannedCost / durationDays;
    const startDate = parseDate(task.startDate);

    for (let offset = 0; offset < durationDays; offset += 1) {
      addValue(plannedByDate, toDateKey(addDays(startDate, offset)), dailyPlannedValue);
    }
  });

  return plannedByDate;
}

export function buildDailyActualValue(actualLaborEntries: ActualCostEntry[], actualMaterialEntries: ActualCostEntry[]) {
  const actualByDate = new Map<string, number>();

  [...actualLaborEntries, ...actualMaterialEntries].forEach((entry) => {
    addValue(actualByDate, entry.date, toNumber(entry.cost));
  });

  return actualByDate;
}

export function buildDailyEarnedValue(progressSnapshots: TaskProgressSnapshot[]) {
  const earnedByDate = new Map<string, number>();
  const taskSnapshots = new Map<string, TaskProgressSnapshot[]>();

  progressSnapshots.forEach((snapshot) => {
    const existingSnapshots = taskSnapshots.get(snapshot.taskId) || [];
    existingSnapshots.push(snapshot);
    taskSnapshots.set(snapshot.taskId, existingSnapshots);
  });

  taskSnapshots.forEach((snapshots) => {
    const orderedSnapshots = [...snapshots].sort((left, right) => left.date.localeCompare(right.date));
    let previousProgress = 0;

    orderedSnapshots.forEach((snapshot) => {
      const currentProgress = clampPercentage(toNumber(snapshot.progress));
      const incrementalProgress = Math.max(0, currentProgress - previousProgress);
      const earnedValue = snapshot.plannedCost * (incrementalProgress / 100);

      if (earnedValue > 0) {
        addValue(earnedByDate, snapshot.date, earnedValue);
      }

      previousProgress = Math.max(previousProgress, currentProgress);
    });
  });

  return earnedByDate;
}

export function buildDailySCurveSeries(input: {
  plannedTasks: PlannedTaskCost[];
  actualLaborEntries: ActualCostEntry[];
  actualMaterialEntries: ActualCostEntry[];
  progressSnapshots: TaskProgressSnapshot[];
}) {
  const plannedByDate = buildDailyPlannedValue(input.plannedTasks);
  const actualByDate = buildDailyActualValue(input.actualLaborEntries, input.actualMaterialEntries);
  const earnedByDate = buildDailyEarnedValue(input.progressSnapshots);

  const allDates = Array.from(new Set([...plannedByDate.keys(), ...actualByDate.keys(), ...earnedByDate.keys()])).sort();

  let cumulativePlannedValue = 0;
  let cumulativeActualValue = 0;
  let cumulativeEarnedValue = 0;

  return allDates.map((date) => {
    const plannedValue = Number((plannedByDate.get(date) || 0).toFixed(2));
    const actualValue = Number((actualByDate.get(date) || 0).toFixed(2));
    const earnedValue = Number((earnedByDate.get(date) || 0).toFixed(2));

    cumulativePlannedValue = Number((cumulativePlannedValue + plannedValue).toFixed(2));
    cumulativeActualValue = Number((cumulativeActualValue + actualValue).toFixed(2));
    cumulativeEarnedValue = Number((cumulativeEarnedValue + earnedValue).toFixed(2));

    return {
      date,
      plannedValue,
      actualValue,
      earnedValue,
      cumulativePlannedValue,
      cumulativeActualValue,
      cumulativeEarnedValue,
    } satisfies SCurveDailyValue;
  });
}

export function buildSeriesFromStoredRows(rows: SCurveStoredDailyValue[]) {
  const orderedRows = [...rows].sort((left, right) => left.date.localeCompare(right.date));

  let cumulativePlannedValue = 0;
  let cumulativeActualValue = 0;
  let cumulativeEarnedValue = 0;

  return orderedRows.map((row) => {
    cumulativePlannedValue = Number((cumulativePlannedValue + toNumber(row.plannedValue)).toFixed(2));
    cumulativeActualValue = Number((cumulativeActualValue + toNumber(row.actualValue)).toFixed(2));
    cumulativeEarnedValue = Number((cumulativeEarnedValue + toNumber(row.earnedValue)).toFixed(2));

    return {
      date: row.date,
      plannedValue: Number(toNumber(row.plannedValue).toFixed(2)),
      actualValue: Number(toNumber(row.actualValue).toFixed(2)),
      earnedValue: Number(toNumber(row.earnedValue).toFixed(2)),
      cumulativePlannedValue,
      cumulativeActualValue,
      cumulativeEarnedValue,
    } satisfies SCurveDailyValue;
  });
}

export function deriveSCurvePerformanceIndicators(series: SCurveDailyValue[]): SCurvePerformanceIndicators {
  const latest = series[series.length - 1];

  if (!latest) {
    return {
      costVariance: 0,
      scheduleVariance: 0,
      costPerformanceIndex: null,
      schedulePerformanceIndex: null,
      budgetStatus: "No cost data yet",
      scheduleStatus: "No schedule data yet",
    };
  }

  const costVariance = Number((latest.cumulativeEarnedValue - latest.cumulativeActualValue).toFixed(2));
  const scheduleVariance = Number((latest.cumulativeEarnedValue - latest.cumulativePlannedValue).toFixed(2));
  const costPerformanceIndex =
    latest.cumulativeActualValue > 0
      ? Number((latest.cumulativeEarnedValue / latest.cumulativeActualValue).toFixed(4))
      : null;
  const schedulePerformanceIndex =
    latest.cumulativePlannedValue > 0
      ? Number((latest.cumulativeEarnedValue / latest.cumulativePlannedValue).toFixed(4))
      : null;

  return {
    costVariance,
    scheduleVariance,
    costPerformanceIndex,
    schedulePerformanceIndex,
    budgetStatus: costVariance >= 0 ? "Project is under budget" : "Project is over budget",
    scheduleStatus: scheduleVariance >= 0 ? "Project is ahead of schedule" : "Project is behind schedule",
  };
}