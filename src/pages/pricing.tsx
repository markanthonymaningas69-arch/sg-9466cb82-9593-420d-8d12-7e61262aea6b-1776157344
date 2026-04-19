import React, { useState } from "react";
import Link from "next/link";
import { PublicLayout } from "@/components/PublicLayout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Minus, Plus, ShoppingCart, Loader2 } from "lucide-react";
import { plans, addOns, type PlanConfig } from "@/config/pricing";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/router";

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [selectedPlan, setSelectedPlan] = useState<string>("professional");
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  // Filter out the "trial" plan for the main pricing display
  const displayPlans = plans.filter(p => p.id !== "trial");

  const getPrice = (plan: PlanConfig) => {
    return billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
  };

  const getSavings = (plan: PlanConfig) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const annualCost = plan.annualPrice;
    return monthlyCost - annualCost;
  };

  const currentPlanConfig = plans.find(p => p.id === selectedPlan) || plans[1]; // default professional

  React.useEffect(() => {
    setAddOnQuantities(prev => {
      let changed = false;
      const next = { ...prev };
      const limits = currentPlanConfig.addOnLimits || {};

      for (const id in next) {
        const limit = limits[id] || 0;
        if (next[id] > limit) {
          if (limit === 0) delete next[id];
          else next[id] = limit;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [selectedPlan, currentPlanConfig.addOnLimits]);

  const updateAddOnQuantity = (id: string, delta: number) => {
    const limit = currentPlanConfig.addOnLimits?.[id] || 0;
    setAddOnQuantities(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, Math.min(current + delta, limit));
      if (next === 0) {
        const newQs = { ...prev };
        delete newQs[id];
        return newQs;
      }
      return { ...prev, [id]: next };
    });
  };

  // Calculate Totals
  const basePrice = billingCycle === "monthly" ? currentPlanConfig.monthlyPrice : currentPlanConfig.annualPrice;

  const addOnsTotal = addOns.reduce((total, addon) => {
    const qty = addOnQuantities[addon.id] || 0;
    const price = billingCycle === "monthly" ? addon.monthlyPrice : addon.annualPrice;
    return total + (price * qty);
  }, 0);

  const totalAmount = basePrice + addOnsTotal;
  const totalAddonItems = Object.values(addOnQuantities).reduce((a, b) => a + b, 0);

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.user) {
        router.push(`/auth/register?plan=${selectedPlan}&cycle=${billingCycle}`);
        return;
      }
      
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          billingCycle,
          features: addOnQuantities,
          userId: session.user.id,
          email: session.user.email,
          returnUrl: window.location.origin + '/subscription',
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error: any) {
      toast({
        title: "Checkout Error",
        description: error.message || "An unexpected error occurred.",
        variant: "destructive"
      });
      setIsCheckingOut(false);
    }
  };

  return (
    <PublicLayout 
      title="Pricing | THEA-X Construction Accounting System" 
      description="Simple, transparent pricing for construction management."
    >
      <div className="bg-background py-16 md:py-24">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold font-heading mb-6 tracking-tight">Flexible Pricing for Every Builder</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Start with a 7-day free trial. Build your perfect package below to see your total.
            </p>
            
            {/* Global Billing Toggle */}
            <div className="inline-flex items-center justify-center gap-4 bg-muted/50 py-3 px-6 rounded-full border border-border/50 shadow-sm">
              <span className={`text-sm font-semibold ${billingCycle === "monthly" ? "text-primary" : "text-muted-foreground"}`}>
                Monthly Billing
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
                className="relative inline-flex h-7 w-12 items-center rounded-full bg-primary transition-colors focus:outline-none"
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    billingCycle === "annual" ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
              <span className={`text-sm font-semibold flex items-center gap-2 ${billingCycle === "annual" ? "text-primary" : "text-muted-foreground"}`}>
                Annual Billing
                <Badge variant="secondary" className="bg-success/15 text-success hover:bg-success/25 border-success/30 border">Save up to 20%</Badge>
              </span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto mb-16">
            {displayPlans.map((plan) => (
              <Card 
                key={plan.id} 
                className={`relative flex flex-col cursor-pointer transition-all ${
                  selectedPlan === plan.id 
                    ? "border-primary ring-2 ring-primary ring-offset-2 shadow-lg scale-[1.02] z-10" 
                    : "border-border shadow-sm hover:border-primary/50"
                }`}
                onClick={() => setSelectedPlan(plan.id)}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1 text-sm shadow-md uppercase tracking-wider font-bold">Most Popular</Badge>
                  </div>
                )}
                {selectedPlan === plan.id && !plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <Badge className="bg-foreground text-background px-4 py-1 text-sm shadow-md uppercase tracking-wider font-bold">Selected</Badge>
                  </div>
                )}
                
                <CardHeader className="pb-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-3xl font-heading">{plan.name}</CardTitle>
                      <CardDescription className="text-base mt-2">{plan.description}</CardDescription>
                    </div>
                    <div className={`h-6 w-6 rounded-full border-2 flex items-center justify-center ${selectedPlan === plan.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'}`}>
                      {selectedPlan === plan.id && <Check className="h-4 w-4 text-primary-foreground" />}
                    </div>
                  </div>
                  <div className="mt-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-5xl font-bold tracking-tight">AED {getPrice(plan)}</span>
                      <span className="text-muted-foreground font-medium">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                    </div>
                    {billingCycle === "annual" && (
                      <p className="text-sm font-semibold text-success mt-2">Save AED {getSavings(plan)} annually</p>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="flex-1 pt-4 border-t border-border/40 mx-6">
                  <ul className="space-y-4">
                    {plan.features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground leading-snug">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Add-ons Section */}
          <div className="max-w-5xl mx-auto mt-20">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold font-heading mb-4">Customize Your Plan with Add-ons</h2>
              <p className="text-muted-foreground text-lg">Need more seats? Select the exact number of add-ons you need below.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {addOns.map((addon) => {
                const qty = addOnQuantities[addon.id] || 0;
                const limit = currentPlanConfig.addOnLimits?.[addon.id] || 0;
                const isUnavailable = limit === 0;
                const isSelected = qty > 0;
                
                return (
                  <Card key={addon.id} className={`flex flex-col transition-colors ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'bg-card hover:border-primary/30'} ${isUnavailable ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                    <CardHeader className="pb-3">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-lg">{addon.name}</CardTitle>
                        {isUnavailable && <Badge variant="secondary" className="text-[10px]">Professional Only</Badge>}
                      </div>
                      <CardDescription className="text-sm">{addon.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="pb-4 flex-1">
                      <div className="text-3xl font-bold text-primary tracking-tight">
                        AED {billingCycle === "monthly" ? addon.monthlyPrice : addon.annualPrice}
                        <span className="text-base font-normal text-muted-foreground">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                      </div>
                      {!isUnavailable && <div className="text-sm text-muted-foreground mt-2 font-medium">Max Limit: {limit} seat{limit !== 1 ? 's' : ''}</div>}
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-3 border-t border-border/40 pt-4">
                      <div className="w-full mb-1 text-sm font-medium text-muted-foreground">
                        {isUnavailable ? 'Unavailable on current plan' : 'Select Quantity:'}
                      </div>
                      <div className={`flex items-center justify-between w-full border bg-background rounded-lg p-1.5 shadow-sm ${isUnavailable ? 'pointer-events-none opacity-50' : ''}`}>
                        <Button 
                          variant={qty > 0 ? "secondary" : "ghost"} 
                          size="icon" 
                          onClick={() => updateAddOnQuantity(addon.id, -1)} 
                          disabled={!qty || isUnavailable} 
                          className="h-10 w-10 shrink-0"
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <div className="flex flex-col items-center justify-center px-4">
                          <span className="text-xl font-bold">{qty}</span>
                        </div>
                        <Button 
                          variant="secondary" 
                          size="icon" 
                          onClick={() => updateAddOnQuantity(addon.id, 1)} 
                          disabled={qty >= limit || isUnavailable}
                          className="h-10 w-10 shrink-0 bg-primary/10 hover:bg-primary/20 text-primary"
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                      {isSelected && (
                        <div className="w-full text-center text-sm font-semibold text-primary mt-1">
                          Subtotal: AED {(billingCycle === "monthly" ? addon.monthlyPrice : addon.annualPrice) * qty}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Dynamic Order Summary Calculator */}
          <div className="max-w-4xl mx-auto mt-16 z-20">
            <Card className="border-primary shadow-2xl bg-card overflow-hidden ring-1 ring-primary/20">
              <div className="absolute top-0 left-0 w-2 h-full bg-primary" />
              <CardContent className="p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="flex-1 w-full">
                  <h3 className="text-2xl font-bold tracking-tight mb-3">Your Custom Plan</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center text-muted-foreground border-b pb-2">
                      <span className="font-medium text-foreground">{currentPlanConfig.name} Plan ({billingCycle})</span>
                      <span className="font-semibold text-foreground">AED {basePrice}</span>
                    </div>
                    
                    {/* List add-ons individually */}
                    {addOns.map(addon => {
                      const qty = addOnQuantities[addon.id] || 0;
                      if (qty === 0) return null;
                      
                      const price = billingCycle === "monthly" ? addon.monthlyPrice : addon.annualPrice;
                      return (
                        <div key={`list-${addon.id}`} className="flex justify-between items-center text-muted-foreground pt-1 pl-2 border-l-2 border-primary/20 ml-1">
                          <span className="text-sm">+ {qty}x {addon.name}</span>
                          <span className="font-semibold text-foreground text-sm">AED {price * qty}</span>
                        </div>
                      );
                    })}

                    {totalAddonItems > 0 && (
                      <div className="flex justify-between items-center text-muted-foreground pt-2 border-t mt-2">
                        <span className="text-xs uppercase tracking-wider font-bold">Add-ons Subtotal</span>
                        <span className="font-semibold text-foreground">AED {addOnsTotal}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-center md:items-end gap-4 w-full md:w-auto border-t md:border-t-0 pt-6 md:pt-0 pl-0 md:pl-8 md:border-l">
                  <div className="text-center md:text-right w-full">
                    <div className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-1">Total Due</div>
                    <div className="text-5xl font-black text-primary tracking-tighter">AED {totalAmount}</div>
                    <div className="text-sm font-semibold text-muted-foreground mt-1">/{billingCycle === "monthly" ? "month" : "year"}</div>
                  </div>
                  <Button 
                    size="lg" 
                    className="h-16 px-8 text-lg font-bold w-full shadow-md hover:shadow-lg transition-all"
                    onClick={handleCheckout}
                    disabled={isCheckingOut}
                  >
                    {isCheckingOut ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <ShoppingCart className="mr-2 h-6 w-6" />}
                    {isCheckingOut ? "Processing..." : "Proceed to Checkout"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

        </div>
      </div>
    </PublicLayout>
  );
}