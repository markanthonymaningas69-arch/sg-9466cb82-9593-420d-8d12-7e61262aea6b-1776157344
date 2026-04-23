export interface ManpowerRateCatalogItem {
  id?: string;
  positionName: string;
  dailyRate: number;
  overtimeRate: number;
}

export interface TaskLaborRoleInput {
  id: string;
  role: string;
  quantity: number;
}

export interface TaskLaborCostLine {
  roleId: string;
  role: string;
  quantity: number;
  ratePerPerson: number;
  totalDailyCost: number;
}

export interface TaskLaborCostSummary {
  lines: TaskLaborCostLine[];
  dailyLaborCost: number;
  totalLaborCost: number;
  durationDays: number;
}

function normalizeRoleLabel(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function findRateForRole(
  roleName: string,
  rates: ManpowerRateCatalogItem[]
): ManpowerRateCatalogItem | null {
  const normalizedRoleName = normalizeRoleLabel(roleName);
  return (
    rates.find((rate) => normalizeRoleLabel(rate.positionName) === normalizedRoleName) || null
  );
}

export function calculateDailyLaborCost(
  roles: TaskLaborRoleInput[],
  rates: ManpowerRateCatalogItem[]
) {
  return roles.reduce((total, role) => {
    const matchedRate = findRateForRole(role.role, rates);
    const roleDailyCost = (matchedRate?.dailyRate || 0) * Math.max(0, role.quantity);
    return total + roleDailyCost;
  }, 0);
}

export function createTaskLaborCostSummary(params: {
  roles: TaskLaborRoleInput[];
  rates: ManpowerRateCatalogItem[];
  numberOfTeams: number;
  durationDays: number;
}): TaskLaborCostSummary {
  const scaledRoles = params.roles.map((role) => ({
    ...role,
    quantity: Math.max(0, role.quantity) * Math.max(1, params.numberOfTeams),
  }));

  const lines = scaledRoles.map((role) => {
    const matchedRate = findRateForRole(role.role, params.rates);
    const ratePerPerson = matchedRate?.dailyRate || 0;
    const totalDailyCost = ratePerPerson * role.quantity;

    return {
      roleId: role.id,
      role: role.role,
      quantity: role.quantity,
      ratePerPerson,
      totalDailyCost,
    };
  });

  const dailyLaborCost = lines.reduce((total, line) => total + line.totalDailyCost, 0);
  const durationDays = Math.max(1, Math.round(params.durationDays || 1));
  const totalLaborCost = dailyLaborCost * durationDays;

  return {
    lines,
    dailyLaborCost: Number(dailyLaborCost.toFixed(2)),
    totalLaborCost: Number(totalLaborCost.toFixed(2)),
    durationDays,
  };
}