export type PlanConfig = {
  id: string;
  name: string;
  description: string;
  monthlyPrice: number;
  annualPrice: number;
  popular?: boolean;
  features: string[];
};

export type AddOnConfig = {
  id: string;
  name: string;
  price: number;
  description: string;
};

export const plans: PlanConfig[] = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small construction teams",
    monthlyPrice: 49,
    annualPrice: 470,
    features: [
      "Up to 2 Projects",
      "4 Base Modules Included",
      "Accounting: Payroll tab only",
      "1 Site personnel user account",
      "Email support"
    ]
  },
  {
    id: "professional",
    name: "Professional",
    description: "For growing construction businesses",
    monthlyPrice: 99,
    annualPrice: 950,
    popular: true,
    features: [
      "Unlimited Projects",
      "All 5 Modules Included",
      "Add-ons Capability Included",
      "3 Site personnel user accounts",
      "1 User per additional module"
    ]
  },
  {
    id: "trial",
    name: "7-Day Trial",
    description: "Try Professional features for free",
    monthlyPrice: 0,
    annualPrice: 0,
    features: [
      "Unlimited Projects",
      "All 5 Modules Included",
      "Add-ons Capability Included",
      "3 Site personnel user accounts",
      "1 User per additional module"
    ]
  }
];

export const addOns: AddOnConfig[] = [
  { id: "extra_site", name: "Extra Site Personnel Seat", price: 15, description: "Add 1 extra user to the Site Personnel module" },
  { id: "extra_acc", name: "Extra Accounting Seat", price: 25, description: "Add 1 extra user to the Accounting module" },
  { id: "hr_module", name: "Human Resources Module", price: 35, description: "Unlock HR module on the Starter Plan" },
  { id: "purchasing", name: "Purchasing Seat", price: 20, description: "Add 1 extra user to the Purchasing module" }
];