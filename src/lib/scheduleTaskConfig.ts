export interface TeamRoleAllocation {
  id: string;
  role: string;
  quantity: number;
}

export type ProductivityUnit = "hour" | "day";
export type TeamRateUnit = "day" | "hour";

export interface TeamMemberConfiguration {
  id: string;
  catalogPositionId: string;
  positionName: string;
  rate: number;
  unit: TeamRateUnit;
  manualRate: boolean;
  description: string;
}

export interface TaskTeamConfiguration {
  id: string;
  teamName: string;
  numberOfTeams: number;
  members: TeamMemberConfiguration[];
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
  teamTemplateId: string;
  numberOfTeams: number;
  teams: TaskTeamConfiguration[];
}

interface ScopeDefaults {
  quantity?: number | null;
  unit?: string | null;
  assignedTeamName?: string | null;
}

interface CatalogValidationItem {
  positionName: string;
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

export function createTeamMember(positionName = "", index = 0): TeamMemberConfiguration {
  return {
    id: `member-${index + 1}`,
    catalogPositionId: "",
    positionName: positionName.trim(),
    rate: 0,
    unit: "day",
    manualRate: false,
    description: "",
  };
}

export function createTaskTeam(teamName = "Team 1", index = 0): TaskTeamConfiguration {
  return {
    id: `team-${index + 1}`,
    teamName: teamName.trim() || `Team ${index + 1}`,
    numberOfTeams: 1,
    members: [createTeamMember("", 0)],
  };
}

function normalizeTeamMember(rawValue: unknown, index: number): TeamMemberConfiguration {
  const typedValue = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};

  return {
    id:
      typeof typedValue.id === "string" && typedValue.id
        ? typedValue.id
        : `member-${index + 1}`,
    catalogPositionId:
      typeof typedValue.catalogPositionId === "string" ? typedValue.catalogPositionId : "",
    positionName:
      typeof typedValue.positionName === "string"
        ? typedValue.positionName.trim()
        : typeof typedValue.role === "string"
          ? typedValue.role.trim()
          : "",
    rate: Math.max(0, Number(typedValue.rate || 0)),
    unit: typedValue.unit === "hour" ? "hour" : "day",
    manualRate: Boolean(typedValue.manualRate),
    description: typeof typedValue.description === "string" ? typedValue.description.trim() : "",
  };
}

function normalizeTaskTeam(rawValue: unknown, index: number): TaskTeamConfiguration {
  const typedValue = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const rawMembers = Array.isArray(typedValue.members) ? typedValue.members : [];

  return {
    id:
      typeof typedValue.id === "string" && typedValue.id
        ? typedValue.id
        : `team-${index + 1}`,
    teamName:
      typeof typedValue.teamName === "string" && typedValue.teamName.trim()
        ? typedValue.teamName.trim()
        : `Team ${index + 1}`,
    numberOfTeams: toWholeNumber(typedValue.numberOfTeams, 1),
    members: rawMembers.map((member, memberIndex) => normalizeTeamMember(member, memberIndex)),
  };
}

function createLegacyTeams(rawValue: Record<string, unknown>, scopeDefaults?: ScopeDefaults) {
  const rawTeamRoles = Array.isArray(rawValue.teamRoles) ? rawValue.teamRoles : [];
  if (rawTeamRoles.length === 0) {
    return [createTaskTeam(scopeDefaults?.assignedTeamName?.trim() || "Team 1", 0)];
  }

  const members = rawTeamRoles.flatMap((role, roleIndex) => {
    const typedRole = role && typeof role === "object" ? (role as Record<string, unknown>) : {};
    const roleName = typeof typedRole.role === "string" ? typedRole.role.trim() : "Worker";
    const quantity = toWholeNumber(typedRole.quantity ?? typedRole.count, 1);

    return Array.from({ length: quantity }, (_, memberIndex) =>
      createTeamMember(roleName, roleIndex * 10 + memberIndex)
    );
  });

  return [
    {
      id: "team-1",
      teamName:
        typeof rawValue.assignedTeamName === "string" && rawValue.assignedTeamName.trim()
          ? rawValue.assignedTeamName.trim()
          : scopeDefaults?.assignedTeamName?.trim() || "Team 1",
      numberOfTeams: toWholeNumber(rawValue.numberOfTeams, 1),
      members,
    },
  ];
}

