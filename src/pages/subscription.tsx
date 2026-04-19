import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, CreditCard, Calendar, FolderGit2, LayoutGrid, Minus, Plus, ShoppingCart, Loader2, Users, ExternalLink } from "lucide-react";
import { useSettings } from "@/contexts/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";
import { plans, addOns, type PlanConfig } from "@/config/pricing";
import { useToast } from "@/hooks/use-toast";

export default function Subscription() {
  const { currentPlan, setCurrentPlan, isTrial, isLocked } = useSettings();
  const { toast } = useToast();
  
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  
  const [selectedPlan, setSelectedPlan] = useState<string>("professional");
  
  // Track exact quantity of each add-on
  const [addOnQuantities, setAddOnQuantities] = useState<Record<string, number>>({});
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isManagingBilling, setIsManagingBilling] = useState(false);

  useEffect(() => {
    if (currentPlan && currentPlan !== 'trial') {
      setSelectedPlan(currentPlan);
    }
  }, [currentPlan]);

  useEffect(() => {
    loadBillingHistory();
  }, []);

  const loadBillingHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    // Quick load features from localStorage to prevent visual lag
    const localFeatures = localStorage.getItem("app_subscription_features");
    if (localFeatures) {
      try {
        setSubscriptionDetails((prev: any) => ({
          ...(prev || {}),
          features: JSON.parse(localFeatures)
        }));
      } catch(e) {}
    }

    if (session?.user) {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
        
      if (data && data.length > 0) {
        const sub = data[0];
        
        // Normalize missing end_date for older records
        if (!sub.end_date && sub.start_date) {
          const d = new Date(sub.start_date);
          if (sub.amount > 1000) d.setFullYear(d.getFullYear() + 1);
          else d.setMonth(d.getMonth() + 1);
          sub.end_date = d.toISOString();
        }

        setBillingHistory(data);
        setSubscriptionDetails(sub);
        
        if (sub.features) {
          localStorage.setItem("app_subscription_features", JSON.stringify(sub.features));
        }
      } else {
        // Fallback for new accounts
        const now = new Date();
        const end = new Date(now);
        end.setMonth(end.getMonth() + 1);
        
        setSubscriptionDetails({
          start_date: now.toISOString(),
          end_date: end.toISOString(),
          status: "active",
          amount: currentPlan === 'starter' ? 299 : 499
        });
      }
    }
  };

  const getPrice = (plan: PlanConfig) => {
    return billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
  };

  const getSavings = (plan: PlanConfig) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const annualCost = plan.annualPrice;
    return monthlyCost - annualCost;
  };

  const getExpirationDate = (dateStr?: string, endStr?: string) => {
    if (endStr) return new Date(endStr).toLocaleDateString();
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (billingCycle === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date.toLocaleDateString();
  };

  const selectedPlanConfig = plans.find(p => p.id === selectedPlan) || plans.find(p => p.id === "professional")!;

  const updateAddOnQuantity = (id: string, delta: number) => {
    const limit = selectedPlanConfig.addOnLimits?.[id] || 0;
    const activeQty = (subscriptionDetails?.features && subscriptionDetails.features[id]) || 0;
    
    setAddOnQuantities(prev => {
      const currentNew = prev[id] || 0;
      const nextNew = currentNew + delta;
      
      // Do not allow negative cart values
      if (nextNew < 0) return prev;
      // Do not allow active + new to exceed plan limit
      if (activeQty + nextNew > limit) return prev;
      
      if (nextNew === 0) {
        const newQs = { ...prev };
        delete newQs[id];
        return newQs;
      }
      return { ...prev, [id]: nextNew };
    });
  };

  const handleUpgrade = async (planId: string) => {
    if (planId === "trial") return;
    setSelectedPlan(planId);
    
    setTimeout(() => {
      window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }, 100);
    
    toast({
      title: "Plan Selected",
      description: `You have selected the ${planId} plan. Please review your summary below and proceed to checkout.`,
    });
  };

  const handleCheckout = async () => {
    setIsCheckingOut(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast({
          title: "Error",
          description: "You must be logged in to checkout.",
          variant: "destructive"
        });
        setIsCheckingOut(false);
        return;
      }

      // Calculate final active features by merging active + cart
      const finalFeatures = { ...(subscriptionDetails?.features || {}) };
      for (const [id, newQty] of Object.entries(addOnQuantities)) {
        finalFeatures[id] = Number(finalFeatures[id] || 0) + Number(newQty);
      }

      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan,
          billingCycle,
          features: finalFeatures,
          userId: session.user.id,
          email: session.user.email,
          returnUrl: window.location.origin + '/subscription',
        }),
      });

      const data = await response.json();
      
      if (data.url) {
        // Stripe blocks iframes (like our preview). Open in new tab if in iframe.
        if (window.self !== window.top) {
          window.open(data.url, '_blank');
          setIsCheckingOut(false);
          toast({
            title: "Checkout Opened",
            description: "Stripe Checkout has opened securely in a new tab.",
          });
        } else {
          window.location.href = data.url; // Normal redirect for production
        }
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (error: any) {
      console.error("Checkout Error:", error);
      toast({
        title: "Checkout Error",
        description: error.message || "An unexpected error occurred. Check if Stripe keys are set.",
        variant: "destructive"
      });
      setIsCheckingOut(false);
    }
  };

  const handleManageBilling = async () => {
    setIsManagingBilling(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("Not logged in");
      
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: session.user.id,
          returnUrl: window.location.origin + '/subscription',
        }),
      });

      const data = await response.json();
      if (data.url) {
        if (window.self !== window.top) {
          window.open(data.url, '_blank');
          setIsManagingBilling(false);
          toast({
            title: "Portal Opened",
            description: "Stripe Billing Portal has opened securely in a new tab.",
          });
        } else {
          window.location.href = data.url;
        }
      } else {
        throw new Error(data.error || "Failed to access billing portal. No Stripe customer found.");
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
      setIsManagingBilling(false);
    }
  };

  // --- PRORATION & TOTALS CALCULATION ---
  const isCurrentlyTrial = (currentPlan as string) === "trial" || isTrial;
  const hasActiveSub = subscriptionDetails?.status === "active" && !isCurrentlyTrial;
  
  const activeAmount = Number(subscriptionDetails?.amount) || 0;
  const isActiveAnnual = activeAmount > 1000;
  const isSelectingSamePlanAndCycle = subscriptionDetails?.plan === selectedPlan && (billingCycle === "annual") === isActiveAnnual;

  const basePrice = billingCycle === "monthly" ? selectedPlanConfig.monthlyPrice : selectedPlanConfig.annualPrice;
  
  // Only charge base price if they are upgrading/changing plans or cycle, or don't have an active one
  const basePriceToCharge = (!hasActiveSub || !isSelectingSamePlanAndCycle) ? basePrice : 0;

  let proratedDiscount = 0;
  let daysRemaining = 0;

  // If they have an active sub, are choosing a different plan/cycle, and are paying a new base price
  if (hasActiveSub && !isSelectingSamePlanAndCycle && subscriptionDetails?.end_date && basePriceToCharge > 0) {
    const end = new Date(subscriptionDetails.end_date);
    const start = new Date(subscriptionDetails.start_date);
    const now = new Date();
    
    if (end > now) {
      daysRemaining = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const totalDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) || 30;
      
      const dailyRate = activeAmount / totalDays;
      proratedDiscount = Math.floor(daysRemaining * dailyRate);
      
      // Do not allow discount to exceed the new plan's cost
      if (proratedDiscount > basePriceToCharge) {
        proratedDiscount = basePriceToCharge;
      }
    }
  }

  // Math to strictly calculate only NEWLY added add-ons to charge today
  const addOnsToChargeTotal = addOns.reduce((total, addon) => {
    const newQty = Number(addOnQuantities[addon.id] || 0);
    const price = billingCycle === "monthly" ? addon.monthlyPrice : addon.annualPrice;
    return total + (price * newQty);
  }, 0);

  const totalAmountDueToday = Math.max(0, basePriceToCharge - proratedDiscount) + addOnsToChargeTotal;
  
  // User count calculations
  const addOnUsersCount = subscriptionDetails?.features 
    ? Number(Object.values(subscriptionDetails.features).reduce((a: any, b: any) => Number(a) + Number(b), 0))
    : 0;
    
  const baseUsersCount = currentPlan === 'starter' ? 3 : 8;
  const totalUsersCount = baseUsersCount + addOnUsersCount;

  return (
    <Layout>
      <div className="space-y-8 pb-12">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Subscription & Billing</h1>
            <p className="text-muted-foreground mt-1">Manage your plan, add-ons, and payment methods.</p>
          </div>
          {subscriptionDetails?.stripe_customer_id && (
            <Button variant="outline" onClick={handleManageBilling} disabled={isManagingBilling}>
              {isManagingBilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ExternalLink className="mr-2 h-4 w-4" />}
              Manage Billing Settings
            </Button>
          )}
        </div>

        <Card className="bg-card/50">
          <CardHeader>
            <CardTitle>Current Plan Status</CardTitle>
            <CardDescription>You are currently on the {isTrial ? "7-Day Trial" : (currentPlan === "starter" ? "Starter" : "Professional")} plan</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl font-bold capitalize">{isTrial ? "7-Day Trial" : currentPlan}</h3>
                  <Badge variant={isLocked ? "destructive" : "secondary"}>{isLocked ? "Expired" : "Active"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <span>Since: {subscriptionDetails?.start_date ? new Date(subscriptionDetails.start_date).toLocaleDateString() : 'N/A'}</span>
                  <span>•</span>
                  <span className={isLocked ? "text-destructive font-medium" : "text-primary font-medium"}>
                    Expires: {getExpirationDate(subscriptionDetails?.start_date, subscriptionDetails?.end_date)}
                  </span>
                </p>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold">
                  AED {activeAmount || basePrice}
                </div>
                <p className="text-sm text-muted-foreground">per {isActiveAnnual ? "year" : "month"}</p>
              </div>
            </div>
            <Separator />
            <div className="grid gap-4 md:grid-cols-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderGit2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{currentPlan === 'starter' ? 'Up to 4' : 'Up to 10'}</div>
                  <div className="text-sm text-muted-foreground">Total Projects</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{currentPlan === 'starter' ? '5 Modules' : 'All 8 Modules'}</div>
                  <div className="text-sm text-muted-foreground">Included System Access</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{totalUsersCount} Total Users</div>
                  <div className="text-sm text-muted-foreground">Active Independent Accounts</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Plus className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">
                    {addOnUsersCount} Configured
                  </div>
                  <div className="text-sm text-muted-foreground">Active Add-on Seats</div>
                </div>
              </div>
            </div>

            {/* Display explicit active add-ons if they exist */}
            {subscriptionDetails?.features && Object.keys(subscriptionDetails.features).length > 0 && (
              <>
                <Separator className="my-4" />
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Active Add-on Seats</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {Object.entries(subscriptionDetails.features).map(([id, qty]) => {
                      const addonInfo = addOns.find(a => a.id === id);
                      if (!addonInfo || !qty) return null;
                      return (
                        <div key={id} className="bg-primary/5 border border-primary/10 rounded-lg p-3 flex flex-col items-center justify-center text-center">
                          <span className="text-2xl font-bold text-primary">{String(qty)}</span>
                          <span className="text-xs font-medium text-muted-foreground mt-1">{addonInfo.name}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Global Billing Toggle */}
        <div className="flex items-center justify-center gap-4 bg-muted/30 py-4 rounded-xl border border-border/50">
          <span className={`text-sm font-semibold ${billingCycle === "monthly" ? "text-primary" : "text-muted-foreground"}`}>
            Monthly Billing
          </span>
          <button
            onClick={() => setBillingCycle(billingCycle === "monthly" ? "annual" : "monthly")}
            className="relative inline-flex h-7 w-12 items-center rounded-full bg-primary transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2"
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                billingCycle === "annual" ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
          <span className={`text-sm font-semibold flex items-center gap-2 ${billingCycle === "annual" ? "text-primary" : "text-muted-foreground"}`}>
            Annual Billing
            <Badge variant="secondary" className="bg-success/15 text-success hover:bg-success/25 border-success/30">Save up to 20%</Badge>
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className={`relative flex flex-col ${plan.id === selectedPlan ? "border-primary shadow-md ring-2 ring-primary ring-offset-1 z-10" : "border-border shadow-sm"} ${plan.popular ? "border-primary/60" : ""}`}>
              {plan.popular && plan.id !== selectedPlan && plan.id !== currentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <Badge className="bg-primary text-primary-foreground">Most Popular</Badge>
                </div>
              )}
              {plan.id === currentPlan && !isTrial && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <Badge className="bg-success text-success-foreground">Current Plan</Badge>
                </div>
              )}
              {plan.id === selectedPlan && plan.id !== currentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20">
                  <Badge className="bg-foreground text-background">Selected to Buy</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
                <div className="mt-4">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold tracking-tight">AED {getPrice(plan)}</span>
                    <span className="text-muted-foreground font-medium">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                  </div>
                  {billingCycle === "annual" && plan.id !== "trial" && (
                    <p className="text-sm text-success mt-1 font-medium">Save AED {getSavings(plan)}/year</p>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1">
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Check className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
              <CardFooter>
                <Button
                  className="w-full font-semibold"
                  variant={plan.id === selectedPlan ? "secondary" : "default"}
                  disabled={plan.id === "trial"}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {plan.id === "trial" 
                    ? (isTrial ? (isLocked ? "Expired" : "Active Trial") : "Trial Used") 
                    : (plan.id === selectedPlan ? "Selected" : "Select Plan")}
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>

        <div className="mt-12 pt-8 border-t">
          <div className="mb-6">
            <h2 className="text-2xl font-bold font-heading">Add-Ons</h2>
            <p className="text-muted-foreground">Enhance your existing plan with additional module seats.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {addOns.map((addon) => {
              const newQty = Number(addOnQuantities[addon.id] || 0);
              const activeQty = Number((subscriptionDetails?.features && subscriptionDetails.features[addon.id]) || 0);
              const limit = Number(selectedPlanConfig.addOnLimits?.[addon.id] || 0);
              const isUnavailable = limit === 0 || activeQty >= limit;
              const isSelected = newQty > 0;
              
              return (
                <Card key={addon.id} className={`flex flex-col transition-colors ${isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : ''} ${isUnavailable ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex justify-between items-start">
                      <CardTitle className="text-lg">{addon.name}</CardTitle>
                      {isUnavailable && <Badge variant="secondary" className="text-[10px]">Max Reached</Badge>}
                    </div>
                    <CardDescription className="text-sm">{addon.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4 flex-1">
                    <div className="text-3xl font-bold text-primary tracking-tight">
                      AED {billingCycle === "monthly" ? addon.monthlyPrice : addon.annualPrice}
                      <span className="text-base font-medium text-muted-foreground">/{billingCycle === "monthly" ? "mo" : "yr"}</span>
                    </div>
                    {!isUnavailable && <div className="text-sm text-muted-foreground mt-2 font-medium">Max Limit: {limit} seat{limit !== 1 ? 's' : ''} {activeQty > 0 ? `(${activeQty} active)` : ''}</div>}
                  </CardContent>
                  <CardFooter className="flex-col items-start gap-3">
                    <div className={`flex items-center justify-between w-full border bg-background rounded-lg p-1.5 shadow-sm ${isUnavailable ? 'pointer-events-none opacity-50' : ''}`}>
                      <Button 
                        variant={newQty > 0 ? "secondary" : "ghost"} 
                        size="icon" 
                        onClick={() => updateAddOnQuantity(addon.id, -1)} 
                        disabled={newQty === 0 || isUnavailable} 
                        className="h-8 w-8 shrink-0"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <div className="flex flex-col items-center justify-center px-4 min-w-[3rem]">
                        <span className="text-lg font-bold">{newQty}</span>
                        <span className="text-[10px] uppercase text-muted-foreground font-semibold leading-none">Seats</span>
                      </div>
                      <Button 
                        variant="secondary" 
                        size="icon" 
                        onClick={() => updateAddOnQuantity(addon.id, 1)} 
                        disabled={(activeQty + newQty) >= limit || isUnavailable}
                        className="h-8 w-8 shrink-0 bg-primary/10 hover:bg-primary/20 text-primary"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    {isSelected && (
                      <div className="w-full text-center text-sm font-medium text-primary">
                        Subtotal: AED {(billingCycle === "monthly" ? addon.monthlyPrice : addon.annualPrice) * newQty}
                      </div>
                    )}
                  </CardFooter>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Dynamic Order Summary & Checkout */}
        <div className="mt-8 border-t pt-8 z-10">
          <Card className="border-primary/30 shadow-xl bg-card overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-primary" />
            <CardContent className="p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex-1 w-full">
                <h3 className="text-2xl font-bold tracking-tight">Order Summary</h3>
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-muted-foreground max-w-sm">
                    <span>{selectedPlanConfig.name} Plan ({billingCycle}) {isSelectingSamePlanAndCycle && <Badge variant="outline" className="ml-2 text-[10px] bg-success/10 text-success border-success/20">Already Active</Badge>}</span>
                    <span className="font-medium text-foreground">
                      {isSelectingSamePlanAndCycle ? "AED 0" : `AED ${basePriceToCharge}`}
                    </span>
                  </div>
                  
                  {/* List newly added add-ons individually */}
                  {addOns.map(addon => {
                    const newQty = addOnQuantities[addon.id] || 0;
                    
                    if (newQty === 0) return null;
                    
                    const price = billingCycle === "monthly" ? addon.monthlyPrice : addon.annualPrice;
                    return (
                      <div key={`new-${addon.id}`} className="flex justify-between text-muted-foreground max-w-sm pl-2 border-l-2 border-primary/20 ml-1">
                        <span className="text-sm">+ {newQty}x {addon.name}</span>
                        <span className="font-medium text-foreground text-sm">AED {price * newQty}</span>
                      </div>
                    );
                  })}

                  {/* Show Prorated Discount if applicable */}
                  {proratedDiscount > 0 && (
                    <div className="flex justify-between text-success max-w-sm mt-2 pt-2 border-t border-success/20">
                      <span className="font-medium">Unused Balance Credit ({daysRemaining} days)</span>
                      <span className="font-bold">- AED {proratedDiscount}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-6 w-full md:w-auto border-t md:border-t-0 pt-4 md:pt-0">
                <div className="text-center md:text-right w-full md:w-auto">
                  <div className="text-sm text-muted-foreground font-medium uppercase tracking-wider mb-1">Due Today</div>
                  <div className="text-4xl font-bold text-primary tracking-tight">AED {totalAmountDueToday}</div>
                  <div className="text-sm font-medium text-muted-foreground mt-1">/{billingCycle === "monthly" ? "mo" : "yr"}</div>
                </div>
                <Button 
                  size="lg" 
                  className="h-16 px-8 text-lg font-bold w-full sm:w-auto shadow-md hover:shadow-lg transition-all"
                  onClick={handleCheckout}
                  disabled={isCheckingOut || totalAmountDueToday === 0}
                >
                  {isCheckingOut ? (
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  ) : (
                    <ShoppingCart className="mr-2 h-6 w-6" />
                  )}
                  {isCheckingOut ? "Processing..." : "Confirm & Pay"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Existing Billing History below */}
        <div className="mt-12 space-y-6">
          <h2 className="text-2xl font-bold font-heading">Payment History</h2>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-muted-foreground" />
                Recent Transactions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {billingHistory.length > 0 ? billingHistory.map((bill, index) => (
                  <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <div className="font-semibold capitalize">{bill.plan} Plan</div>
                        <div className="text-sm text-muted-foreground">
                          {new Date(bill.start_date).toLocaleDateString("en-US", { 
                            month: "long", 
                            day: "numeric", 
                            year: "numeric" 
                          })}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex items-center gap-4">
                      <div>
                        <div className="font-bold text-lg">AED {bill.amount}</div>
                        <Badge variant="outline" className="text-success capitalize mt-1">
                          {bill.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-8 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                    No billing history available yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>
    </Layout>
  );
}