export interface TeamRoleAllocation {
  id: string;
  role: string;
  quantity: number;
}

export interface TaskConfiguration {
  scopeQuantity: number;
  scopeUnit: string;
  productivityOutput: number;
  productivityUnit: "day";
  workHoursPerDay: number;
  autoCalculateDuration: boolean;
  teamRoles: TeamRoleAllocation[];
  assignedTeamName: string;
  teamTemplateId: string;
  numberOfTeams: number;
}

interface ScopeDefaults {
  quantity?: number | null;
  unit?: string | null;
  assignedTeamName?: string | null;
}

function toPositiveNumber(value: unknown, fallback: number) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback;
}

function toWholeNumber(value: unknown, fallback: number) {
  return Math.max(1, Math.round(toPositiveNumber(value, fallback)));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function createTeamRole(role = "Worker", quantity = 1, index = 0): TeamRoleAllocation {
  const normalizedRole = role.trim() || "Worker";

  return {
    id: `${slugify(normalizedRole) || "role"}-${index + 1}`,
    role: normalizedRole,
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
    workHoursPerDay: 8,
    autoCalculateDuration: true,
    teamRoles: [createTeamRole("Mason", 1, 0), createTeamRole("Helper", 1, 1)],
    assignedTeamName: scopeDefaults?.assignedTeamName?.trim() || "",
    teamTemplateId: "",
    numberOfTeams: 1,
  };
}

export function normalizeTaskConfiguration(rawValue: unknown, scopeDefaults?: ScopeDefaults): TaskConfiguration {
  const fallback = createDefaultTaskConfiguration(scopeDefaults);
  const typedValue = rawValue && typeof rawValue === "object" ? (rawValue as Partial<TaskConfiguration>) : {};
  const rawTeamRoles = Array.isArray((typedValue as { teamRoles?: unknown }).teamRoles)
    ? ((typedValue as { teamRoles?: unknown[] }).teamRoles ?? [])
    : [];

  const normalizedRoles = rawTeamRoles
    .map((role, index) => {
      const typedRole = role && typeof role === "object" ? (role as Record<string, unknown>) : {};
      const roleName = typeof typedRole.role === "string" && typedRole.role.trim() ? typedRole.role.trim() : "Worker";

      return {
        id: typeof typedRole.id === "string" && typedRole.id ? typedRole.id : `${slugify(roleName) || "role"}-${index + 1}`,
        role: roleName,
        quantity: toWholeNumber(typedRole.quantity, 1),
      };
    })
    .filter((role) => role.role.trim().length > 0);

  return {
    scopeQuantity: toPositiveNumber(scopeDefaults?.quantity ?? typedValue.scopeQuantity, fallback.scopeQuantity),
    scopeUnit:
      typeof (scopeDefaults?.unit ?? typedValue.scopeUnit) === "string" && String(scopeDefaults?.unit ?? typedValue.scopeUnit).trim()
        ? String(scopeDefaults?.unit ?? typedValue.scopeUnit).trim()
        : fallback.scopeUnit,
    productivityOutput: toPositiveNumber(typedValue.productivityOutput, fallback.productivityOutput),
    productivityUnit: "day",
    workHoursPerDay: 8,
    autoCalculateDuration: true,
    teamRoles: normalizedRoles.length > 0 ? normalizedRoles : fallback.teamRoles,
    assignedTeamName:
      typeof typedValue.assignedTeamName === "string" && typedValue.assignedTeamName.trim()
        ? typedValue.assignedTeamName.trim()
        : fallback.assignedTeamName,
    teamTemplateId: typeof typedValue.teamTemplateId === "string" ? typedValue.teamTemplateId : fallback.teamTemplateId,
    numberOfTeams: toWholeNumber(typedValue.numberOfTeams, fallback.numberOfTeams),
  };
}

export function applyTeamTemplate(
  config: TaskConfiguration,
  template: {
    id: string;
    name: string;
    roles: Array<{ id?: string; role: string; quantity: number }>;
  }
): TaskConfiguration {
  const normalizedConfig = normalizeTaskConfiguration(config);

  return normalizeTaskConfiguration({
    ...normalizedConfig,
    teamTemplateId: template.id,
    assignedTeamName: template.name,
    teamRoles: template.roles.map((role, index) => ({
      id: role.id || `${slugify(role.role) || "role"}-${index + 1}`,
      role: role.role,
      quantity: role.quantity,
    })),
  });
}

export function calculateTotalDailyOutput(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);
  return normalizedConfig.productivityOutput * normalizedConfig.numberOfTeams;
}

export function calculateRequiredDurationDays(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);
  const scopeQuantity = toPositiveNumber(normalizedConfig.scopeQuantity, 1);
  const totalDailyOutput = calculateTotalDailyOutput(normalizedConfig);

  if (totalDailyOutput <= 0) {
    return 1;
  }

  return Math.max(1, Math.ceil(scopeQuantity / totalDailyOutput));
}

export function getTaskConfigurationValidation(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);

  return {
    teamTemplateValid: normalizedConfig.teamTemplateId.trim().length > 0,
    numberOfTeamsValid: normalizedConfig.numberOfTeams >= 1,
    productivityValid: normalizedConfig.productivityOutput > 0,
    isValid:
      normalizedConfig.teamTemplateId.trim().length > 0 &&
      normalizedConfig.numberOfTeams >= 1 &&
      normalizedConfig.productivityOutput > 0,
  };
}

export function getProductivitySummary(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);
  const teamLabel = normalizedConfig.teamRoles.map((role) => `${role.quantity} ${role.role}`).join(" + ");
  const totalDailyOutput = calculateTotalDailyOutput(normalizedConfig);

  return {
    teamLabel,
    perTeamOutputLabel: `${normalizedConfig.productivityOutput} ${normalizedConfig.scopeUnit} per team per day`,
    totalOutputLabel: `${totalDailyOutput} ${normalizedConfig.scopeUnit} per day`,
    durationDays: calculateRequiredDurationDays(normalizedConfig),
  };
}