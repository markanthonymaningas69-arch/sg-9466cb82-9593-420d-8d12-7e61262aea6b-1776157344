export type SupportedSubscriptionCurrency = "AED" | "PHP";

export interface PlanBillingSnapshot {
  userId: string;
  planId: string;
  priceAmount: number;
  currencyCode: SupportedSubscriptionCurrency;
  country: string;
  billingCycle: "monthly" | "annual";
}

const supportedCurrencyScale: Record<SupportedSubscriptionCurrency, number> = {
  AED: 100,
  PHP: 100,
};

const currencyLocaleMap: Record<SupportedSubscriptionCurrency, string> = {
  AED: "en-AE",
  PHP: "en-PH",
};

export function normalizeSubscriptionCurrency(value: string): SupportedSubscriptionCurrency {
  const normalized = value.trim().toUpperCase();

  if (normalized !== "AED" && normalized !== "PHP") {
    throw new Error("Unsupported subscription currency");
  }

  return normalized;
}

export function assertSubscriptionCurrencyMatch(
  stripeCurrency: string,
  storedCurrency: string,
): SupportedSubscriptionCurrency {
  const normalizedStripe = normalizeSubscriptionCurrency(stripeCurrency);
  const normalizedStored = normalizeSubscriptionCurrency(storedCurrency);

  if (normalizedStripe !== normalizedStored) {
    throw new Error("Currency mismatch detected");
  }

  return normalizedStored;
}

export function validateSnapshotAmount(amount: number): number {
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Invalid subscription amount");
  }

  return amount;
}

export function toStripeUnitAmount(amount: number, currencyCode: string): number {
  const normalizedCurrency = normalizeSubscriptionCurrency(currencyCode);
  const safeAmount = validateSnapshotAmount(amount);
  return Math.round(safeAmount * supportedCurrencyScale[normalizedCurrency]);
}

export function formatSubscriptionCurrency(amount: number, currencyCode: string): string {
  const normalizedCurrency = normalizeSubscriptionCurrency(currencyCode);
  const locale = currencyLocaleMap[normalizedCurrency];

  if (normalizedCurrency === "AED") {
    return "AED " + new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: normalizedCurrency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function createPlanBillingSnapshot(snapshot: PlanBillingSnapshot): PlanBillingSnapshot {
  return {
    ...snapshot,
    priceAmount: validateSnapshotAmount(snapshot.priceAmount),
    currencyCode: normalizeSubscriptionCurrency(snapshot.currencyCode),
    country: snapshot.country.trim(),
    planId: snapshot.planId.trim(),
    userId: snapshot.userId.trim(),
  };
}