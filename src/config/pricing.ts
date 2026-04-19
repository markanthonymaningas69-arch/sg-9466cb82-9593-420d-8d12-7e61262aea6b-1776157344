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