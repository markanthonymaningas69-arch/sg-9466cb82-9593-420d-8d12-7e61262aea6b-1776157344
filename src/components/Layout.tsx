import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Calculator,
  Warehouse,
  BarChart3,
  Settings,
  CreditCard,
  Menu,
  X,
  ClipboardList,
  ShoppingCart,
  Bell,
  User,
  LogOut,
  Check,
  XCircle,
  Activity,
  CalendarDays,
  ChevronLeft,
  ChevronRight } from
"lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger } from
"@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { authService } from "@/services/authService";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsProvider";
import { AlertCircle, Lock } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AIChatAssistant } from "@/components/AIChatAssistant";

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
{ name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
{ name: "Project Manager", href: "/schedule", icon: CalendarDays },
{ name: "Project Profile", href: "/projects", icon: FolderKanban },
{ name: "Site Personnel", href: "/site-personnel", icon: ClipboardList },
{ name: "Purchasing", href: "/purchasing", icon: ShoppingCart },
{ name: "Accounting", href: "/accounting", icon: Calculator },
{ name: "Human Resources", href: "/personnel", icon: Users },
{ name: "Warehouse", href: "/warehouse", icon: Warehouse },
{ name: "Analytics", href: "/analytics", icon: BarChart3 }];

export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { company, currentPlan, formatCurrency, isLocked, lockReason, isTrial, daysRemaining } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [pendingCashAdvances, setPendingCashAdvances] = useState<any[]>([]);
  const [expiringDocuments, setExpiringDocuments] = useState<any[]>([]);
  
  const [pendingDeliveries, setPendingDeliveries] = useState<any[]>([]);
  const [recentReceivedDeliveries, setRecentReceivedDeliveries] = useState<any[]>([]);
  
  const [pendingPurchases, setPendingPurchases] = useState<any[]>([]);
  const [pendingGmPurchases, setPendingGmPurchases] = useState<any[]>([]);
  const [approvedVouchers, setApprovedVouchers] = useState<any[]>([]);
  
  const [resolvedRequests, setResolvedRequests] = useState<any[]>([]);
  const [resolvedLeaves, setResolvedLeaves] = useState<any[]>([]);
  const [resolvedCashAdvances, setResolvedCashAdvances] = useState<any[]>([]);
  
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [lastSeenNotificationIds, setLastSeenNotificationIds] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('lastSeenNotificationIds') || "" : "");
  const [clearedUpdateIds, setClearedUpdateIds] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_cleared_updates');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  
  const [assignedModule, setAssignedModule] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('app_assigned_module') || "GM" : "GM");
  const [assignedModules, setAssignedModules] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('app_assigned_modules');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const [userName, setUserName] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('app_user_name') || "User" : "User");
  const [userEmail, setUserEmail] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('app_user_email') || "" : "");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    loadUserProfile();
    loadPendingRequests();
    // Poll for new requests every 30 seconds
    const interval = setInterval(loadPendingRequests, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUserProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      setUserEmail(session.user.email || "");
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).maybeSingle();
      if (profile) {
        if (!profile.assigned_module && (!profile.assigned_modules || profile.assigned_modules.length === 0)) {
          router.push('/onboarding');
          return;
        }
        
        const mods = profile.assigned_modules && profile.assigned_modules.length > 0 
          ? profile.assigned_modules 
          : [profile.assigned_module || "GM"];
          
        setAssignedModules(mods);
        setAssignedModule(mods[0]);
        setUserName(profile.full_name || profile.email?.split('@')[0] || "User");

        // Cache to prevent flash on navigation
        localStorage.setItem('app_assigned_modules', JSON.stringify(mods));
        localStorage.setItem('app_assigned_module', mods[0]);
        localStorage.setItem('app_user_name', profile.full_name || profile.email?.split('@')[0] || "User");
        localStorage.setItem('app_user_email', session.user.email || "");
      }
    } else {
      router.push('/auth/login');
    }
  };

  const loadPendingRequests = async () => {
    const { data: reqs } = await supabase.
    from('site_requests').
    select('*, projects(name)').
    eq('status', 'pending').
    order('request_date', { ascending: false }).
    limit(10);
    setPendingRequests(reqs || []);

    const { data: leaves } = await supabase.
    from('leave_requests').
    select('*, personnel(name)').
    eq('status', 'pending').
    order('created_at', { ascending: false }).
    limit(10);
    setPendingLeaves(leaves || []);

    const { data: advances } = await supabase.
    from('cash_advance_requests').
    select('*, personnel(name), projects(name)').
    eq('status', 'pending').
    order('request_date', { ascending: false }).
    limit(10);
    setPendingCashAdvances(advances || []);

    // Load pending warehouse deliveries
    const { data: pDeliveries } = await supabase
      .from('deliveries')
      .select('*, projects(name)')
      .eq('status', 'pending')
      .order('delivery_date', { ascending: false })
      .limit(10);
    setPendingDeliveries(pDeliveries || []);

    // Load recently received warehouse deliveries
    const { data: rDeliveries } = await supabase
      .from('deliveries')
      .select('*, projects(name)')
      .eq('status', 'received')
      .order('id', { ascending: false })
      .limit(5);
    setRecentReceivedDeliveries(rDeliveries || []);

    const { data: pPurchases } = await supabase
      .from('purchases')
      .select('*, projects(name)')
      .eq('status', 'pending')
      .order('id', { ascending: false })
      .limit(10);
    setPendingPurchases(pPurchases || []);

    const { data: gmPurchases } = await supabase
      .from('purchases')
      .select('*, projects(name)')
      .eq('status', 'pending_approval')
      .order('id', { ascending: false })
      .limit(10);
    setPendingGmPurchases(gmPurchases || []);

    const { data: aVouchers } = await supabase
      .from('vouchers')
      .select('*, projects(name)')
      .eq('status', 'approved')
      .order('date', { ascending: false })
      .limit(10);
    setApprovedVouchers(aVouchers || []);

    // Load expiring documents
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    const targetDate = thirtyDaysFromNow.toISOString().split("T")[0];

    const { data: visasData } = await supabase.
    from('personnel_visas').
    select('*, personnel(name)').
    or(`visa_expiry_date.lte.${targetDate},passport_expiry_date.lte.${targetDate}`);

    const expiring = (visasData || []).filter((record) => {
      if (record.status === 'noted') return false;
      const daysToPassportExpiry = record.passport_expiry_date ? Math.ceil((new Date(record.passport_expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : Infinity;
      const daysToVisaExpiry = record.visa_expiry_date ? Math.ceil((new Date(record.visa_expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : Infinity;
      return daysToPassportExpiry <= 30 || daysToVisaExpiry <= 30;
    });
    setExpiringDocuments(expiring);

    // Load recent resolved requests (Approved / Rejected) for notifications
    const { data: rReqs } = await supabase.
    from('site_requests').
    select('*, projects(name)').
    in('status', ['approved', 'rejected']).
    order('id', { ascending: false }).
    limit(5);
    setResolvedRequests(rReqs || []);

    const { data: rLeaves } = await supabase.
    from('leave_requests').
    select('*, personnel(name)').
    in('status', ['approved', 'rejected']).
    order('created_at', { ascending: false }).
    limit(5);
    setResolvedLeaves(rLeaves || []);

    const { data: rAdvances } = await supabase.
    from('cash_advance_requests').
    select('*, personnel(name), projects(name)').
    in('status', ['approved', 'rejected']).
    order('created_at', { ascending: false }).
    limit(5);
    setResolvedCashAdvances(rAdvances || []);
  };

  const handleApproveRequest = async (req: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const { error } = await supabase.
    from('site_requests').
    update({ status: 'approved' }).
    eq('id', req.id);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to approve request",
        variant: "destructive"
      });
    } else {
      const isMaterial = req.request_type === 'Materials' || req.request_type === 'Tools & Equipments' || !req.request_type;
      
      if (isMaterial) {
        await supabase.from('purchases').insert({
          order_number: `PR-${Math.floor(10000 + Math.random() * 90000)}`,
          order_date: new Date().toISOString().split("T")[0],
          supplier: 'Pending Selection',
          item_name: req.item_name,
          category: req.request_type === "Materials" ? "Construction Materials" : "Tools",
          quantity: parseFloat(req.quantity?.toString()) || 1,
          unit: req.unit || 'lot',
          unit_cost: 0,
          destination_type: 'project_warehouse',
          project_id: req.project_id,
          status: 'pending'
        });
        toast({
          title: "Request Approved",
          description: `${req.item_name} has been approved and sent to Purchasing.`
        });
      } else {
        await supabase.from('vouchers').insert({
          type: 'payment',
          voucher_number: `PV-${Math.floor(10000 + Math.random() * 90000)}`,
          date: new Date().toISOString().split("T")[0],
          amount: req.amount || 0,
          payee: req.requested_by || 'Site Personnel',
          description: `Approved ${req.request_type || 'Request'}: ${req.item_name} (${req.quantity} ${req.unit || ''})`,
          project_id: req.project_id,
          status: 'approved'
        });
        toast({
          title: "Request Approved",
          description: `${req.item_name} has been approved and Payment Voucher generated.`
        });
      }
      loadPendingRequests();
    }
  };

  const handleRejectRequest = async (requestId: string, itemName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const { error } = await supabase.
    from('site_requests').
    update({ status: 'rejected' }).
    eq('id', requestId);

    if (error) {
      toast({
        title: "Error",
        description: "Failed to reject request",
        variant: "destructive"
      });
    } else {
      toast({
        title: "Request Rejected",
        description: `${itemName} has been rejected`,
        variant: "destructive"
      });
      loadPendingRequests();
    }
  };

  const handleApproveLeave = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const { error } = await supabase.from('leave_requests').update({ status: 'approved' }).eq('id', id);
    if (!error) {
      toast({ title: "Leave Approved", description: `Leave request for ${name} has been approved.` });
      loadPendingRequests();
    } else {
      toast({ title: "Error", description: "Failed to approve leave request", variant: "destructive" });
    }
  };

  const handleRejectLeave = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const { error } = await supabase.from('leave_requests').update({ status: 'rejected' }).eq('id', id);
    if (!error) {
      toast({ title: "Leave Rejected", description: `Leave request for ${name} has been rejected.`, variant: "destructive" });
      loadPendingRequests();
    } else {
      toast({ title: "Error", description: "Failed to reject leave request", variant: "destructive" });
    }
  };

  const handleApproveCashAdvance = async (id: string, name: string, amount: number, advProject: string | null, reason: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const { error } = await supabase.from('cash_advance_requests').update({ status: 'approved' }).eq('id', id);
    if (!error) {
      // Auto-generate voucher for cash advance
      await supabase.from('vouchers').insert({
        type: 'payment',
        voucher_number: `PV-${Math.floor(Math.random() * 10000)}`,
        date: new Date().toISOString().split("T")[0],
        amount: amount,
        payee: name || 'Site Worker',
        description: `Cash Advance: ${reason}`,
        project_id: advProject,
        status: 'approved'
      });

      toast({ title: "Cash Advance Approved", description: `${name}'s request for ${formatCurrency(Number(amount || 0))} approved.` });
      loadPendingRequests();
    } else {
      toast({ title: "Error", description: "Failed to approve request", variant: "destructive" });
    }
  };

  const handleRejectCashAdvance = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const { error } = await supabase.from('cash_advance_requests').update({ status: 'rejected' }).eq('id', id);
    if (!error) {
      toast({ title: "Cash Advance Rejected", description: `${name}'s request rejected.`, variant: "destructive" });
      loadPendingRequests();
    } else {
      toast({ title: "Error", description: "Failed to reject request", variant: "destructive" });
    }
  };

  const handleApprovePurchaseGM = async (purchase: any, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    const { error } = await supabase.from('purchases').update({ status: 'approved', voucher_number: 'Pending Issue' }).eq('id', purchase.id);
    
    if (!error) {
      // Auto-generate voucher in Accounting
      await supabase.from('vouchers').insert({
        voucher_number: `PV-${Math.floor(10000 + Math.random() * 90000)}`,
        date: new Date().toISOString().split("T")[0],
        type: 'payment',
        payee: purchase.supplier,
        amount: purchase.quantity * (purchase.unit_cost || 0),
        description: `Approved PO ${purchase.order_number}: ${purchase.item_name} (${purchase.quantity} ${purchase.unit})`,
        project_id: purchase.project_id,
        status: 'approved'
      });

      toast({ title: "PO Approved", description: `Purchase Order approved and Payment Voucher generated.` });
      loadPendingRequests();
    }
  };

  const handleRejectPurchaseGM = async (purchaseId: string, itemName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (isLocked) return;
    await supabase.from('purchases').update({ status: 'pending' }).eq('id', purchaseId);
    toast({ title: "PO Rejected", description: `${itemName} returned to Purchasing for revision.`, variant: "destructive" });
    loadPendingRequests();
  };

  const handleLogout = async () => {
    localStorage.removeItem('app_assigned_modules');
    localStorage.removeItem('app_assigned_module');
    localStorage.removeItem('app_user_name');
    localStorage.removeItem('app_user_email');
    await authService.signOut();
    router.push('/auth/login');
  };

  const handleClearRecent = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const newCleared = [
      ...clearedUpdateIds,
      ...resolvedCashAdvances.map(a => `adv-${a.id}`),
      ...resolvedLeaves.map(l => `leave-${l.id}`),
      ...resolvedRequests.map(r => `req-${r.id}`),
      ...recentReceivedDeliveries.map(d => `del-${d.id}`),
    ];
    setClearedUpdateIds(newCleared);
    localStorage.setItem('app_cleared_updates', JSON.stringify(newCleared));
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen &&
      <div
        className="fixed inset-0 bg-black/50 z-40 lg:hidden"
        onClick={() => setSidebarOpen(false)} />

      }

      {/* Sidebar */}
      <aside className={cn(
        "fixed top-0 left-0 z-50 h-screen bg-card border-r transition-all duration-300 ease-in-out lg:translate-x-0 flex flex-col",
        sidebarOpen ? "translate-x-0" : "-translate-x-full",
        sidebarCollapsed ? "w-[80px]" : "w-64"
      )}>
        {/* Floating Collapse Toggle */}
        <Button
          variant="outline"
          size="icon"
          className="absolute -right-3.5 top-20 h-7 w-7 rounded-full bg-background border shadow-sm z-50 hidden lg:flex text-muted-foreground hover:text-foreground"
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4 ml-0.5" /> : <ChevronLeft className="h-4 w-4 mr-0.5" />}
        </Button>

        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                TX
              </div>
              {!sidebarCollapsed && (
                <div className="min-w-[120px]">
                  <h1 className="text-lg font-heading font-bold text-primary leading-tight">
                    Thea-X
                  </h1>
                  <p className="text-xs text-muted-foreground">Construction Accounting</p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden shrink-0"
              onClick={() => setSidebarOpen(false)}>
              
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {navigation.filter((item) => {
                if (assignedModules.includes("GM")) {
                  const isRestrictedPlan = currentPlan === "starter" || currentPlan === "trial" || isTrial;
                  const isRestrictedModule = item.name === "Human Resources" || item.name === "Warehouse" || item.name === "Project Manager";
                  return !(isRestrictedPlan && isRestrictedModule);
                }
                return assignedModules.includes(item.name);
              }).map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.href;

                const acctCount = pendingCashAdvances.length + pendingRequests.filter((r) => ['Equipment (Rentals)', 'PPE', 'Petty Cash'].includes(r.request_type)).length + approvedVouchers.length;
                const whseCount = pendingRequests.filter((r) => ['Tools', 'Equipment (Warehouse)', 'PPE', 'Materials'].includes(r.request_type) || !r.request_type).length;
                const hrCount = pendingLeaves.length + expiringDocuments.length;
                const purchCount = pendingPurchases.length;

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      title={sidebarCollapsed ? item.name : undefined}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative",
                        isActive ?
                        "bg-primary text-primary-foreground" :
                        "text-muted-foreground hover:bg-secondary hover:text-foreground",
                        sidebarCollapsed && "justify-center"
                      )}
                      onClick={() => setSidebarOpen(false)}>
                      
                      <Icon className="h-5 w-5 shrink-0" />
                      {!sidebarCollapsed && <span className="truncate">{item.name}</span>}
                      {!sidebarCollapsed && item.name === "Accounting" && acctCount > 0 &&
                      <Badge variant="destructive" className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px] shrink-0">
                          {acctCount}
                        </Badge>
                      }
                      {!sidebarCollapsed && item.name === "Warehouse" && whseCount > 0 &&
                      <Badge variant="destructive" className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px] shrink-0">
                          {whseCount}
                        </Badge>
                      }
                      {!sidebarCollapsed && item.name === "Human Resources" && hrCount > 0 &&
                      <Badge variant="destructive" className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px] shrink-0">
                          {hrCount}
                        </Badge>
                      }
                      {!sidebarCollapsed && item.name === "Purchasing" && purchCount > 0 &&
                      <Badge variant="destructive" className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px] shrink-0">
                          {purchCount}
                        </Badge>
                      }
                      {sidebarCollapsed && (acctCount > 0 || whseCount > 0 || hrCount > 0 || purchCount > 0) && ['Accounting', 'Warehouse', 'Human Resources', 'Purchasing'].includes(item.name) && (
                        <div className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive border-2 border-card"></div>
                      )}
                    </Link>
                  </li>);

              })}
            </ul>
          </nav>

          {/* System Navigation (Separated visually) */}
          <div className="mt-auto px-3 py-4 border-t space-y-1 shrink-0">
            {!sidebarCollapsed && (
              <p className="px-3 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 truncate">
                {assignedModules.includes("GM") ? "System Settings" : "Preferences"}
              </p>
            )}
            <Link 
              href="/settings" 
              title={sidebarCollapsed ? (assignedModules.includes("GM") ? "Company Settings" : "Settings") : undefined}
              className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors", router.pathname === "/settings" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground", sidebarCollapsed && "justify-center")} 
              onClick={() => setSidebarOpen(false)}>
              <Settings className="h-4 w-4 shrink-0" />
              {!sidebarCollapsed && <span className="truncate">{assignedModules.includes("GM") ? "Company Settings" : "Settings"}</span>}
            </Link>
            {assignedModules.includes("GM") && (
              <Link 
                href="/subscription" 
                title={sidebarCollapsed ? "Subscription" : undefined}
                className={cn("flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors", router.pathname === "/subscription" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground", sidebarCollapsed && "justify-center")} 
                onClick={() => setSidebarOpen(false)}>
                <CreditCard className="h-4 w-4 shrink-0" />
                {!sidebarCollapsed && <span className="truncate">Subscription</span>}
              </Link>
            )}
          </div>

          {/* Footer */}
          <div className="border-t p-4 shrink-0">
            <div className={cn("flex items-center gap-3", sidebarCollapsed ? "justify-center px-0" : "px-3 py-2")}>
              <div className="h-8 w-8 shrink-0 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              {!sidebarCollapsed && (
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{userName}</p>
                  <p className="text-xs text-muted-foreground truncate">{assignedModule} Role</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={cn("transition-all duration-300 ease-in-out", sidebarCollapsed ? "lg:pl-[80px]" : "lg:pl-64")}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-card px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden shrink-0"
            onClick={() => setSidebarOpen(true)}>
            
            <Menu className="h-5 w-5" />
          </Button>
          
          {/* Company Information */}
          <div className="flex items-center gap-3 lg:border-l lg:pl-6 lg:-ml-2 lg:h-10">
            {company.logo ?
            <img src={company.logo} alt="Company Logo" className="h-8 w-8 shrink-0 rounded object-contain bg-white border" /> :

            <div className="h-8 w-8 shrink-0 rounded bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                {company.name ? company.name.substring(0, 2).toUpperCase() : "CO"}
              </div>
            }
            <div className="flex flex-col min-w-0 hidden sm:flex">
              <h2 className="text-sm font-semibold leading-tight text-foreground truncate max-w-[200px] lg:max-w-[300px]">
                {company.name || "Company Name"}
              </h2>
              {company.address &&
              <p className="text-[10px] text-muted-foreground truncate max-w-[200px] lg:max-w-[300px]">
                  {company.address}
                </p>
              }
            </div>
          </div>

          <div className="flex-1" />
          
          {/* Trial Banner */}
          {!isLocked && isTrial && daysRemaining > 0 && (
            <div className="hidden md:flex items-center px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
              <AlertCircle className="h-3 w-3 mr-1" />
              {daysRemaining} {daysRemaining === 1 ? 'day' : 'days'} left in Trial
            </div>
          )}

          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden md:block">
              {new Date().toLocaleDateString("en-US", {
                weekday: "short",
                year: "numeric",
                month: "short",
                day: "numeric"
              })}
            </span>

            {/* Notifications */}
            {(() => {
              const isGM = assignedModules.includes("GM");
              const isHR = assignedModules.includes("Human Resources");
              const isAccounting = assignedModules.includes("Accounting");
              const isWarehouse = assignedModules.includes("Warehouse");
              const isSitePersonnel = assignedModules.includes("Site Personnel");
              const isPurchasing = assignedModules.includes("Purchasing");
              
              // Pending Actions
              const displayPendingAdvances = (isGM || isAccounting) ? pendingCashAdvances : [];
              const displayPendingLeaves = (isGM || isHR) ? pendingLeaves : [];
              const displayExpiring = (isGM || isHR) ? expiringDocuments : [];
              const displayPendingRequests = pendingRequests.filter(req => {
                if (isGM) return true;
                const isAcctReq = ['Equipment (Rentals)', 'PPE', 'Petty Cash'].includes(req.request_type);
                const isWhseReq = ['Tools', 'Equipment (Warehouse)', 'PPE', 'Materials'].includes(req.request_type) || !req.request_type;
                if (isAccounting && isAcctReq) return true;
                if (isWarehouse && isWhseReq) return true;
                return false;
              });

              const displayPendingDeliveries = (isGM || isSitePersonnel) ? pendingDeliveries : [];
              const displayPendingPurchases = (isGM || isPurchasing) ? pendingPurchases : [];
              const displayGmPurchases = isGM ? pendingGmPurchases : [];
              const displayApprovedVouchers = isAccounting ? approvedVouchers : [];

              // Resolved Updates
              const displayResolvedAdvances = resolvedCashAdvances.filter(adv => {
                if (clearedUpdateIds.includes(`adv-${adv.id}`)) return false;
                if (isGM || isSitePersonnel) return true;
                if (isAccounting && adv.status === 'approved') return true;
                return false;
              });

              const displayResolvedLeaves = resolvedLeaves.filter(leave => {
                if (clearedUpdateIds.includes(`leave-${leave.id}`)) return false;
                if (isGM || isSitePersonnel) return true;
                if (isHR && leave.status === 'approved') return true;
                return false;
              });

              const displayReceivedDeliveries = recentReceivedDeliveries.filter(del => {
                if (clearedUpdateIds.includes(`del-${del.id}`)) return false;
                if (isGM || isWarehouse) return true;
                return false;
              });

              const displayResolvedRequests = resolvedRequests.filter(req => {
                if (clearedUpdateIds.includes(`req-${req.id}`)) return false;
                if (isGM || isSitePersonnel) return true;
                const isAcctReq = ['Equipment (Rentals)', 'PPE', 'Petty Cash'].includes(req.request_type);
                const isWhseReq = ['Tools', 'Equipment (Warehouse)', 'PPE', 'Materials'].includes(req.request_type) || !req.request_type;
                if (isAccounting && isAcctReq && req.status === 'approved') return true;
                if (isWarehouse && isWhseReq && req.status === 'approved') return true;
                return false;
              });

              const totalNotifications = displayPendingAdvances.length + displayPendingLeaves.length + displayExpiring.length + displayPendingRequests.length + displayPendingDeliveries.length + displayPendingPurchases.length + displayGmPurchases.length + displayApprovedVouchers.length + displayResolvedAdvances.length + displayResolvedLeaves.length + displayResolvedRequests.length + displayReceivedDeliveries.length;
              const hasActionRequired = displayPendingAdvances.length > 0 || displayPendingLeaves.length > 0 || displayExpiring.length > 0 || displayPendingRequests.length > 0 || displayPendingDeliveries.length > 0 || displayPendingPurchases.length > 0 || displayGmPurchases.length > 0 || displayApprovedVouchers.length > 0;
              const hasRecentUpdates = displayResolvedAdvances.length > 0 || displayResolvedLeaves.length > 0 || displayResolvedRequests.length > 0 || displayReceivedDeliveries.length > 0;

              const currentNotificationIds = [
                ...displayPendingAdvances,
                ...displayPendingLeaves,
                ...displayExpiring,
                ...displayPendingRequests,
                ...displayPendingDeliveries,
                ...displayPendingPurchases,
                ...displayGmPurchases,
                ...displayApprovedVouchers,
                ...displayResolvedAdvances,
                ...displayResolvedLeaves,
                ...displayResolvedRequests,
                ...displayReceivedDeliveries
              ].map((item: any) => `${item.id}-${item.status || 'pending'}`).sort().join(',');

              const hasUnseenNotifications = totalNotifications > 0 && currentNotificationIds !== lastSeenNotificationIds;

              const handleClearRecent = (e: React.MouseEvent) => {
                e.preventDefault();
                e.stopPropagation();
                const newCleared = [
                  ...clearedUpdateIds,
                  ...displayResolvedAdvances.map(a => `adv-${a.id}`),
                  ...displayResolvedLeaves.map(l => `leave-${l.id}`),
                  ...displayResolvedRequests.map(r => `req-${r.id}`),
                  ...displayReceivedDeliveries.map(d => `del-${d.id}`),
                ];
                setClearedUpdateIds(newCleared);
                localStorage.setItem('app_cleared_updates', JSON.stringify(newCleared));
              };

              return (
                <DropdownMenu open={notificationOpen} onOpenChange={(open) => {
                  setNotificationOpen(open);
                  setLastSeenNotificationIds(currentNotificationIds);
                  localStorage.setItem('lastSeenNotificationIds', currentNotificationIds);
                }}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative">
                      <Bell className="h-5 w-5" />
                      {hasUnseenNotifications &&
                      <Badge
                        variant="destructive"
                        className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                        
                          {totalNotifications}
                        </Badge>
                      }
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80">
                    <div className="flex items-center justify-between px-3 py-2 border-b">
                      <DropdownMenuLabel className="p-0 font-semibold">
                        Notifications ({totalNotifications})
                      </DropdownMenuLabel>
                      {hasRecentUpdates && (
                        <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground hover:text-foreground" onClick={handleClearRecent}>
                          Clear Recent
                        </Button>
                      )}
                    </div>
                    {totalNotifications === 0 ? (
                      <div className="p-4 text-center text-sm text-muted-foreground">
                        No pending notifications
                      </div>
                    ) : (
                      <div className="max-h-[400px] overflow-y-auto overflow-x-hidden">
                        {hasActionRequired && (
                          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 sticky top-0 z-10 backdrop-blur">
                            Action Required
                          </div>
                        )}

                        {/* Approved Vouchers (Accounting) */}
                        {displayApprovedVouchers.map((voucher) => (
                          <DropdownMenuItem
                            key={`approved-voucher-${voucher.id}`}
                            className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              router.push('/accounting');
                              setNotificationOpen(false);
                            }}>
                            <div className="flex items-start justify-between w-full">
                              <span className="font-medium text-sm text-blue-700">Voucher to Issue</span>
                              <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50">
                                {formatCurrency(Number(voucher.amount || 0))}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold">
                              {voucher.description || 'Payment Voucher'}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Amount: {formatCurrency(Number(voucher.amount || 0))}
                            </span>
                          </DropdownMenuItem>
                        ))}

                        {/* GM Purchase Approvals */}
                        {displayGmPurchases.map((purchase) => (
                          <DropdownMenuItem
                            key={`gm-purchase-${purchase.id}`}
                            className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              router.push('/purchasing');
                              setNotificationOpen(false);
                            }}>
                            <div className="flex items-start justify-between w-full">
                              <span className="font-medium text-sm text-purple-700">GM Approval Required</span>
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200">
                                {purchase.supplier}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold">
                              {purchase.item_name} ({purchase.quantity} {purchase.unit})
                            </span>
                            <span className="text-xs text-muted-foreground font-bold">
                              Cost: {formatCurrency(Number(purchase.quantity || 0) * Number(purchase.unit_cost || 0))}
                            </span>
                            <div className="flex gap-2 w-full mt-1" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="default" disabled={isLocked} className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white" onClick={(e) => handleApprovePurchaseGM(purchase, e)}>
                                <Check className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button size="sm" variant="destructive" disabled={isLocked} className="flex-1 h-8" onClick={(e) => handleRejectPurchaseGM(purchase.id, purchase.item_name, e)}>
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          </DropdownMenuItem>
                        ))}

                        {/* Pending Purchases */}
                        {displayPendingPurchases.map((purchase) => (
                          <DropdownMenuItem
                            key={`pending-purchase-${purchase.id}`}
                            className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              router.push('/purchasing');
                              setNotificationOpen(false);
                            }}>
                            <div className="flex items-start justify-between w-full">
                              <span className="font-medium text-sm text-purple-700">Purchase Required</span>
                              <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-600 border-purple-200">
                                Pending
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold">
                              {purchase.item_name} ({purchase.quantity} {purchase.unit})
                            </span>
                            <span className="text-xs text-muted-foreground">
                              From: {purchase.voucher_number || "Direct Request"}
                            </span>
                          </DropdownMenuItem>
                        ))}

                        {/* Pending Deliveries from Warehouse */}
                        {displayPendingDeliveries.map((delivery) => {
                          const isFromPO = delivery.notes && delivery.notes.includes('From PO: PO-');
                          return (
                          <DropdownMenuItem
                            key={`pending-delivery-${delivery.id}`}
                            className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              router.push('/site-personnel?tab=deliveries');
                              setNotificationOpen(false);
                            }}>
                            <div className="flex items-start justify-between w-full">
                              <span className="font-medium text-sm text-blue-700">{isFromPO ? 'Incoming Delivery' : 'Deployed Item'}</span>
                              <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">
                                In Transit
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold">
                              {delivery.item_name} ({delivery.quantity} {delivery.unit})
                            </span>
                            <span className="text-xs text-muted-foreground">
                              To: {delivery.projects?.name || "Unknown Project"}
                            </span>
                          </DropdownMenuItem>
                          );
                        })}

                        {/* Pending Cash Advances */}
                        {displayPendingAdvances.map((adv) =>
                      <DropdownMenuItem
                        key={`pending-adv-${adv.id}`}
                        className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                        onClick={() => {
                          router.push('/site-personnel?tab=advances');
                          setNotificationOpen(false);
                        }}>
                        
                        <div className="flex items-start justify-between w-full">
                          <span className="font-medium text-sm">{adv.personnel?.name}</span>
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50">
                            {formatCurrency(Number(adv.amount || 0))}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {adv.projects?.name || "Unknown Project"}
                        </span>
                        <span className="text-xs text-muted-foreground italic truncate max-w-full">
                          "{adv.reason}"
                        </span>
                        <div className="flex gap-2 w-full mt-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                        size="sm"
                        variant="default"
                        disabled={isLocked}
                        className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white"
                        onClick={(e) => handleApproveCashAdvance(adv.id, adv.personnel?.name, adv.amount, adv.project_id, adv.reason, e)}>
                        
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                        size="sm"
                        variant="destructive"
                        disabled={isLocked}
                        className="flex-1 h-8"
                        onClick={(e) => handleRejectCashAdvance(adv.id, adv.personnel?.name, e)}>
                        
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </DropdownMenuItem>
                  )}

                        {displayPendingRequests.length > 0 &&
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 mt-2 sticky top-0 z-10 backdrop-blur">
                        Site Requests
                      </div>
                  }
                        {displayPendingRequests.map((req) =>
                  <DropdownMenuItem
                    key={`pending-req-${req.id}`}
                    className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                    onClick={() => {
                      router.push('/site-personnel?tab=request');
                      setNotificationOpen(false);
                    }}>
                    
                        <div className="flex items-start justify-between w-full">
                          <div className="flex flex-col">
                            <span className="font-medium text-sm">{req.item_name}</span>
                            <span className="text-[10px] text-muted-foreground uppercase tracking-wider">{req.request_type || 'Materials'}</span>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {req.quantity > 0 ? `${req.quantity} ${req.unit}` : ''}
                            {req.amount > 0 ? ` ${formatCurrency(Number(req.amount || 0))}` : ''}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {req.projects?.name || "Unknown Project"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          By: {req.requested_by} • {new Date(req.request_date).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2 w-full mt-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                        size="sm"
                        variant="default"
                        disabled={isLocked}
                        className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white"
                        onClick={(e) => handleApproveRequest(req, e)}>
                        
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                        size="sm"
                        variant="destructive"
                        disabled={isLocked}
                        className="flex-1 h-8"
                        onClick={(e) => handleRejectRequest(req.id, req.item_name, e)}>
                        
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </DropdownMenuItem>
                  )}

                        {displayPendingLeaves.length > 0 &&
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 mt-2 sticky top-0 z-10 backdrop-blur">
                        Leave Requests
                      </div>
                  }
                        {displayPendingLeaves.map((leave) =>
                  <DropdownMenuItem
                    key={`pending-leave-${leave.id}`}
                    className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                    onClick={() => {
                      router.push('/personnel?tab=leave');
                      setNotificationOpen(false);
                    }}>
                    
                        <div className="flex items-start justify-between w-full">
                          <span className="font-medium text-sm">{leave.personnel?.name}</span>
                          <Badge variant="outline" className="text-xs capitalize">
                            {leave.leave_type}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-muted-foreground italic truncate max-w-full">
                          "{leave.reason}"
                        </span>
                        <div className="flex gap-2 w-full mt-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                        size="sm"
                        variant="default"
                        disabled={isLocked}
                        className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white"
                        onClick={(e) => handleApproveLeave(leave.id, leave.personnel?.name, e)}>
                        
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                        size="sm"
                        variant="destructive"
                        disabled={isLocked}
                        className="flex-1 h-8"
                        onClick={(e) => handleRejectLeave(leave.id, leave.personnel?.name, e)}>
                        
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </DropdownMenuItem>
                  )}

                        {displayExpiring.length > 0 &&
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 mt-2 sticky top-0 z-10 backdrop-blur">
                        Expiring Documents
                      </div>
                  }
                        {displayExpiring.map((doc) => {
                    const daysToPassportExpiry = doc.passport_expiry_date ? Math.ceil((new Date(doc.passport_expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : Infinity;
                    const daysToVisaExpiry = doc.visa_expiry_date ? Math.ceil((new Date(doc.visa_expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : Infinity;
                    const docType = [];
                    if (daysToPassportExpiry <= 30) docType.push("Passport");
                    if (daysToVisaExpiry <= 30) docType.push("Visa");

                    return (
                      <DropdownMenuItem
                        key={`doc-${doc.id}`}
                        className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-red-50"
                        onClick={() => {
                          router.push('/personnel');
                          setNotificationOpen(false);
                        }}>
                        
                          <div className="flex items-start justify-between w-full">
                            <span className="font-medium text-sm text-red-700">{doc.personnel?.name}</span>
                            <Badge variant="destructive" className="text-[10px]">Action Required</Badge>
                          </div>
                          <span className="text-xs text-red-600 font-medium">
                            {docType.join(" & ")} expiring soon or expired.
                          </span>
                        </DropdownMenuItem>);

                  })}

                        {hasRecentUpdates && (
                          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 mt-2 sticky top-0 z-10 backdrop-blur">
                            Recent Updates
                          </div>
                        )}

                        {/* Received Deliveries */}
                        {displayReceivedDeliveries.map((delivery) => (
                          <DropdownMenuItem
                            key={`received-delivery-${delivery.id}`}
                            className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              router.push(isWarehouse ? '/warehouse' : '/site-personnel?tab=deliveries');
                              setNotificationOpen(false);
                            }}>
                            <div className="flex items-start justify-between w-full">
                              <span className="font-medium text-sm text-green-700">Site Received Item</span>
                              <Badge variant="default" className="text-[10px] bg-green-600">
                                Received
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground font-semibold">
                              {delivery.item_name} ({delivery.quantity} {delivery.unit})
                            </span>
                            <span className="text-xs text-muted-foreground">
                              At: {delivery.projects?.name || "Unknown Project"}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              By: {delivery.received_by || "Site Staff"}
                            </span>
                          </DropdownMenuItem>
                        ))}

                        {/* Resolved Cash Advances */}
                        {displayResolvedAdvances.map((adv) => (
                          <DropdownMenuItem
                            key={`res-adv-${adv.id}`}
                            className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              router.push('/site-personnel?tab=advances');
                              setNotificationOpen(false);
                            }}>
                            <div className="flex items-start justify-between w-full">
                              <span className="font-medium text-sm">Cash Advance: {adv.personnel?.name}</span>
                              <Badge variant={adv.status === 'approved' ? 'default' : 'destructive'} className={adv.status === 'approved' ? 'bg-green-600' : ''}>
                                {adv.status}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground italic">"{adv.reason}"</span>
                          </DropdownMenuItem>
                        ))}

                        {/* Resolved Site Requests */}
                        {displayResolvedRequests.map((req) => (
                          <DropdownMenuItem
                            key={`res-req-${req.id}`}
                            className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              router.push('/site-personnel?tab=request');
                              setNotificationOpen(false);
                            }}>
                            <div className="flex items-start justify-between w-full">
                              <span className="font-medium text-sm">{req.item_name}</span>
                              <Badge variant={req.status === 'approved' ? 'default' : 'destructive'} className={req.status === 'approved' ? 'bg-green-600' : ''}>
                                {req.status}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{req.request_type || 'Materials'} - {req.quantity} {req.unit}</span>
                          </DropdownMenuItem>
                        ))}

                        {/* Resolved Leaves */}
                        {displayResolvedLeaves.map((leave) => (
                          <DropdownMenuItem
                            key={`res-leave-${leave.id}`}
                            className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                            onClick={() => {
                              router.push('/personnel?tab=leave');
                              setNotificationOpen(false);
                            }}>
                            <div className="flex items-start justify-between w-full">
                              <span className="font-medium text-sm">Leave: {leave.personnel?.name}</span>
                              <Badge variant={leave.status === 'approved' ? 'default' : 'destructive'} className={leave.status === 'approved' ? 'bg-green-600' : ''}>
                                {leave.status}
                              </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">{new Date(leave.start_date).toLocaleDateString()} - {new Date(leave.end_date).toLocaleDateString()}</span>
                          </DropdownMenuItem>
                        ))}
                      </div>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              );
            })()}

            {/* Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full">
                  <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                    {userName.charAt(0).toUpperCase()}
                  </div>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium">{userName}</p>
                    <p className="text-xs text-muted-foreground">{userEmail}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {assignedModules.map(mod => (
                        <Badge key={mod} variant="secondary" className="text-[10px] uppercase tracking-wider">{mod}</Badge>
                      ))}
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => router.push('/settings')}>
                  <Settings className="mr-2 h-4 w-4" />
                  {assignedModules.includes("GM") ? "Company Settings" : "Settings"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/account')}>
                  <User className="mr-2 h-4 w-4" />
                  Account Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600 focus:text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Persistent Read-Only Banner */}
        {isLocked && router.pathname !== '/subscription' && (
          <div className="bg-destructive/10 border-b border-destructive/20 px-6 py-3 flex items-center justify-between sticky top-16 z-20 backdrop-blur-sm">
            <div className="flex items-center gap-3">
              <Lock className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-bold text-destructive">
                  {lockReason === "trial_expired" ? "Trial Expired - Read-Only Mode" : "Subscription Expired - Read-Only Mode"}
                </p>
                <p className="text-xs text-destructive/80 hidden sm:block">
                  {assignedModules.includes("GM") 
                    ? "You can view your data, but adding, editing, or deleting is disabled until you upgrade."
                    : "You can view your data, but adding, editing, or deleting is disabled until your General Manager renews your access."}
                </p>
              </div>
            </div>
            {assignedModules.includes("GM") && (
              <Button size="sm" variant="destructive" onClick={() => router.push('/subscription')}>
                Upgrade Now
              </Button>
            )}
          </div>
        )}

        {/* Page content */}
        <main className={cn("p-6 relative min-h-[calc(100vh-4rem)] overflow-visible", isLocked && "pt-4")}>
          {children}
          <AIChatAssistant contained />
        </main>
      </div>

      {/* Global AI Chat Assistant */}
      <AIChatAssistant />
    </div>);

}