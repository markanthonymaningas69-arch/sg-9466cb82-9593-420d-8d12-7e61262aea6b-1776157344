export type PlanConfig = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
  addOnLimits: Record<string, number>;
};

export type AddOnConfig = {
  id: string;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  description: string;
};

export const plans: PlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small construction teams",
    monthlyPrice: 299,
    annualPrice: 2870,
    features: [
      "Up to 4 Projects in the System",
      "GM module (Dashboard, Project Profile, Site Personnel, Purchasing, Complete Accounting Module, Analytics)",
      "1 Project Profile User Account",
      "1 Site Personnel User Account (can handle 2 Projects)",
      "1 Combined Accounting-Purchasing User Account",
      "Add-ons Capability (1 Site Personnel-Can handle 2Projects)",
      "Support Feature Updates",
      "❌ No HR Module",
      "❌ No Warehouse Module"
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
      "Up to 10 Projects in the System",
      "GM module (Dashboard, Project Profile, Site Personnel, Purchasing, Complete Accounting Module, HR, Warehouse, Analytics)",
      "1 Project Profile User Account",
      "3 Site Personnel User Account (can handle 6 Projects)",
      "1 Accounting User Account (Full Access)",
      "1 Purchasing User Account",
      "1 Human Resources User Account",
      "1 Warehouse User Account",
      "Support Feature Updates",
      "Add-ons Capabilities (2 Site Personnel, 2 Accounting, 5 Purchasing)"
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
      "Up to 4 Projects in the System",
      "GM module (Dashboard, Project Profile, Site Personnel, Purchasing, Complete Accounting Module, Analytics)",
      "1 Project Profile User Account",
      "1 Site Personnel User Account (can handle 2 Projects)",
      "1 Combined Accounting-Purchasing User Account",
      "Add-ons Capability (1 Site Personnel-Can handle 2Projects)",
      "Support Feature Updates",
      "❌ No HR Module",
      "❌ No Warehouse Module"
    ],
    addOnLimits: { extra_site: 1, extra_acc: 0, purchasing: 0 }
  }
];

export const addOns: AddOnConfig[] = [
  { id: "extra_site", name: "1 Site Personnel", monthlyPrice: 49, annualPrice: 480, description: "can handle 2 Projects" },
  { id: "extra_acc", name: "1 Accounting", monthlyPrice: 39, annualPrice: 370, description: "Add 1 extra accounting user" },
  { id: "purchasing", name: "1 Purchasing", monthlyPrice: 29, annualPrice: 275, description: "Add 1 extra purchasing user" }
];