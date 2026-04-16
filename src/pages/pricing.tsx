import React, { useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, PlusCircle } from "lucide-react";
import { plans, addOns, type PlanConfig } from "@/config/pricing";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");

  // Filter out the "trial" plan for the main pricing display, or keep it depending on preference.
  // We'll show the standard paid plans prominently, but mention the trial.
  const displayPlans = plans.filter(p => p.id !== "trial");

  const getPrice = (plan: PlanConfig) => {
    return billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
  };

  const getSavings = (plan: PlanConfig) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const annualCost = plan.annualPrice;
    return monthlyCost - annualCost;
  };

  return (
    <PublicLayout 
      title="Pricing | THEA-X Construction Accounting System" 
      description="Simple, transparent pricing for construction management."
    >
      <div className="bg-background py-20 md:py-32">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6">Simple, transparent pricing</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Start with a 7-day free trial. Choose the plan that best fits your construction firm's needs.
            </p>
            
            <div className="flex items-center justify-center gap-4">
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
                <Badge variant="secondary" className="ml-2 bg-success/15 text-success hover:bg-success/25 border-success/30">Save up to 20%</Badge>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-20">
            {displayPlans.map((plan) => (
              <Card key={plan.id} className={`relative flex flex-col ${plan.popular ? "border-primary shadow-xl scale-105 z-10" : "shadow-md"}`}>
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 py-1 text-sm shadow-sm">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription className="text-base">{plan.description}</CardDescription>
                  <div className="mt-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold tracking-tight">${getPrice(plan)}</span>
                      <span className="text-muted-foreground font-medium">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                    </div>
                    {billingCycle === "annual" && (
                      <p className="text-sm font-medium text-success mt-2">Save ${getSavings(plan)} annually</p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1">
                  <ul className="space-y-4">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Link href="/auth/register" className="w-full">
                    <Button 
                      size="lg" 
                      className="w-full text-base"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      Start 7-Day Free Trial
                    </Button>
                  </Link>
                </CardFooter>
              </Card>
            ))}
          </div>

          {/* Add-ons Section */}
          <div className="max-w-4xl mx-auto mt-24">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold font-heading mb-4">Flexible Add-ons</h2>
              <p className="text-muted-foreground text-lg">Customize your plan by adding exactly what you need as you grow.</p>
            </div>
            
            <div className="grid sm:grid-cols-2 gap-4">
              {addOns.map((addon) => (
                <div key={addon.id} className="flex items-center justify-between p-6 border rounded-xl bg-card hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="font-semibold text-lg">{addon.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{addon.description}</p>
                  </div>
                  <div className="text-right ml-4">
                    <div className="text-2xl font-bold text-primary">${addon.price}</div>
                    <div className="text-xs text-muted-foreground font-medium">/month</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}