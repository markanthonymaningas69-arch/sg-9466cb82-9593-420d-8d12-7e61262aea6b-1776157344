export type BillingCycle = "monthly" | "annual";
export type SupportedCountry = "UAE" | "Philippines";

export interface PlanConfig {
  id: "starter" | "professional" | "trial";
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  features: string[];
  addOnLimits: {
    extra_site: number;
    extra_acc: number;
    purchasing: number;
  };
  popular?: boolean;
}

export interface AddOnConfig {
  id: "extra_site" | "extra_acc" | "purchasing";
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
}

export const COUNTRY_OPTIONS = [
  "Australia",
  "Bahrain",
  "Bangladesh",
  "Bhutan",
  "Brunei",
  "Cambodia",
  "China",
  "India",
  "Indonesia",
  "Iran",
  "Iraq",
  "Israel",
  "Japan",
  "Jordan",
  "Kuwait",
  "Kyrgyzstan",
  "Laos",
  "Lebanon",
  "Malaysia",
  "Maldives",
  "Mongolia",
  "Myanmar",
  "Nepal",
  "North Korea",
  "Oman",
  "Pakistan",
  "Palestine",
  "Philippines",
  "Qatar",
  "Saudi Arabia",
  "Singapore",
  "South Korea",
  "Sri Lanka",
  "Syria",
  "Taiwan",
  "Tajikistan",
  "Thailand",
  "Timor-Leste",
  "Turkmenistan",
  "UAE",
  "Uzbekistan",
  "Vietnam",
  "Yemen"
] as const;

export type CountryOption = (typeof COUNTRY_OPTIONS)[number];

export const DEFAULT_COUNTRY: SupportedCountry = "UAE";
export const OUT_OF_SERVICE_MESSAGE = "The selected Country is out of Service";

export const plans: PlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small construction teams",
    monthlyPrice: 299,
    annualPrice: 2870,
    features: [
      "4 Total Users (1 GM + 3 Ready-to-assign independent seats)",
      "Up to 4 Projects in the System",
      "GM Module (Dashboard, Project Profile, Complete Accounting, Purchasing, Analytics)",
      "Included Seats: 1 Site Personnel, 1 Accounting, 1 Purchasing",
      "Add-on Capabilities (Max 1 Extra Site Personnel)",
      "Support Feature Updates"
    ],
    addOnLimits: { extra_site: 1, extra_acc: 0, purchasing: 0 }
  },
  {
    id: "professional",
    name: "Professional",
    description: "For Growing Construction Businesses",
    monthlyPrice: 499,
    annualPrice: 4790,
    popular: true,
    features: [
      "8 Total Users (1 GM + 7 Ready-to-assign independent seats)",
      "Up to 10 Projects in the System",
      "GM Module (Full Access to All Modules)",
      "Included Seats: 3 Site Personnel, 1 Accounting, 1 Purchasing, 1 HR, 1 Warehouse",
      "Add-on Capabilities (Max: 2 Extra Site, 2 Extra Accounting, 5 Extra Purchasing)",
      "Support Feature Updates"
    ],
    addOnLimits: { extra_site: 2, extra_acc: 2, purchasing: 5 }
  },
  {
    id: "trial",
    name: "7-Day Trial",
    description: "Try Starter features for free",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      "4 Total Users (1 GM + 3 Ready-to-assign independent seats)",
      "Up to 4 Projects in the System",
      "GM Module (Dashboard, Project Profile, Complete Accounting, Purchasing, Analytics)",
      "Included Seats: 1 Site Personnel, 1 Accounting, 1 Purchasing",
      "Add-on Capabilities (Max 1 Extra Site Personnel)",
      "Support Feature Updates"
    ],
    addOnLimits: { extra_site: 1, extra_acc: 0, purchasing: 0 }
  }
];

export const addOns: AddOnConfig[] = [
  { id: "extra_site", name: "1 Site Personnel", monthlyPrice: 49, annualPrice: 480, description: "can handle 2 Projects" },
  { id: "extra_acc", name: "1 Accounting", monthlyPrice: 39, annualPrice: 370, description: "Add 1 extra accounting user" },
  { id: "purchasing", name: "1 Purchasing", monthlyPrice: 29, annualPrice: 275, description: "Add 1 extra purchasing user" }
];

const countryPlanOverrides: Partial<Record<SupportedCountry, Partial<Record<PlanConfig["id"], Partial<Pick<PlanConfig, "monthlyPrice" | "annualPrice">>>>>> = {
  Philippines: {
    starter: {
      monthlyPrice: 299
    },
    professional: {
      monthlyPrice: 499
    },
    trial: {
      monthlyPrice: 0,
      annualPrice: 0
    }
  }
};

const countryBillingCycles: Record<SupportedCountry, BillingCycle[]> = {
  UAE: ["monthly", "annual"],
  Philippines: ["monthly"]
};

export function isSupportedCountry(country: string | null | undefined): country is SupportedCountry {
  return country === "UAE" || country === "Philippines";
}

export function getAvailableBillingCycles(country: string | null | undefined): BillingCycle[] {
  if (!isSupportedCountry(country)) {
    return countryBillingCycles[DEFAULT_COUNTRY];
  }

  return countryBillingCycles[country];
}

export function getPlanPricing(plan: PlanConfig, country: string | null | undefined): Pick<PlanConfig, "monthlyPrice" | "annualPrice"> {
  if (!isSupportedCountry(country)) {
    return {
      monthlyPrice: plan.monthlyPrice,
      annualPrice: plan.annualPrice
    };
  }

  const overrides = countryPlanOverrides[country]?.[plan.id];

  return {
    monthlyPrice: overrides?.monthlyPrice ?? plan.monthlyPrice,
    annualPrice: overrides?.annualPrice ?? plan.annualPrice
  };
}

export function getPlanPrice(plan: PlanConfig, country: string | null | undefined, billingCycle: BillingCycle): number {
  const pricing = getPlanPricing(plan, country);
  const availableBillingCycles = getAvailableBillingCycles(country);

  if (billingCycle === "annual" && availableBillingCycles.includes("annual")) {
    return pricing.annualPrice;
  }

  return pricing.monthlyPrice;
}

export function getAddOnPrice(addOn: AddOnConfig, country: string | null | undefined, billingCycle: BillingCycle): number {
  const availableBillingCycles = getAvailableBillingCycles(country);

  if (billingCycle === "annual" && availableBillingCycles.includes("annual")) {
    return addOn.annualPrice;
  }

  return addOn.monthlyPrice;
}