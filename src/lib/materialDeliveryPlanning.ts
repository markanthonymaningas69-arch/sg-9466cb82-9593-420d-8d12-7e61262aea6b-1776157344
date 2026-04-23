export type MaterialDeliveryScheduleType = "one_time" | "staggered";
export type MaterialDeliveryFrequency = "daily" | "weekly" | "custom";
export type MaterialDeliveryQuantityMode = "even";

export interface MaterialDeliveryPlanInput {
  taskId: string;
  materialId: string;
  materialName: string;
  totalQuantity: number;
  unit: string;
  taskStartDate: string | null;
  taskEndDate: string | null;
  deliveryScheduleType: MaterialDeliveryScheduleType;
  deliveryStartDate: string | null;
  deliveryFrequency: MaterialDeliveryFrequency;
  deliveryDurationDays: number;
  customIntervalDays?: number | null;
  quantityMode: MaterialDeliveryQuantityMode;
}

export interface MaterialDeliveryOccurrence {
  date: string;
  quantity: number;
}

export interface MaterialDeliveryPlan {
  taskId: string;
  materialId: string;
  materialName: string;
  deliveryScheduleType: MaterialDeliveryScheduleType;
  deliveryDates: string[];
  plannedUsagePeriod: {
    startDate: string | null;
    endDate: string | null;
  };
  occurrences: MaterialDeliveryOccurrence[];
  totalQuantity: number;
  unit: string;
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function addDays(dateValue: string, days: number) {
  const date = new Date(dateValue);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getIntervalDays(
  frequency: MaterialDeliveryFrequency,
  customIntervalDays?: number | null
) {
  if (frequency === "daily") {
    return 1;
  }

  if (frequency === "weekly") {
    return 7;
  }

  return Math.max(1, Math.round(Number(customIntervalDays) || 1));
}

function getDurationDays(
  startDate: string | null,
  endDate: string | null,
  fallbackDurationDays: number
) {
  if (!startDate || !endDate) {
    return Math.max(1, fallbackDurationDays);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  const differenceMs = end.getTime() - start.getTime();
  const differenceDays = Math.floor(differenceMs / 86400000) + 1;

  return Math.max(1, differenceDays || fallbackDurationDays);
}

function buildDeliveryDates(input: MaterialDeliveryPlanInput) {
  const taskStartDate = normalizeDate(input.taskStartDate);
  const taskEndDate = normalizeDate(input.taskEndDate);
  const baseStartDate = normalizeDate(input.deliveryStartDate) || taskStartDate;

  if (!baseStartDate) {
    return [];
  }

  if (input.deliveryScheduleType === "one_time") {
    return [baseStartDate];
  }

  const durationDays = getDurationDays(taskStartDate, taskEndDate, input.deliveryDurationDays);
  const intervalDays = getIntervalDays(input.deliveryFrequency, input.customIntervalDays);
  const dates: string[] = [];

  for (let day = 0; day < durationDays; day += intervalDays) {
    dates.push(addDays(baseStartDate, day));
  }

  return dates;
}

function distributeEvenly(totalQuantity: number, numberOfDeliveries: number) {
  if (numberOfDeliveries <= 0) {
    return [];
  }

  const normalizedQuantity = Number.isFinite(totalQuantity) ? Math.max(0, totalQuantity) : 0;
  const rawPerDelivery = normalizedQuantity / numberOfDeliveries;

  return Array.from({ length: numberOfDeliveries }, (_, index) => {
    if (index === numberOfDeliveries - 1) {
      const allocatedBeforeLast = Number((rawPerDelivery * (numberOfDeliveries - 1)).toFixed(4));
      return Number((normalizedQuantity - allocatedBeforeLast).toFixed(4));
    }

    return Number(rawPerDelivery.toFixed(4));
  });
}

export function createMaterialDeliveryPlan(
  input: MaterialDeliveryPlanInput
): MaterialDeliveryPlan {
  const deliveryDates = buildDeliveryDates(input);
  const allocatedQuantities = distributeEvenly(input.totalQuantity, deliveryDates.length);
  const occurrences = deliveryDates.map((date, index) => ({
    date,
    quantity: allocatedQuantities[index] || 0,
  }));

  return {
    taskId: input.taskId,
    materialId: input.materialId,
    materialName: input.materialName,
    deliveryScheduleType: input.deliveryScheduleType,
    deliveryDates,
    plannedUsagePeriod: {
      startDate: normalizeDate(input.taskStartDate),
      endDate: normalizeDate(input.taskEndDate),
    },
    occurrences,
    totalQuantity: Number((input.totalQuantity || 0).toFixed(4)),
    unit: input.unit,
  };
}

export function createMaterialDeliveryPlans(inputs: MaterialDeliveryPlanInput[]) {
  return inputs.map((input) => createMaterialDeliveryPlan(input));
}