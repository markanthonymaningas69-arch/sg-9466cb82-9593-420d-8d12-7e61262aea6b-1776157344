import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Check, CreditCard, Calendar, Users, HardDrive, Shield, PlusCircle, FolderGit2, LayoutGrid } from "lucide-react";
import { useSettings } from "@/contexts/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";

export default function Subscription() {
  const { currentPlan, setCurrentPlan, isTrial, isLocked } = useSettings();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "annual">("monthly");
  const [billingHistory, setBillingHistory] = useState<any[]>([]);
  const [subscriptionDetails, setSubscriptionDetails] = useState<any>(null);
  const [activeAddOns, setActiveAddOns] = useState<string[]>([]);

  useEffect(() => {
    loadBillingHistory();
  }, []);

  const loadBillingHistory = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false });
        
      if (data && data.length > 0) {
        setBillingHistory(data);
        setSubscriptionDetails(data[0]);
      } else {
        // Fallback for new accounts
        setSubscriptionDetails({
          start_date: new Date().toISOString(),
          status: "active",
          amount: currentPlan === 'starter' ? 49 : 99
        });
      }
    }
  };

  const plans = [
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

  const getPrice = (plan: typeof plans[0]) => {
    return billingCycle === "monthly" ? plan.monthlyPrice : plan.annualPrice;
  };

  const getSavings = (plan: typeof plans[0]) => {
    const monthlyCost = plan.monthlyPrice * 12;
    const annualCost = plan.annualPrice;
    return monthlyCost - annualCost;
  };

  const getExpirationDate = (dateStr?: string) => {
    if (!dateStr) return 'N/A';
    const date = new Date(dateStr);
    if (billingCycle === 'monthly') {
      date.setMonth(date.getMonth() + 1);
    } else {
      date.setFullYear(date.getFullYear() + 1);
    }
    return date.toLocaleDateString();
  };

  const addOns = [
    { id: "extra_site", name: "Extra Site Personnel Seat", price: 15, description: "Add 1 extra user to the Site Personnel module" },
    { id: "extra_acc", name: "Extra Accounting Seat", price: 25, description: "Add 1 extra user to the Accounting module" },
    { id: "hr_module", name: "Human Resources Module", price: 35, description: "Unlock HR module on the Starter Plan" },
    { id: "purchasing", name: "Purchasing Seat", price: 20, description: "Add 1 extra user to the Purchasing module" }
  ];

  const toggleAddOn = (id: string) => {
    if (activeAddOns.includes(id)) {
      setActiveAddOns(activeAddOns.filter(a => a !== id));
    } else {
      setActiveAddOns([...activeAddOns, id]);
    }
  };

  const handleUpgrade = async (planId: string) => {
    if (planId === "trial") return;

    setCurrentPlan(planId as "starter" | "professional");
    localStorage.setItem("app_is_paid", "true"); // Mark as paid to remove trial lock
    
    // Set expiration date
    const now = new Date();
    const expiresAt = new Date(now);
    if (billingCycle === "monthly") {
      expiresAt.setMonth(expiresAt.getMonth() + 1);
    } else {
      expiresAt.setFullYear(expiresAt.getFullYear() + 1);
    }
    localStorage.setItem("app_subscription_expires_at", expiresAt.toISOString());

    // Log the billing history
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const planConfig = plans.find(p => p.id === planId);
      const amount = billingCycle === "monthly" ? planConfig?.monthlyPrice : planConfig?.annualPrice;
      
      const newSub = {
        user_id: session.user.id,
        plan: planId,
        status: 'active',
        start_date: new Date().toISOString(),
        amount: amount || 0,
      };
      
      await supabase.from('subscriptions').insert(newSub);
      loadBillingHistory();
      
      // Reload to update the global lock state
      window.location.reload();
    }
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
            <CardDescription>You are currently on the {isTrial ? "Professional Trial" : (currentPlan === "starter" ? "Starter" : "Professional")} plan</CardDescription>
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
                    Expires: {getExpirationDate(subscriptionDetails?.start_date)}
                  </span>
                </p>
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
                  <FolderGit2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{currentPlan === 'starter' ? 'Up to 2' : 'Unlimited'}</div>
                  <div className="text-sm text-muted-foreground">Total Projects</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{currentPlan === 'starter' ? '4 Base' : 'All 5'}</div>
                  <div className="text-sm text-muted-foreground">Included Modules</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <PlusCircle className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="font-medium">{activeAddOns.length} Active</div>
                  <div className="text-sm text-muted-foreground">Added Modules</div>
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
                    variant={plan.id === currentPlan && !isTrial ? "secondary" : "default"}
                    disabled={plan.id === "trial" || (plan.id === currentPlan && !isTrial)}
                    onClick={() => handleUpgrade(plan.id)}
                  >
                    {plan.id === "trial" 
                      ? (isTrial ? (isLocked ? "Expired" : "Active Trial") : "Used") 
                      : (plan.id === currentPlan && !isTrial ? "Current Plan" : "Upgrade")}
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t">
          <div className="mb-6">
            <h2 className="text-2xl font-bold font-heading">Add-Ons</h2>
            <p className="text-muted-foreground">Enhance your existing plan with additional module seats.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {addOns.map((addon) => (
              <Card key={addon.id} className={`flex flex-col transition-colors ${activeAddOns.includes(addon.id) ? 'border-primary bg-primary/5' : ''}`}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{addon.name}</CardTitle>
                  <CardDescription className="text-xs">{addon.description}</CardDescription>
                </CardHeader>
                <CardContent className="pb-3 flex-1">
                  <div className="text-2xl font-bold text-primary">
                    ${addon.price}<span className="text-sm font-normal text-muted-foreground">/mo</span>
                  </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2">
                  {activeAddOns.includes(addon.id) ? (
                    <>
                      <Badge variant="default" className="w-full justify-center py-1.5 cursor-pointer" onClick={() => toggleAddOn(addon.id)}>Added (Click to Remove)</Badge>
                      <p className="text-xs text-muted-foreground text-center w-full font-medium">Expires: {getExpirationDate(subscriptionDetails?.start_date)}</p>
                    </>
                  ) : (
                    <Button variant="outline" className="w-full h-8 text-xs flex items-center gap-1" onClick={() => toggleAddOn(addon.id)}>
                      <PlusCircle className="h-3 w-3" /> Add to Plan
                    </Button>
                  )}
                </CardFooter>
              </Card>
            ))}
          </div>
        </div>

        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Billing History
            </CardTitle>
            <CardDescription>Your recent payment transactions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {billingHistory.length > 0 ? billingHistory.map((bill, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <div className="font-medium capitalize">{bill.plan} Plan</div>
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
                      <div className="font-semibold">${bill.amount}</div>
                      <Badge variant="outline" className="text-success capitalize">
                        {bill.status}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm">Receipt</Button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-6 text-muted-foreground">
                  No billing history available yet.
                </div>
              )}
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