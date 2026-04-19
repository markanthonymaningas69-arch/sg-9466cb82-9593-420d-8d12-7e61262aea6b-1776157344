import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Server, Package, ArrowUpRight, Loader2, ArrowLeft, Calendar, Filter, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function SystemMonitor() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ companies: [], subscriptions: [] });
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [chartMonths, setChartMonths] = useState(6);

  // Date Editing State
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<any>(null);
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [isUpdatingDates, setIsUpdatingDates] = useState(false);

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

  useEffect(() => {
    fetchRealData();
  }, []);

  const handleUpdateDates = async () => {
    if (!editingSub?.sub_id) {
      toast({ title: "Error", description: "No active subscription found for this company.", variant: "destructive" });
      return;
    }
    setIsUpdatingDates(true);
    try {
      const { error } = await supabase.rpc('update_subscription_dates', {
        p_sub_id: editingSub.sub_id,
        p_start_date: newStartDate,
        p_end_date: newEndDate
      });
      if (error) throw error;
      
      toast({ title: "Success", description: "Subscription dates updated successfully." });
      setEditSubOpen(false);
      fetchRealData();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdatingDates(false);
    }
  };

  const openEditDates = (comp: any) => {
    setEditingSub(comp);
    setNewStartDate(comp.start_date || "");
    setNewEndDate(comp.end_date || "");
    setEditSubOpen(true);
  };

  // Format AED Currency
  const formatAED = (amount: number) => {
    return `AED ${amount.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Compute Metrics from Real Data
  const companies = data.companies || [];
  const subscriptions = data.subscriptions || [];

  const totalGMs = companies.length;

  // Compute add-ons breakdown
  const addonsMetrics = useMemo(() => {
    const breakdown = {
      site_personnel: { count: 0, amount: 0 },
      accounting: { count: 0, amount: 0 },
      purchasing: { count: 0, amount: 0 }
    };

    companies.forEach((comp: any) => {
      const addons = comp.addons_breakdown || {};
      if (addons.site_personnel) {
        breakdown.site_personnel.count += addons.site_personnel.count || 0;
        breakdown.site_personnel.amount += addons.site_personnel.amount || 0;
      }
      if (addons.accounting) {
        breakdown.accounting.count += addons.accounting.count || 0;
        breakdown.accounting.amount += addons.accounting.amount || 0;
      }
      if (addons.purchasing) {
        breakdown.purchasing.count += addons.purchasing.count || 0;
        breakdown.purchasing.amount += addons.purchasing.amount || 0;
      }
    });

    const totalCount = breakdown.site_personnel.count + breakdown.accounting.count + breakdown.purchasing.count;
    const totalAmount = breakdown.site_personnel.amount + breakdown.accounting.amount + breakdown.purchasing.amount;

    return { ...breakdown, totalCount, totalAmount };
  }, [companies]);

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

    const totalMRR = starterMonthlyAmount + proMonthlyAmount + ((starterAnnualAmount + proAnnualAmount) / 12);

    return {
      starterMonthly, starterAnnual, starterMonthlyAmount, starterAnnualAmount,
      proMonthly, proAnnual, proMonthlyAmount, proAnnualAmount,
      totalMRR,
      starterTotal: starterMonthly + starterAnnual,
      proTotal: proMonthly + proAnnual,
      starterTotalAmount: starterMonthlyAmount + starterAnnualAmount,
      proTotalAmount: proMonthlyAmount + proAnnualAmount
    };
  }, [subscriptions]);

  const chartData = useMemo(() => {
    const months: Record<string, number> = {};
    const today = new Date();
    
    for (let i = chartMonths - 1; i >= 0; i--) {
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
  }, [subscriptions, chartMonths]);

  const maxChartValue = Math.max(...chartData.map(d => d.value), 1000);

  const filteredCompanies = companies.filter((c: any) => {
    if (filterPlan !== "all" && !(c.plan || '').toLowerCase().includes(filterPlan.toLowerCase())) return false;
    if (filterStatus === "active" && c.status !== "active") return false;
    if (filterStatus === "expiring") {
      const expiryDate = c.end_date ? new Date(c.end_date) : null;
      if (!expiryDate) return false;
      const daysUntilExpiry = Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry > 30) return false;
    }
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
              <div className="text-3xl font-bold">{addonsMetrics.totalCount}</div>
              <p className="text-xs text-muted-foreground mt-1">{formatAED(addonsMetrics.totalAmount)} revenue</p>
            </CardContent>
          </Card>

          <Card className="border-border bg-card text-card-foreground shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Est. Total MRR</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{formatAED(subMetrics.totalMRR)}</div>
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
                <div className="flex items-center justify-between font-semibold text-foreground border-b pb-2">
                  <span>Starter Plan ({subMetrics.starterTotal} GMs)</span>
                  <span>{formatAED(subMetrics.starterTotalAmount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-muted-foreground text-xs mb-1">Monthly (AED 299)</div>
                    <div className="font-bold text-lg text-foreground">{subMetrics.starterMonthly} GMs</div>
                    <div className="text-xs text-primary mt-1">{formatAED(subMetrics.starterMonthlyAmount)}</div>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-muted-foreground text-xs mb-1">Annual (AED 2,870)</div>
                    <div className="font-bold text-lg text-foreground">{subMetrics.starterAnnual} GMs</div>
                    <div className="text-xs text-primary mt-1">{formatAED(subMetrics.starterAnnualAmount)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between font-semibold text-foreground border-b pb-2">
                  <span>Professional Plan ({subMetrics.proTotal} GMs)</span>
                  <span>{formatAED(subMetrics.proTotalAmount)}</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-muted-foreground text-xs mb-1">Monthly (AED 499)</div>
                    <div className="font-bold text-lg text-foreground">{subMetrics.proMonthly} GMs</div>
                    <div className="text-xs text-primary mt-1">{formatAED(subMetrics.proMonthlyAmount)}</div>
                  </div>
                  <div className="bg-muted p-3 rounded-md">
                    <div className="text-muted-foreground text-xs mb-1">Annual (AED 4,790)</div>
                    <div className="font-bold text-lg text-foreground">{subMetrics.proAnnual} GMs</div>
                    <div className="text-xs text-primary mt-1">{formatAED(subMetrics.proAnnualAmount)}</div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <div className="flex items-center justify-between font-semibold text-foreground mb-3">
                  <span>Active Add-ons Breakdown</span>
                  <span>{formatAED(addonsMetrics.totalAmount)}</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">Site Personnel</span>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{addonsMetrics.site_personnel.count} active</div>
                      <div className="text-xs text-primary">{formatAED(addonsMetrics.site_personnel.amount)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">Accounting</span>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{addonsMetrics.accounting.count} active</div>
                      <div className="text-xs text-primary">{formatAED(addonsMetrics.accounting.amount)}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">Purchasing</span>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{addonsMetrics.purchasing.count} active</div>
                      <div className="text-xs text-primary">{formatAED(addonsMetrics.purchasing.amount)}</div>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="col-span-4 border-border bg-card shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-foreground">Accumulated Monthly Revenue</CardTitle>
              <Select value={chartMonths.toString()} onValueChange={(v) => setChartMonths(Number(v))}>
                <SelectTrigger className="w-[120px] bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 Months</SelectItem>
                  <SelectItem value="6">6 Months</SelectItem>
                  <SelectItem value="12">12 Months</SelectItem>
                  <SelectItem value="24">24 Months</SelectItem>
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent>
              <div className="h-[250px] w-full flex items-end justify-between gap-2 pt-8">
                {chartData.map((data, i) => {
                  const heightPercentage = maxChartValue > 0 ? (data.value / maxChartValue) * 100 : 0;
                  return (
                    <div key={i} className="relative flex flex-col items-center flex-1 group">
                      <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs rounded py-1 px-2 pointer-events-none whitespace-nowrap shadow-md border border-border z-10">
                        {formatAED(data.value)}
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
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Filters
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Plan Type</label>
                      <Select value={filterPlan} onValueChange={setFilterPlan}>
                        <SelectTrigger className="w-full">
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
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Status</label>
                      <Select value={filterStatus} onValueChange={setFilterStatus}>
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Status</SelectItem>
                          <SelectItem value="active">Active Only</SelectItem>
                          <SelectItem value="expiring">Expiring Soon (30 days)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
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
                    <TableHead className="text-foreground font-semibold">Current Plan</TableHead>
                    <TableHead className="text-foreground font-semibold text-center">Add-ons</TableHead>
                    <TableHead className="text-foreground font-semibold">Subscription Date</TableHead>
                    <TableHead className="text-foreground font-semibold">Expiry Date</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Plan Amount</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No companies found matching the selected filters.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredCompanies.map((comp: any, i: number) => {
                      const startDate = comp.start_date ? new Date(comp.start_date).toLocaleDateString('en-GB') : '-';
                      const endDate = comp.end_date ? new Date(comp.end_date).toLocaleDateString('en-GB') : '-';
                      const daysUntilExpiry = comp.end_date ? Math.ceil((new Date(comp.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
                      const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
                      
                      return (
                        <TableRow key={comp.id || i} className="border-border transition-colors hover:bg-muted/30">
                          <TableCell className="font-medium text-foreground">{comp.name || 'Unnamed Company'}</TableCell>
                          <TableCell className="text-foreground">{comp.gm_name || '-'}</TableCell>
                          <TableCell className="text-muted-foreground">{comp.gm_email || '-'}</TableCell>
                          <TableCell className="capitalize text-foreground">
                            {comp.plan || 'Trial'}
                          </TableCell>
                          <TableCell className="text-center">
                            <span className="inline-flex items-center justify-center bg-primary/10 text-primary rounded-full h-6 w-6 text-xs font-bold">
                              {comp.addons || 0}
                            </span>
                          </TableCell>
                          <TableCell className="text-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {startDate}
                            </div>
                          </TableCell>
                          <TableCell className="text-foreground">
                            <div className={`flex items-center gap-1 ${isExpiringSoon ? 'text-orange-600 font-semibold' : ''}`}>
                              <Calendar className="h-3 w-3 text-muted-foreground" />
                              {endDate}
                              {isExpiringSoon && <span className="text-xs ml-1">({daysUntilExpiry}d)</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-foreground">
                            {formatAED(Number(comp.amount || 0))}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="outline" size="sm" className="h-8 text-xs text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100" onClick={() => openEditDates(comp)}>
                              <Pencil className="h-3 w-3 mr-1" /> Edit Dates
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Edit Subscription Dates Modal */}
        <Dialog open={editSubOpen} onOpenChange={setEditSubOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Subscription Dates</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Company / General Manager</Label>
                <Input value={editingSub?.name || 'Unknown'} disabled className="bg-muted" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={newStartDate} 
                    onChange={(e) => setNewStartDate(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date (End Date)</Label>
                  <Input 
                    type="date" 
                    value={newEndDate} 
                    onChange={(e) => setNewEndDate(e.target.value)} 
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border mt-2">
                <strong>Tip:</strong> To instantly expire a user's subscription or trial and put them in Read-Only Mode, simply set the Expiry Date to yesterday.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditSubOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateDates} disabled={isUpdatingDates}>
                {isUpdatingDates && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}