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
  XCircle } from
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

interface LayoutProps {
  children: React.ReactNode;
}

const navigation = [
{ name: "Dashboard", href: "/", icon: LayoutDashboard },
{ name: "Project Profile", href: "/projects", icon: FolderKanban },
{ name: "Site Personnel", href: "/site-personnel", icon: ClipboardList },
{ name: "Purchasing", href: "/purchasing", icon: ShoppingCart },
{ name: "Accounting", href: "/accounting", icon: Calculator },
{ name: "Human Resources", href: "/personnel", icon: Users },
{ name: "Warehouse", href: "/warehouse", icon: Warehouse },
{ name: "Analytics", href: "/analytics", icon: BarChart3 },
{ name: "Settings", href: "/settings", icon: Settings },
{ name: "Subscription", href: "/subscription", icon: CreditCard }];


export function Layout({ children }: LayoutProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { company, currentPlan, currency, isTrialExpired, daysRemaining } = useSettings();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingLeaves, setPendingLeaves] = useState<any[]>([]);
  const [pendingCashAdvances, setPendingCashAdvances] = useState<any[]>([]);
  const [expiringDocuments, setExpiringDocuments] = useState<any[]>([]);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [assignedModule, setAssignedModule] = useState<string>("GM"); // Keeping for legacy reference if needed
  const [assignedModules, setAssignedModules] = useState<string[]>(["GM"]);
  const [userName, setUserName] = useState<string>("Admin User");
  const [userEmail, setUserEmail] = useState<string>("");

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
  };

  const handleApproveRequest = async (req: any, e: React.MouseEvent) => {
    e.stopPropagation();
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
      // Auto-generate voucher if it has an amount
      if (req.amount > 0) {
        await supabase.from('vouchers').insert({
          type: 'payment',
          voucher_number: `PV-${Math.floor(Math.random() * 10000)}`,
          date: new Date().toISOString().split("T")[0],
          amount: req.amount,
          payee: req.requested_by || 'Site Personnel',
          description: `Approved ${req.request_type || 'Materials'}: ${req.item_name}`,
          project_id: req.project_id,
          status: 'approved'
        });
      }

      toast({
        title: "Request Approved",
        description: `${req.item_name} has been approved`
      });
      loadPendingRequests();
    }
  };

  const handleRejectRequest = async (requestId: string, itemName: string, e: React.MouseEvent) => {
    e.stopPropagation();
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

      toast({ title: "Cash Advance Approved", description: `${name}'s request for ${currency || '$'}${amount} approved.` });
      loadPendingRequests();
    } else {
      toast({ title: "Error", description: "Failed to approve request", variant: "destructive" });
    }
  };

  const handleRejectCashAdvance = async (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { error } = await supabase.from('cash_advance_requests').update({ status: 'rejected' }).eq('id', id);
    if (!error) {
      toast({ title: "Cash Advance Rejected", description: `${name}'s request rejected.`, variant: "destructive" });
      loadPendingRequests();
    } else {
      toast({ title: "Error", description: "Failed to reject request", variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    router.push('/auth/login');
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
        "fixed top-0 left-0 z-50 h-screen w-64 bg-card border-r transition-transform duration-300 ease-in-out lg:translate-x-0",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-6 border-b">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-lg">
                TX
              </div>
              <div>
                <h1 className="text-lg font-heading font-bold text-primary leading-tight">
                  Thea-X
                </h1>
                <p className="text-xs text-muted-foreground">Construction Accounting</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}>
              
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto py-4">
            <ul className="space-y-1 px-3">
              {navigation.filter((item) => {
                if (assignedModules.includes("GM")) {
                  return !(currentPlan === "starter" && item.name === "Human Resources");
                }
                return assignedModules.includes(item.name);
              }).map((item) => {
                const Icon = item.icon;
                const isActive = router.pathname === item.href;

                const acctCount = pendingCashAdvances.length + pendingRequests.filter((r) => ['Equipment (Rentals)', 'PPE', 'Petty Cash'].includes(r.request_type)).length;
                const whseCount = pendingRequests.filter((r) => ['Tools', 'Equipment (Warehouse)', 'PPE', 'Materials'].includes(r.request_type) || !r.request_type).length;
                const hrCount = pendingLeaves.length + expiringDocuments.length;

                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                        isActive ?
                        "bg-primary text-primary-foreground" :
                        "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      )}
                      onClick={() => setSidebarOpen(false)}>
                      
                      <Icon className="h-5 w-5 shrink-0" />
                      {item.name}
                      {item.name === "Accounting" && acctCount > 0 &&
                      <Badge variant="destructive" className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px]">
                          {acctCount}
                        </Badge>
                      }
                      {item.name === "Warehouse" && whseCount > 0 &&
                      <Badge variant="destructive" className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px]">
                          {whseCount}
                        </Badge>
                      }
                      {item.name === "Human Resources" && hrCount > 0 &&
                      <Badge variant="destructive" className="ml-auto h-5 px-1.5 flex items-center justify-center text-[10px]">
                          {hrCount}
                        </Badge>
                      }
                    </Link>
                  </li>);

              })}
            </ul>
          </nav>

          {/* Footer */}
          <div className="border-t p-4">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold text-sm">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{userName}</p>
                <p className="text-xs text-muted-foreground truncate">{assignedModule} Role</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
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
          {!isTrialExpired && daysRemaining > 0 && (
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
            <DropdownMenu open={notificationOpen} onOpenChange={setNotificationOpen}>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5" />
                  {pendingRequests.length + pendingLeaves.length + pendingCashAdvances.length + expiringDocuments.length > 0 &&
                  <Badge
                    variant="destructive"
                    className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                    
                      {pendingRequests.length + pendingLeaves.length + pendingCashAdvances.length + expiringDocuments.length}
                    </Badge>
                  }
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel className="font-semibold">
                  Notifications ({pendingRequests.length + pendingLeaves.length + pendingCashAdvances.length + expiringDocuments.length} pending)
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {pendingRequests.length === 0 && pendingLeaves.length === 0 && pendingCashAdvances.length === 0 && expiringDocuments.length === 0 ?
                <div className="p-4 text-center text-sm text-muted-foreground">
                    No pending notifications
                  </div> :

                <ScrollArea className="max-h-[400px]">
                    {pendingCashAdvances.length > 0 &&
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50">
                        Cash Advances
                      </div>
                  }
                    {pendingCashAdvances.map((adv) =>
                  <DropdownMenuItem
                    key={adv.id}
                    className="flex flex-col items-start gap-2 p-3 cursor-pointer hover:bg-muted"
                    onClick={() => {
                      router.push('/accounting');
                      setNotificationOpen(false);
                    }}>
                    
                        <div className="flex items-start justify-between w-full">
                          <span className="font-medium text-sm">{adv.personnel?.name}</span>
                          <Badge variant="outline" className="text-xs text-orange-600 border-orange-200 bg-orange-50">
                            {currency || '$'} {adv.amount}
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
                        className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white"
                        onClick={(e) => handleApproveCashAdvance(adv.id, adv.personnel?.name, adv.amount, adv.project_id, adv.reason, e)}>
                        
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-8"
                        onClick={(e) => handleRejectCashAdvance(adv.id, adv.personnel?.name, e)}>
                        
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </DropdownMenuItem>
                  )}

                    {pendingRequests.length > 0 &&
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 mt-2">
                        Site Requests
                      </div>
                  }
                    {pendingRequests.map((req) =>
                  <DropdownMenuItem
                    key={req.id}
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
                            {req.amount > 0 ? ` ${currency || '$'}${req.amount}` : ''}
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
                        className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white"
                        onClick={(e) => handleApproveRequest(req, e)}>
                        
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-8"
                        onClick={(e) => handleRejectRequest(req.id, req.item_name, e)}>
                        
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </DropdownMenuItem>
                  )}

                    {pendingLeaves.length > 0 &&
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 mt-2">
                        Leave Requests
                      </div>
                  }
                    {pendingLeaves.map((leave) =>
                  <DropdownMenuItem
                    key={leave.id}
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
                        className="flex-1 h-8 bg-green-600 hover:bg-green-700 text-white"
                        onClick={(e) => handleApproveLeave(leave.id, leave.personnel?.name, e)}>
                        
                            <Check className="h-3 w-3 mr-1" />
                            Approve
                          </Button>
                          <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1 h-8"
                        onClick={(e) => handleRejectLeave(leave.id, leave.personnel?.name, e)}>
                        
                            <XCircle className="h-3 w-3 mr-1" />
                            Reject
                          </Button>
                        </div>
                      </DropdownMenuItem>
                  )}

                    {expiringDocuments.length > 0 &&
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase bg-muted/50 mt-2 text-red-700">
                        Expiring Documents
                      </div>
                  }
                    {expiringDocuments.map((doc) => {
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
                  </ScrollArea>
                }
              </DropdownMenuContent>
            </DropdownMenu>

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
                {assignedModules.includes("GM") && (
                  <DropdownMenuItem onClick={() => router.push('/settings')}>
                    <Settings className="mr-2 h-4 w-4" />
                    Company Settings
                  </DropdownMenuItem>
                )}
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

        {/* Page content */}
        <main className="p-6 relative min-h-[calc(100vh-4rem)]">
          {isTrialExpired && router.pathname !== '/subscription' && router.pathname !== '/account' && (
            <div className="absolute inset-0 z-40 bg-background/80 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center border rounded-lg m-6">
              <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
                <Lock className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-3xl font-heading font-bold mb-2">Trial Expired</h2>
              <p className="text-muted-foreground max-w-md mb-8 text-lg">
                Your 7-day Professional trial has ended. All modules are currently locked and buttons have been disabled.
              </p>
              <Button size="lg" onClick={() => router.push('/subscription')} className="text-lg px-8">
                <CreditCard className="mr-2 h-5 w-5" />
                Upgrade to Unlock
              </Button>
            </div>
          )}
          
          <div className={cn(isTrialExpired && router.pathname !== '/subscription' && router.pathname !== '/account' && "pointer-events-none opacity-20 select-none blur-sm transition-all duration-300")}>
            {children}
          </div>
        </main>
      </div>
    </div>);

}