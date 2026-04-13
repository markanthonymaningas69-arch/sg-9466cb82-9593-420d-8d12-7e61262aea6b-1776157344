import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, CreditCard, Calendar, Users, HardDrive, Shield } from "lucide-react";
import { useSettings } from "@/contexts/SettingsProvider";

export default function Subscription() {
  const { currentPlan, setCurrentPlan } = useSettings();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  const plans = [
    {
      id: "starter",
      name: "Starter",
      description: "Perfect for small construction teams",
      monthlyPrice: 49,
      annualPrice: 470,
      features: [
        "Full module access (except HR)",
        "Accounting: Payroll tab only",
        "1 Site personnel user account",
        "Mobile app access",
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
        "Full module access (All features)",
        "3 Site personnel user accounts",
        "1 Accounting user account",
        "1 Purchasing user account",
        "1 Human Resource user account",
        "1 Warehouse user account",
        "Priority support"
      ]
    }
  ];

  const billingHistory = [
    { date: "2026-04-01", amount: 99, status: "Paid", invoice: "INV-2026-04" },
    { date: "2026-03-01", amount: 99, status: "Paid", invoice: "INV-2026-03" },
    { date: "2026-02-01", amount: 99, status: "Paid", invoice: "INV-2026-02" },
  ];

  const getPrice = (plan: typeof plans[0]) => {
    return billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
  };

  const getSavings = (plan: typeof plans[0]) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const annualCost = plan.annualPrice;
    return monthlyCost - annualCost;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold">Subscription</h1>
          <p className="text-muted-foreground mt-1">Manage your subscription and billing</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Current Plan</CardTitle>
            <CardDescription>You are currently on the {currentPlan === "starter" ? "Starter" : "Professional"} plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold capitalize">{currentPlan}</h3>
                  <Badge variant="secondary">Active</Badge>
                </div>
                <p className="text-sm text-muted-foreground">Next billing date: May 1, 2026</p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  ${billingCycle === "monthly" 
                    ? (currentPlan === "starter" ? "49" : "99") 
                    : (currentPlan === "starter" ? "470" : "950")}
                </div>
                <p className="text-sm text-muted-foreground">per {billingCycle === "monthly" ? "month" : "year"}</p>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Unlimited</div>
                  <div className="text-sm text-muted-foreground">Projects</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <HardDrive className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Unlimited</div>
                  <div className="text-sm text-muted-foreground">Storage</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">Priority</div>
                  <div className="text-sm text-muted-foreground">Support</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="flex items-center justify-center gap-4 mb-6">
            <span className={`text-sm font-medium ${billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground"}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-primary transition-colors"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  billingCycle === "annual" ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
            <span className={`text-sm font-medium ${billingCycle === "annual" ? "text-foreground" : "text-muted-foreground"}`}>
              Annual
              <Badge variant="secondary" className="ml-2">Save up to 20%</Badge>
            </span>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <Card key={plan.id} className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-accent text-accent-foreground">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle>{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                  <div className="mt-4">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-bold">${getPrice(plan)}</span>
                      <span className="text-muted-foreground">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                    </div>
                    {billingCycle === "annual" && (
                      <p className="text-sm text-success mt-1">Save ${getSavings(plan)}/year</p>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-success shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={plan.id === currentPlan ? "secondary" : "default"}
                    disabled={plan.id === currentPlan}
                    onClick={() => setCurrentPlan(plan.id as "starter" | "professional")}
                  >
                    {plan.id === currentPlan ? "Current Plan" : "Upgrade"}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Billing History
            </CardTitle>
            <CardDescription>Your recent payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {billingHistory.map((bill, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium">{bill.invoice}</div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(bill.date).toLocaleDateString("en-US", { 
                          month: "long", 
                          day: "numeric", 
                          year: "numeric" 
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-4">
                    <div>
                      <div className="font-semibold">${bill.amount}</div>
                      <Badge variant="outline" className="text-success">
                        {bill.status}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm">Download</Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment Method</CardTitle>
            <CardDescription>Manage your payment information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-4">
                <div className="h-12 w-16 rounded bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <CreditCard className="h-6 w-6 text-white" />
                </div>
                <div>
                  <div className="font-medium">•••• •••• •••• 4242</div>
                  <div className="text-sm text-muted-foreground">Expires 12/2027</div>
                </div>
              </div>
              <Button variant="outline">Update</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}