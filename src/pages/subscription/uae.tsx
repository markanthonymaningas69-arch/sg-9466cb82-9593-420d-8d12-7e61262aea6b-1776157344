import { SubscriptionPage } from "@/components/subscription/SubscriptionPage";

const PRICING = {
  starter: {
    id: "starter",
    name: "Starter",
    description: "Perfect for small construction teams",
    monthly: 299,
    annual: 2870,
    limits: { extra_site: 1, extra_acc: 0, purchasing: 0 },
    features: [
      "4 Total Users (1 GM + 3 Ready-to-assign independent seats)",
      "Up to 4 Projects in the System",
      "GM Module (Dashboard, Project Profile, Complete Accounting, Purchasing, Analytics)",
      "Included Seats: 1 Site Personnel, 1 Accounting, 1 Purchasing",
      "Add-on Capabilities (Max 1 Extra Site Personnel)",
      "Support Feature Updates"
    ]
  },
  professional: {
    id: "professional",
    name: "Professional",
    description: "For Growing Construction Businesses",
    monthly: 499,
    annual: 4790,
    popular: true,
    limits: { extra_site: 2, extra_acc: 2, purchasing: 5 },
    features: [
      "8 Total Users (1 GM + 7 Ready-to-assign independent seats)",
      "Up to 10 Projects in the System",
      "GM Module (Full Access to All Modules)",
      "Included Seats: 3 Site Personnel, 1 Accounting, 1 Purchasing, 1 HR, 1 Warehouse",
      "Add-on Capabilities (Max: 2 Extra Site, 2 Extra Accounting, 5 Extra Purchasing)",
      "Support Feature Updates"
    ]
  },
  trial: {
    id: "trial",
    name: "7-Day Trial",
    description: "Try Starter features for free",
    monthly: 0,
    annual: 0,
    limits: { extra_site: 1, extra_acc: 0, purchasing: 0 },
    features: [
      "4 Total Users (1 GM + 3 Ready-to-assign independent seats)",
      "Up to 4 Projects in the System",
      "GM Module (Dashboard, Project Profile, Complete Accounting, Purchasing, Analytics)",
      "Included Seats: 1 Site Personnel, 1 Accounting, 1 Purchasing",
      "Add-on Capabilities (Max 1 Extra Site Personnel)",
      "Support Feature Updates"
    ]
  }
};

const ADDONS = {
  extra_site: { id: "extra_site", name: "1 Site Personnel", description: "can handle 2 Projects", monthly: 49, annual: 480 },
  extra_acc: { id: "extra_acc", name: "1 Accounting", description: "Add 1 extra accounting user", monthly: 39, annual: 370 },
  purchasing: { id: "purchasing", name: "1 Purchasing", description: "Add 1 extra purchasing user", monthly: 29, annual: 275 }
};

export default function UAE() {
  return (
    <SubscriptionPage 
      country="UAE" 
      currency="AED" 
      pricing={PRICING} 
      addons={ADDONS} 
      availableCycles={["monthly", "annual"]} 
    />
  );
}