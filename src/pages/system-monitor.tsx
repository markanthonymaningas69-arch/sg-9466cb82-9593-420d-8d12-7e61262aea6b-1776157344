import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Server, Package, ArrowUpRight, Loader2, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeSwitch } from "@/components/ThemeSwitch";

export default function SystemMonitor() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ companies: [], subscriptions: [] });
  const [filterPlan, setFilterPlan] = useState("all");

  useEffect(() => {
    const fetchRealData = async () => {
      try {
        const { data: rpcData, error } = await supabase.rpc('get_super_admin_stats');
        if (error) throw error;
        
        setData(rpcData || { companies: [], subscriptions: [] });
      } catch (err) {
        console.error("Error fetching super admin stats:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchRealData();
  }, []);

  // Compute Metrics from Real Data
  const companies = data.companies || [];
  const subscriptions = data.subscriptions || [];

  const totalGMs = companies.length;
  const totalAddons = companies.reduce((acc: number, comp: any) => acc + (Number(comp.addons) || 0), 0);

  const subMetrics = useMemo(() => {
    let starterMonthly = 0, starterAnnual = 0;
    let proMonthly = 0, proAnnual = 0;
    let starterMonthlyAmount = 0, starterAnnualAmount = 0;
    let proMonthlyAmount = 0, proAnnualAmount = 0;

    subscriptions.forEach((sub: any) => {
      if (sub.status !== 'active' && sub.status !== 'trialing') return;
      
      const planName = (sub.plan || '').toLowerCase();
      const amount = Number(sub.amount) || 0;
      const isAnnual = planName.includes('annual') || amount > 1000;

      if (planName.includes('starter') || (!planName.includes('professional') && amount < 1000)) {
        if (isAnnual) { starterAnnual++; starterAnnualAmount += amount; }
        else { starterMonthly++; starterMonthlyAmount += amount; }
      } else {
        if (isAnnual) { proAnnual++; proAnnualAmount += amount; }
        else { proMonthly++; proMonthlyAmount += amount; }
      }
    });

    return {
      starterMonthly, starterAnnual, starterMonthlyAmount, starterAnnualAmount,
      proMonthly, proAnnual, proMonthlyAmount, proAnnualAmount,
      totalMRR: starterMonthlyAmount + proMonthlyAmount + ((starterAnnualAmount + proAnnualAmount) / 12)
    };
  }, [subscriptions]);

  const chartData = useMemo(() => {
    const months: Record<string, number> = {};
    const today = new Date();
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthStr = d.toLocaleString('default', { month: 'short', year: '2-digit' });
      months[monthStr] = 0;
    }

    subscriptions.forEach((sub: any) => {
      if (!sub.start_date) return;
      const subDate = new Date(sub.start_date);
      const monthStr = subDate.toLocaleString('default', { month: 'short', year: '2-digit' });
      if (months[monthStr] !== undefined) {
        months[monthStr] += Number(sub.amount) || 0;
      }
    });

    let accumulated = 0;
    return Object.entries(months).map(([name, val]) => {
      accumulated += val;
      return { name, value: accumulated };
    });
  }, [subscriptions]);

  const maxChartValue = Math.max(...chartData.map(d => d.value), 1000);

  const filteredCompanies = companies.filter((c: any) => {
    if (filterPlan !== "all" && !(c.plan || '').toLowerCase().includes(filterPlan.toLowerCase())) return false;
    return true;
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <span className="ml-2">Loading Live Super Admin Analytics...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-sans selection:bg-primary/20">
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between mx-auto px-4">
          <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
            <Server className="h-5 w-5 text-primary" />
            Super Admin Dashboard
          </div>
          <div className="flex items-center gap-4">
            <ThemeSwitch />
            <Button variant="ghost" size="sm" onClick={() => router.push('/auth/login')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto p-4 md:p-8 space-y-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total GM Accounts</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalGMs}</div>
              <p className="text-xs text-muted-foreground mt-1">Active company profiles</p>
            </CardContent>
          </Card>
          
          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Active Add-ons</CardTitle>
              <Package className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalAddons}</div>
              <p className="text-xs text-muted-foreground mt-1">Across all GM accounts</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Est. Total MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${subMetrics.totalMRR.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</div>
              <p className="text-xs text-muted-foreground mt-1">Monthly Recurring Revenue</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Platform Health</CardTitle>
              <ArrowUpRight className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-500">100%</div>
              <p className="text-xs text-muted-foreground mt-1">Systems operational</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
          <Card className="col-span-3 border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Subscription Breakdown</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              <div className="space-y-2">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>Starter Plan</span>
                  <span>${(subMetrics.starterMonthlyAmount + subMetrics.starterAnnualAmount).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted p-3 rounded-md flex flex-col justify-center items-center text-center">
                    <span className="text-muted-foreground">Monthly</span>
                    <span className="font-bold text-lg text-foreground">{subMetrics.starterMonthly} users</span>
                    <span className="text-xs text-primary">${subMetrics.starterMonthlyAmount.toLocaleString()}</span>
                  </div>
                  <div className="bg-muted p-3 rounded-md flex flex-col justify-center items-center text-center">
                    <span className="text-muted-foreground">Annual</span>
                    <span className="font-bold text-lg text-foreground">{subMetrics.starterAnnual} users</span>
                    <span className="text-xs text-primary">${subMetrics.starterAnnualAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-semibold text-foreground">
                  <span>Professional Plan</span>
                  <span>${(subMetrics.proMonthlyAmount + subMetrics.proAnnualAmount).toLocaleString()}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted p-3 rounded-md flex flex-col justify-center items-center text-center">
                    <span className="text-muted-foreground">Monthly</span>
                    <span className="font-bold text-lg text-foreground">{subMetrics.proMonthly} users</span>
                    <span className="text-xs text-primary">${subMetrics.proMonthlyAmount.toLocaleString()}</span>
                  </div>
                  <div className="bg-muted p-3 rounded-md flex flex-col justify-center items-center text-center">
                    <span className="text-muted-foreground">Annual</span>
                    <span className="font-bold text-lg text-foreground">{subMetrics.proAnnual} users</span>
                    <span className="text-xs text-primary">${subMetrics.proAnnualAmount.toLocaleString()}</span>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="col-span-4 border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-foreground">Accumulated Monthly Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full flex items-end justify-between gap-2 pt-8">
                {chartData.map((data, i) => {
                  const heightPercentage = maxChartValue > 0 ? (data.value / maxChartValue) * 100 : 0;
                  return (
                    <div key={i} className="relative flex flex-col items-center flex-1 group">
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap shadow-md border border-border z-10">
                        ${data.value.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                      </div>
                      
                      <div 
                        className="w-full bg-primary/80 hover:bg-primary rounded-t-sm transition-all duration-300"
                        style={{ height: `${Math.max(heightPercentage, 2)}%` }}
                      ></div>
                      
                      <span className="text-xs text-muted-foreground mt-2 font-medium">{data.name}</span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle className="text-foreground">GM Accounts & Company Details</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground font-medium">Filter Plan:</span>
              <Select value={filterPlan} onValueChange={setFilterPlan}>
                <SelectTrigger className="w-[150px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Plans</SelectItem>
                  <SelectItem value="trial">Trial</SelectItem>
                  <SelectItem value="starter">Starter</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-foreground font-semibold">Company Name</TableHead>
                    <TableHead className="text-foreground font-semibold">GM Name</TableHead>
                    <TableHead className="text-foreground font-semibold">GM Email</TableHead>
                    <TableHead className="text-foreground font-semibold text-center">Add-ons</TableHead>
                    <TableHead className="text-foreground font-semibold">Current Plan</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Plan Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No companies found matching the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((comp: any, i: number) => (
                      <TableRow key={comp.id || i} className="border-border transition-colors hover:bg-muted/30">
                        <TableCell className="font-medium text-foreground">{comp.name || 'Unnamed Company'}</TableCell>
                        <TableCell className="text-foreground">{comp.gm_name || '-'}</TableCell>
                        <TableCell className="text-muted-foreground">{comp.gm_email || '-'}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-full h-6 w-6 text-xs font-bold">
                            {comp.addons || 0}
                          </span>
                        </TableCell>
                        <TableCell className="capitalize text-foreground">
                          {comp.plan || 'Trial'}
                        </TableCell>
                        <TableCell className="text-right font-semibold text-foreground">
                          ${Number(comp.amount || 0).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}