function aggregateTeamRoles(teams: TaskTeamConfiguration[]) {
  const totals = new Map<string, TeamRoleAllocation>();

  teams.forEach((team) => {
    const teamMultiplier = Math.max(1, Number(team.numberOfTeams || 1));

    team.members.forEach((member) => {
      const normalizedRole = member.positionName.trim();
      if (!normalizedRole) {
        return;
      }

      const key = normalizedRole.toLowerCase();
      const existing = totals.get(key);

      if (existing) {
        existing.quantity += teamMultiplier;
        return;
      }

      totals.set(key, {
        id: `${slugify(normalizedRole) || "role"}-${totals.size + 1}`,
        role: normalizedRole,
        quantity: teamMultiplier,
      });
    });
  });

  return Array.from(totals.values());
}

export function flattenTeamsToRoleAllocations(config: TaskConfiguration) {
  return aggregateTeamRoles(normalizeTaskConfiguration(config).teams);
}

export function getMemberDailyRate(member: TeamMemberConfiguration, workHoursPerDay: number) {
  const rate = Math.max(0, Number(member.rate || 0));
  return member.unit === "hour" ? rate * Math.max(1, Number(workHoursPerDay || 8)) : rate;
}

export function calculateTotalTeamMembers(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);

  return normalizedConfig.teams.reduce(
    (total, team) => total + team.members.length * Math.max(1, Number(team.numberOfTeams || 1)),
    0
  );
}

export function calculateTotalTeamDailyCost(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);

  return normalizedConfig.teams.reduce((total, team) => {
    const teamDailyCost = team.members.reduce(
      (memberTotal, member) => memberTotal + getMemberDailyRate(member, normalizedConfig.workHoursPerDay),
      0
    );

    return total + teamDailyCost * Math.max(1, Number(team.numberOfTeams || 1));
  }, 0);
}

export function createDefaultTaskConfiguration(scopeDefaults?: ScopeDefaults): TaskConfiguration {
  const scopeQuantity = toPositiveNumber(scopeDefaults?.quantity, 1);
  const teams = [createTaskTeam(scopeDefaults?.assignedTeamName?.trim() || "Team 1", 0)];

  return {
    scopeQuantity,
    scopeUnit: scopeDefaults?.unit?.trim() || "lot",
    productivityOutput: scopeQuantity,
    productivityUnit: "day",
    workHoursPerDay: 8,
    autoCalculateDuration: true,
    teamRoles: aggregateTeamRoles(teams),
    assignedTeamName: teams[0]?.teamName || "",
    teamTemplateId: "",
    numberOfTeams: teams.reduce((total, team) => total + team.numberOfTeams, 0),
    teams,
  };
}

