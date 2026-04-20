import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/router";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, DollarSign, Server, Package, ArrowUpRight, Loader2, ArrowLeft, Calendar, Filter, Pencil } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { plans, addOns } from "@/config/pricing";

// Calculate exact base plan cost based on plan name, ignoring prorated Stripe invoices
const getBasePlanAmount = (planName: string) => {
  const plan = (planName || '').toLowerCase();
  if (plan.includes('professional') && plan.includes('annual')) return 4790;
  if (plan.includes('starter') && plan.includes('annual')) return 2870;
  if (plan.includes('professional')) return 499;
  if (plan.includes('starter')) return 299;
  return 0; // Trial or unknown
};

export default function SystemMonitor() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ companies: [], subscriptions: [] });
  const [filterPlan, setFilterPlan] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Date Editing State
  const [editSubOpen, setEditSubOpen] = useState(false);
  const [editingSub, setEditingSub] = useState<any>(null);
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [isUpdatingDates, setIsUpdatingDates] = useState(false);

  // Add-on Users State
  const [addonUsers, setAddonUsers] = useState<any[]>([]);
  const [filterAddonCompany, setFilterAddonCompany] = useState("");
  const [filterAddonAssignment, setFilterAddonAssignment] = useState("all");
  
  const [editAddonOpen, setEditAddonOpen] = useState(false);
  const [editingAddon, setEditingAddon] = useState<any>(null);
  const [newAddonStartDate, setNewAddonStartDate] = useState("");
  const [newAddonEndDate, setNewAddonEndDate] = useState("");
  const [isUpdatingAddonDates, setIsUpdatingAddonDates] = useState(false);

  const fetchRealData = async () => {
    try {
      const { data: rpcData, error } = await supabase.rpc('get_super_admin_stats');
      if (error) throw error;
      
      setData(rpcData || { companies: [], subscriptions: [] });

      const { data: addonsData, error: addonsError } = await supabase.rpc('get_super_admin_addon_users');
      if (addonsError) throw addonsError;
      
      setAddonUsers((addonsData as any[]) || []);
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
    if (!editingSub?.user_id) {
      toast({ title: "Error", description: "No user found for this company.", variant: "destructive" });
      return;
    }
    setIsUpdatingDates(true);
    try {
      const { error } = await supabase.rpc('update_gm_dates', {
        p_user_id: editingSub.user_id,
        p_start_date: newStartDate || null,
        p_end_date: newEndDate || null
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

  const handleUpdateAddonDates = async () => {
    if (!editingAddon?.id) return;
    setIsUpdatingAddonDates(true);
    try {
      const { error } = await supabase.rpc('update_addon_user_dates', {
        p_profile_id: editingAddon.id,
        p_start_date: newAddonStartDate || null,
        p_end_date: newAddonEndDate || null
      });
      if (error) throw error;
      
      toast({ title: "Success", description: "Add-on user dates updated successfully." });
      setEditAddonOpen(false);
      fetchRealData();
    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdatingAddonDates(false);
    }
  };

  const openEditAddonDates = (user: any) => {
    setEditingAddon(user);
    setNewAddonStartDate(user.start_date || "");
    setNewAddonEndDate(user.end_date || "");
    setEditAddonOpen(true);
  };

  // Format AED Currency
  const formatAED = (amount: number) => {
    return `AED ${amount.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Compute Metrics from Real Data
  const companies = data.companies || [];
  const subscriptions = data.subscriptions || [];

  const allAddonUsers = useMemo(() => {
    const assigned = [...addonUsers];
    const unassigned: any[] = [];

    companies.forEach((comp: any) => {
      const compSubs = subscriptions.filter((s: any) => s.user_id === comp.user_id && (s.status === 'active' || s.status === 'trialing'));
      
      const assignedCounts = {
        'Site Personnel': 0,
        'Accounting': 0,
        'Purchasing': 0
      };

      assigned.forEach(u => {
        if (u.is_addon && u.company_id === comp.id) {
          const mod = u.assigned_modules?.[0] || u.assigned_module;
          if (mod === 'Site Personnel') assignedCounts['Site Personnel']++;
          else if (mod === 'Accounting') assignedCounts['Accounting']++;
          else if (mod === 'Purchasing') assignedCounts['Purchasing']++;
        }
      });

      // Collect all purchased seats from all active subscriptions
      const purchasedSeats: any[] = [];

      compSubs.forEach((s: any) => {
        if (s.features) {
          let f: any = {};
          try {
            f = typeof s.features === 'string' ? JSON.parse(s.features) : s.features;
          } catch(e) {}
          
          const addSeat = (mod: string, count: number) => {
            for (let i = 0; i < count; i++) {
              purchasedSeats.push({
                module: mod,
                start_date: s.start_date,
                end_date: s.end_date,
                gm_plan: s.plan,
                sub_id: s.id || Math.random().toString(36).substr(2, 9)
              });
            }
          };

          if (f.extra_site) addSeat('Site Personnel', Number(f.extra_site));
          if (f.accounting) addSeat('Accounting', Number(f.accounting));
          if (f.purchasing) addSeat('Purchasing', Number(f.purchasing));
        }
      });

      // Sort purchased seats by start_date ascending (oldest first)
      purchasedSeats.sort((a, b) => {
        const dateA = a.start_date ? new Date(a.start_date).getTime() : 0;
        const dateB = b.start_date ? new Date(b.start_date).getTime() : 0;
        return dateA - dateB;
      });

      // Consume seats using assigned counts (so assigned users conceptually map to the oldest purchases)
      const remainingSeats = purchasedSeats.filter(seat => {
        if (assignedCounts[seat.module as keyof typeof assignedCounts] > 0) {
          assignedCounts[seat.module as keyof typeof assignedCounts]--;
          return false; // seat is consumed by an assigned user
        }
        return true; // seat remains unassigned
      });

      // Create placeholders for remaining unassigned seats with exact purchase dates
      remainingSeats.forEach((seat, index) => {
        unassigned.push({
          id: `unassigned-${comp.id}-${seat.module}-${index}-${seat.sub_id}`,
          full_name: 'Pending Assignment',
          email: 'Waiting for invite...',
          company_name: comp.name,
          company_id: comp.id,
          is_addon: true,
          is_unassigned: true,
          assigned_modules: [seat.module],
          assigned_module: seat.module,
          start_date: seat.start_date, // This accurately reflects the actual purchase date
          end_date: seat.end_date,
          gm_plan: seat.gm_plan
        });
      });
    });

    return [...assigned, ...unassigned];
  }, [addonUsers, companies, subscriptions]);

  const totalGMs = companies.length;
  const totalTrueAddons = allAddonUsers.filter((u: any) => !!u.is_addon).length;
  
  const siteCount = allAddonUsers.filter((u: any) => u.assigned_modules?.includes('Site Personnel') || u.assigned_module?.includes('Site Personnel')).length;
  const accCount = allAddonUsers.filter((u: any) => u.assigned_modules?.includes('Accounting') || u.assigned_module?.includes('Accounting')).length;
  const purCount = allAddonUsers.filter((u: any) => u.assigned_modules?.includes('Purchasing') || u.assigned_module?.includes('Purchasing')).length;

  const subMetrics = useMemo(() => {
    let starterMonthly = 0, starterAnnual = 0;
    let proMonthly = 0, proAnnual = 0;
    let starterMonthlyAmount = 0, starterAnnualAmount = 0;
    let proMonthlyAmount = 0, proAnnualAmount = 0;
    let totalBaseMRR = 0;

    subscriptions.forEach((sub: any) => {
      if (sub.status !== 'active' && sub.status !== 'trialing') return;
      
      const planName = (sub.plan || '').toLowerCase();
      const isAnnual = planName.includes('annual');

      const basePlanAmount = getBasePlanAmount(planName);
      const basePlanMRR = isAnnual ? (basePlanAmount / 12) : basePlanAmount;
      
      totalBaseMRR += basePlanMRR;
      
      if (planName.includes('starter')) {
        if (isAnnual) { starterAnnual++; starterAnnualAmount += basePlanAmount; }
        else { starterMonthly++; starterMonthlyAmount += basePlanAmount; }
      } else if (planName.includes('professional')) {
        if (isAnnual) { proAnnual++; proAnnualAmount += basePlanAmount; }
        else { proMonthly++; proMonthlyAmount += basePlanAmount; }
      }
    });

    // Decoupled Addon MRR (Prevents double counting from multiple subscription rows)
    let totalAddonMRR = 0;
    allAddonUsers.forEach((u: any) => {
      if (u.is_addon) {
        const mod = u.assigned_modules?.[0] || u.assigned_module;
        if (mod === 'Site Personnel') totalAddonMRR += 49;
        else if (mod === 'Accounting') totalAddonMRR += 39;
        else if (mod === 'Purchasing') totalAddonMRR += 29;
      }
    });

    const totalMRR = totalBaseMRR + totalAddonMRR;

    return {
      starterMonthly, starterAnnual, starterMonthlyAmount, starterAnnualAmount,
      proMonthly, proAnnual, proMonthlyAmount, proAnnualAmount,
      totalMRR,
      starterTotal: starterMonthly + starterAnnual,
      proTotal: proMonthly + proAnnual,
      starterTotalAmount: starterMonthlyAmount + starterAnnualAmount,
      proTotalAmount: proMonthlyAmount + proAnnualAmount
    };
  }, [subscriptions, allAddonUsers]);

  const chartData = useMemo(() => {
    const result = [];
    const today = new Date();
    
    // Generate precise MRR for the last 12 months
    for (let i = 11; i >= 0; i--) {
      const targetMonth = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() - i + 1, 0); // Last day of month
      const monthStr = targetMonth.toLocaleString('default', { month: 'short', year: '2-digit' });
      
      let totalMonthlyMRR = 0;
      
      subscriptions.forEach((sub: any) => {
        if (sub.status !== 'active' && sub.status !== 'trialing') return;
        if (!sub.start_date) return;
        
        const subStart = new Date(sub.start_date);
        const subEnd = sub.end_date ? new Date(sub.end_date) : new Date(8640000000000000); // Far future if no end date
        
        // If base subscription was active during this month, add it to the MRR
        if (subStart <= monthEnd && subEnd >= targetMonth) {
          const planName = (sub.plan || '').toLowerCase();
          const isAnnual = planName.includes('annual');
          const basePlanAmount = getBasePlanAmount(planName);
          const baseMRR = isAnnual ? basePlanAmount / 12 : basePlanAmount;
          
          totalMonthlyMRR += baseMRR;
        }
      });

      // Independently add active Add-on revenue historically
      allAddonUsers.forEach((u: any) => {
        if (u.is_addon && u.start_date) {
          const uStart = new Date(u.start_date);
          const uEnd = u.end_date ? new Date(u.end_date) : new Date(8640000000000000);
          if (uStart <= monthEnd && uEnd >= targetMonth) {
            const mod = u.assigned_modules?.[0] || u.assigned_module;
            if (mod === 'Site Personnel') totalMonthlyMRR += 49;
            else if (mod === 'Accounting') totalMonthlyMRR += 39;
            else if (mod === 'Purchasing') totalMonthlyMRR += 29;
          }
        }
      });
      
      result.push({ name: monthStr, value: totalMonthlyMRR });
    }
    
    return result;
  }, [subscriptions, allAddonUsers]);

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

  const baseFilteredUsers = allAddonUsers.filter((u: any) => {
    if (filterAddonAssignment !== "all") {
      const modules = u.assigned_modules || (u.assigned_module ? [u.assigned_module] : []);
      if (!modules.includes(filterAddonAssignment)) return false;
    }
    if (filterAddonCompany.trim() !== "") {
      if (!u.company_name?.toLowerCase().includes(filterAddonCompany.toLowerCase())) return false;
    }
    return true;
  });

  const filteredIncludedUsers = baseFilteredUsers.filter((u: any) => !u.is_addon);
  const filteredAddonUsers = baseFilteredUsers.filter((u: any) => !!u.is_addon);

  const renderUserRow = (u: any, i: number) => {
    const startDate = u.start_date ? new Date(u.start_date).toLocaleDateString('en-GB') : '-';
    const endDate = u.end_date ? new Date(u.end_date).toLocaleDateString('en-GB') : '-';
    const daysUntilExpiry = u.end_date ? Math.ceil((new Date(u.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;
    const isExpiringSoon = daysUntilExpiry !== null && daysUntilExpiry <= 30 && daysUntilExpiry > 0;
    const isExpired = daysUntilExpiry !== null && daysUntilExpiry <= 0;
    const assignments = u.assigned_modules || (u.assigned_module ? [u.assigned_module] : []);

    return (
      <TableRow key={u.id || i} className="border-border transition-colors hover:bg-muted/30">
        <TableCell className={`font-medium ${u.is_unassigned ? 'text-muted-foreground italic' : 'text-foreground'}`}>
          {u.full_name || 'Unknown'}
        </TableCell>
        <TableCell className={u.is_unassigned ? 'text-muted-foreground/50' : 'text-muted-foreground'}>
          {u.email || '-'}
        </TableCell>
        <TableCell className="text-foreground font-medium">{u.company_name || '-'}</TableCell>
        <TableCell>
          <div className="flex flex-wrap gap-1">
            {assignments.map((m: string) => (
              <Badge key={m} variant="secondary" className="text-[10px] font-normal">{m}</Badge>
            ))}
          </div>
        </TableCell>
        <TableCell className="text-foreground">
          <div className="flex items-center gap-1">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {startDate}
          </div>
        </TableCell>
        <TableCell className="text-foreground">
          <div className={`flex items-center gap-1 ${isExpired ? 'text-destructive font-bold' : isExpiringSoon ? 'text-orange-600 font-semibold' : ''}`}>
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {endDate}
            {isExpiringSoon && <span className="text-xs ml-1">({daysUntilExpiry}d)</span>}
            {isExpired && <span className="text-[10px] ml-1 bg-destructive/10 text-destructive px-1.5 rounded">Expired</span>}
          </div>
        </TableCell>
        <TableCell className="text-muted-foreground capitalize text-sm">
          {u.gm_plan ? `${u.gm_plan} (${u.gm_billing_cycle || 'monthly'})` : 'No Active Plan'}
        </TableCell>
        <TableCell className="text-right">
          {u.is_unassigned ? (
            <Badge variant="outline" className="text-muted-foreground bg-muted/50 border-dashed">Unassigned</Badge>
          ) : u.is_addon ? (
            <Button variant="outline" size="sm" className="h-8 text-xs text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100" onClick={() => openEditAddonDates(u)}>
              <Pencil className="h-3 w-3 mr-1" /> Edit Dates
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground italic px-2">Tied to GM</span>
          )}
        </TableCell>
      </TableRow>
    );
  };

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
              <div className="text-3xl font-bold">{totalTrueAddons}</div>
              <p className="text-xs text-muted-foreground mt-1">Paid extra seats</p>
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
                  <span>Active Independent Users</span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">Site Personnel</span>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{siteCount} active</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">Accounting</span>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{accCount} active</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                    <span className="text-muted-foreground">Purchasing</span>
                    <div className="text-right">
                      <div className="font-bold text-foreground">{purCount} active</div>
                    </div>
                  </div>
                </div>
              </div>

            </CardContent>
          </Card>

          <Card className="col-span-4 border-border bg-card shadow-sm flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-foreground">Monthly Recurring Revenue (MRR)</CardTitle>
              <Badge variant="outline" className="text-muted-foreground bg-muted/50 font-normal">Last 12 Months</Badge>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-end pt-6">
              <div className="h-[250px] w-full flex items-end justify-between gap-2">
                {chartData.map((data, i) => {
                  const heightPercentage = maxChartValue > 0 ? (data.value / maxChartValue) * 100 : 0;
                  return (
                    <div key={i} className="relative flex flex-col items-center flex-1 group h-full justify-end">
                      <div className="absolute -top-6 text-[10px] font-semibold text-muted-foreground whitespace-nowrap z-10 group-hover:text-foreground transition-colors">
                        {data.value > 0 ? `AED ${Math.round(data.value).toLocaleString()}` : ''}
                      </div>
                      
                      <div 
                        className="w-full bg-primary/80 hover:bg-primary rounded-t-sm transition-all duration-300 min-h-[4px]"
                        style={{ height: `${heightPercentage}%` }}
                      ></div>
                      
                      <span className="text-[10px] text-muted-foreground mt-2 font-medium whitespace-nowrap">{data.name}</span>
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
                      
                      const planName = (comp.plan || '').toLowerCase();
                      const basePlanDisplayAmount = getBasePlanAmount(planName);

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
                            {formatAED(basePlanDisplayAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              className="h-8 text-xs text-blue-600 bg-blue-50 border-blue-200 hover:bg-blue-100" 
                              onClick={() => openEditDates(comp)}
                            >
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

        {/* Independent Users Filters Container */}
        <div className="flex flex-col md:flex-row items-center justify-between mt-10 mb-4 gap-4">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Independent Users Directory</h2>
          <div className="flex items-center gap-4">
            <Input 
              placeholder="Search by Company..." 
              value={filterAddonCompany} 
              onChange={(e) => setFilterAddonCompany(e.target.value)}
              className="w-48 h-9 bg-background"
            />
            <Select value={filterAddonAssignment} onValueChange={setFilterAddonAssignment}>
              <SelectTrigger className="w-40 h-9 bg-background">
                <SelectValue placeholder="Assignment" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignments</SelectItem>
                <SelectItem value="Site Personnel">Site Personnel</SelectItem>
                <SelectItem value="Accounting">Accounting</SelectItem>
                <SelectItem value="Purchasing">Purchasing</SelectItem>
                <SelectItem value="Warehouse">Warehouse</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Included Users Table */}
        <Card className="border-border bg-card shadow-sm mb-6">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle className="text-foreground">Included Independent Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-foreground font-semibold">User Name</TableHead>
                    <TableHead className="text-foreground font-semibold">Email</TableHead>
                    <TableHead className="text-foreground font-semibold">Tied Company</TableHead>
                    <TableHead className="text-foreground font-semibold">Assignment</TableHead>
                    <TableHead className="text-foreground font-semibold">Start Date</TableHead>
                    <TableHead className="text-foreground font-semibold">Expiry Date</TableHead>
                    <TableHead className="text-foreground font-semibold">Plan & Cycle</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredIncludedUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No included users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIncludedUsers.map(renderUserRow)
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Add-on Users Table */}
        <Card className="border-border bg-card shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
            <CardTitle className="text-foreground">Add-ons Independent Users</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="text-foreground font-semibold">User Name</TableHead>
                    <TableHead className="text-foreground font-semibold">Email</TableHead>
                    <TableHead className="text-foreground font-semibold">Tied Company</TableHead>
                    <TableHead className="text-foreground font-semibold">Assignment</TableHead>
                    <TableHead className="text-foreground font-semibold">Start Date</TableHead>
                    <TableHead className="text-foreground font-semibold">Expiry Date</TableHead>
                    <TableHead className="text-foreground font-semibold">Plan & Cycle</TableHead>
                    <TableHead className="text-right text-foreground font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAddonUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No active add-on users found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAddonUsers.map(renderUserRow)
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

        {/* Edit Add-on User Dates Modal */}
        <Dialog open={editAddonOpen} onOpenChange={setEditAddonOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Add-on User Dates</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>User Name</Label>
                  <Input value={editingAddon?.full_name || 'Unknown'} disabled className="bg-muted" />
                </div>
                <div className="space-y-2">
                  <Label>Tied Company</Label>
                  <Input value={editingAddon?.company_name || 'Unknown'} disabled className="bg-muted" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date" 
                    value={newAddonStartDate} 
                    onChange={(e) => setNewAddonStartDate(e.target.value)} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Expiry Date (End Date)</Label>
                  <Input 
                    type="date" 
                    value={newAddonEndDate} 
                    onChange={(e) => setNewAddonEndDate(e.target.value)} 
                  />
                </div>
              </div>
              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded border border-border mt-2">
                <strong>Tip:</strong> If you leave the Expiry Date empty, the user will inherit the GM's billing cycle end date. Setting a specific date here will explicitly override it. Set to yesterday to instantly restrict their access.
              </p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditAddonOpen(false)}>Cancel</Button>
              <Button onClick={handleUpdateAddonDates} disabled={isUpdatingAddonDates}>
                {isUpdatingAddonDates && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </main>
    </div>
  );
}