export type ProductivityUnit = "hour" | "day";

export interface TeamRoleAllocation {
  id: string;
  role: string;
  quantity: number;
}

export interface TaskConfiguration {
  scopeQuantity: number;
  scopeUnit: string;
  productivityOutput: number;
  productivityUnit: ProductivityUnit;
  workHoursPerDay: number;
  autoCalculateDuration: boolean;
  teamRoles: TeamRoleAllocation[];
  assignedTeamName: string;
}

interface ScopeDefaults {
  quantity?: number | null;
  unit?: string | null;
  assignedTeamName?: string | null;
}

const DEFAULT_WORK_HOURS_PER_DAY = 8;

function toPositiveNumber(value: unknown, fallback: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function toWholeNumber(value: unknown, fallback: number) {
  return Math.max(1, Math.round(toPositiveNumber(value, fallback)));
}

function createRoleId(role: string) {
  return role
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") + "-" + Math.random().toString(36).slice(2, 8);
}

export function createTeamRole(role = "Worker", quantity = 1): TeamRoleAllocation {
  return {
    id: createRoleId(role),
    role,
    quantity: toWholeNumber(quantity, 1),
  };
}

export function createDefaultTaskConfiguration(scopeDefaults?: ScopeDefaults): TaskConfiguration {
  const scopeQuantity = toPositiveNumber(scopeDefaults?.quantity, 1);

  return {
    scopeQuantity,
    scopeUnit: scopeDefaults?.unit?.trim() || "lot",
    productivityOutput: scopeQuantity,
    productivityUnit: "day",
    workHoursPerDay: DEFAULT_WORK_HOURS_PER_DAY,
    autoCalculateDuration: true,
    teamRoles: [createTeamRole("Mason", 1), createTeamRole("Helper", 1)],
    assignedTeamName: scopeDefaults?.assignedTeamName?.trim() || "",
  };
}

export function normalizeTaskConfiguration(rawValue: unknown, scopeDefaults?: ScopeDefaults): TaskConfiguration {
  const fallback = createDefaultTaskConfiguration(scopeDefaults);
  const typedValue = rawValue && typeof rawValue === "object" ? (rawValue as Partial<TaskConfiguration>) : {};
  const rawTeamRoles = Array.isArray((typedValue as { teamRoles?: unknown }).teamRoles)
    ? ((typedValue as { teamRoles?: unknown[] }).teamRoles ?? [])
    : [];

  const normalizedRoles = rawTeamRoles
    .filter((role) => Boolean(role && typeof role === "object"))
    .map((role, index) => {
      const typedRole = role as Record<string, unknown>;
      return {
        id: typeof typedRole.id === "string" && typedRole.id
          ? typedRole.id
          : createRoleId(typeof typedRole.role === "string" ? typedRole.role : "worker-" + index),
        role: typeof typedRole.role === "string" && typedRole.role.trim() ? typedRole.role.trim() : "Worker",
        quantity: toWholeNumber(typedRole.quantity, 1),
      };
    });

  return {
    scopeQuantity: toPositiveNumber(typedValue.scopeQuantity, fallback.scopeQuantity),
    scopeUnit: typeof typedValue.scopeUnit === "string" && typedValue.scopeUnit.trim()
      ? typedValue.scopeUnit.trim()
      : fallback.scopeUnit,
    productivityOutput: toPositiveNumber(typedValue.productivityOutput, fallback.productivityOutput),
    productivityUnit: typedValue.productivityUnit === "hour" ? "hour" : "day",
    workHoursPerDay: toPositiveNumber(typedValue.workHoursPerDay, fallback.workHoursPerDay),
    autoCalculateDuration: typeof typedValue.autoCalculateDuration === "boolean"
      ? typedValue.autoCalculateDuration
      : fallback.autoCalculateDuration,
    teamRoles: normalizedRoles.length > 0 ? normalizedRoles : fallback.teamRoles,
    assignedTeamName: typeof typedValue.assignedTeamName === "string"
      ? typedValue.assignedTeamName
      : fallback.assignedTeamName,
  };
}

export function calculateRequiredDurationDays(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);
  const scopeQuantity = toPositiveNumber(normalizedConfig.scopeQuantity, 1);
  const productivityOutput = toPositiveNumber(normalizedConfig.productivityOutput, scopeQuantity);
  const rawDuration = scopeQuantity / productivityOutput;

  if (normalizedConfig.productivityUnit === "day") {
    return Math.max(1, Math.ceil(rawDuration));
  }

  const workHoursPerDay = toPositiveNumber(normalizedConfig.workHoursPerDay, DEFAULT_WORK_HOURS_PER_DAY);
  return Math.max(1, Math.ceil(rawDuration / workHoursPerDay));
}

export function getProductivitySummary(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);
  const teamLabel = normalizedConfig.teamRoles
    .map((role) => role.quantity + " " + role.role)
    .join(" + ");

  return {
    teamLabel,
    outputLabel: normalizedConfig.productivityOutput + " " + normalizedConfig.scopeUnit + " per " + normalizedConfig.productivityUnit,
    durationDays: calculateRequiredDurationDays(normalizedConfig),
  };
}