export function normalizeTaskConfiguration(rawValue: unknown, scopeDefaults?: ScopeDefaults): TaskConfiguration {
  const fallback = createDefaultTaskConfiguration(scopeDefaults);
  const typedValue = rawValue && typeof rawValue === "object" ? (rawValue as Record<string, unknown>) : {};
  const rawTeams = Array.isArray(typedValue.teams) ? typedValue.teams : [];
  const teams =
    rawTeams.length > 0
      ? rawTeams.map((team, index) => normalizeTaskTeam(team, index))
      : createLegacyTeams(typedValue, scopeDefaults);

  const teamRoles = aggregateTeamRoles(teams);

  return {
    scopeQuantity: toPositiveNumber(scopeDefaults?.quantity ?? typedValue.scopeQuantity, fallback.scopeQuantity),
    scopeUnit:
      typeof (scopeDefaults?.unit ?? typedValue.scopeUnit) === "string" && String(scopeDefaults?.unit ?? typedValue.scopeUnit).trim()
        ? String(scopeDefaults?.unit ?? typedValue.scopeUnit).trim()
        : fallback.scopeUnit,
    productivityOutput: toPositiveNumber(typedValue.productivityOutput, fallback.productivityOutput),
    productivityUnit: typedValue.productivityUnit === "hour" ? "hour" : "day",
    workHoursPerDay: toWholeNumber(typedValue.workHoursPerDay, fallback.workHoursPerDay),
    autoCalculateDuration: true,
    teamRoles,
    assignedTeamName:
      teams[0]?.teamName ||
      (typeof typedValue.assignedTeamName === "string" && typedValue.assignedTeamName.trim()
        ? typedValue.assignedTeamName.trim()
        : fallback.assignedTeamName),
    teamTemplateId: "",
    numberOfTeams: teams.reduce((total, team) => total + Math.max(1, Number(team.numberOfTeams || 1)), 0),
    teams,
  };
}

export function calculateTotalDailyOutput(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);
  const perTeamPerDayOutput =
    normalizedConfig.productivityUnit === "hour"
      ? normalizedConfig.productivityOutput * normalizedConfig.workHoursPerDay
      : normalizedConfig.productivityOutput;

  return perTeamPerDayOutput * Math.max(1, normalizedConfig.numberOfTeams);
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

export function getTaskConfigurationValidation(
  config: TaskConfiguration,
  catalogItems: CatalogValidationItem[] = []
) {
  const normalizedConfig = normalizeTaskConfiguration(config);
  const catalogNames = new Set(
    catalogItems.map((item) => item.positionName.trim().toLowerCase()).filter(Boolean)
  );
  const allMembers = normalizedConfig.teams.flatMap((team) => team.members);

  const teamStructureValid =
    normalizedConfig.teams.length > 0 &&
    normalizedConfig.teams.every((team) => team.members.length > 0);

  const positionsValid =
    allMembers.length > 0 &&
    allMembers.every((member) => {
      if (!member.positionName.trim()) {
        return false;
      }

      if (catalogNames.size === 0) {
        return true;
      }

      return catalogNames.has(member.positionName.trim().toLowerCase());
    });

  const memberRatesValid = allMembers.length > 0 && allMembers.every((member) => Number(member.rate || 0) > 0);
  const numberOfTeamsValid = normalizedConfig.teams.every((team) => Number(team.numberOfTeams || 0) >= 1);
  const productivityValid = normalizedConfig.productivityOutput > 0;

  return {
    teamTemplateValid: teamStructureValid,
    teamStructureValid,
    positionsValid,
    memberRatesValid,
    numberOfTeamsValid,
    productivityValid,
    isValid:
      teamStructureValid &&
      positionsValid &&
      memberRatesValid &&
      numberOfTeamsValid &&
      productivityValid,
  };
}

export function getProductivitySummary(config: TaskConfiguration) {
  const normalizedConfig = normalizeTaskConfiguration(config);
  const teamLabel = normalizedConfig.teams
    .map((team) => `${team.teamName} × ${team.numberOfTeams}`)
    .join(", ");
  const totalDailyOutput = calculateTotalDailyOutput(normalizedConfig);

  return {
    teamLabel,
    perTeamOutputLabel:
      normalizedConfig.productivityUnit === "hour"
        ? `${normalizedConfig.productivityOutput} ${normalizedConfig.scopeUnit} per team per hour`
        : `${normalizedConfig.productivityOutput} ${normalizedConfig.scopeUnit} per team per day`,
    totalOutputLabel: `${totalDailyOutput} ${normalizedConfig.scopeUnit} per day`,
    durationDays: calculateRequiredDurationDays(normalizedConfig),
  };
}