import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeProvider";
import { useSettings } from "@/contexts/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";
import { 
  Building2, 
  Bell, 
  Palette, 
  Save,
  Moon,
  Sun,
  DollarSign,
  Users,
  Key,
  Trash2,
  Edit,
  UserX,
  Check
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Settings() {
  const router = useRouter();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency, company, setCompany, currentPlan, isTrial, themeColor, setThemeColor, companyId } = useSettings();

  const [localCompany, setLocalCompany] = useState(company);
  const [notifications, setNotifications] = useState({
    emailNotifications: true,
    projectUpdates: true,
    inventoryAlerts: true,
    financialReports: false,
    weeklyDigest: true
  });

  const [invites, setInvites] = useState<any[]>([]);
  const [teamUsers, setTeamUsers] = useState<any[]>([]);
  const [selectedModules, setSelectedModules] = useState<string[]>(["Site Personnel"]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  
  // Edit User State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editModules, setEditModules] = useState<string[]>([]);
  const [editProjects, setEditProjects] = useState<string[]>([]);
  const [editExpiryDate, setEditExpiryDate] = useState<string>("");
  
  // Delete User State
  const [deletingUser, setDeletingUser] = useState<any>(null);

  const [isGM, setIsGM] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("appearance");
  const [activeAddOns, setActiveAddOns] = useState<Record<string, number>>({});

  useEffect(() => {
    setLocalCompany(company);
    
    if (companyId) {
      loadTeamData();
      loadProjects();
    }
    
    const checkGM = () => {
      const saved = localStorage.getItem('app_assigned_modules');
      if (saved) {
        const mods = JSON.parse(saved);
        const gm = mods.includes('GM');
        setIsGM(gm);
        if (gm) setActiveTab("company");
      }
    };
    checkGM();

    // Load purchased add-ons from subscription
    const savedAddOns = localStorage.getItem('app_subscription_features');
    if (savedAddOns) {
      try {
        setActiveAddOns(JSON.parse(savedAddOns));
      } catch(e) {}
    }
  }, [company, companyId]);

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name').order('name');
    setProjects(data || []);
  };

  const loadTeamData = async () => {
    if (!companyId) return;
    const { data: invData } = await supabase.from('invite_codes').select('*').eq('status', 'active').eq('company_id', companyId);
    setInvites(invData || []);
    
    const { data: usrData } = await supabase.from('profiles').select('*').not('assigned_module', 'eq', 'GM').eq('company_id', companyId);
    setTeamUsers(usrData || []);
  };

  const isStarter = currentPlan === 'starter' || currentPlan === 'trial' || isTrial;

  // Base limits based purely on the plan type
  const basePlanLimits: Record<string, number> = isStarter
    ? { 'Site Personnel': 1, 'Accounting': 1, 'Purchasing': 1, 'Human Resources': 0, 'Warehouse': 0 }
    : { 'Site Personnel': 3, 'Accounting': 1, 'Purchasing': 1, 'Human Resources': 1, 'Warehouse': 1 };

  // Calculate true limits: Base Plan + Purchased Add-ons
  const planLimits: Record<string, number> = {
    'Site Personnel': basePlanLimits['Site Personnel'] + (activeAddOns['extra_site'] || 0),
    'Accounting': basePlanLimits['Accounting'] + (activeAddOns['extra_acc'] || 0),
    'Purchasing': basePlanLimits['Purchasing'] + (activeAddOns['purchasing'] || 0),
    'Human Resources': basePlanLimits['Human Resources'], // Add-on not configured in billing yet
    'Warehouse': basePlanLimits['Warehouse'] // Add-on not configured in billing yet
  };

  const getUsageCount = (mod: string) => {
    const activeInvites = invites.filter(i => (i.modules && i.modules.includes(mod)) || i.module === mod).length;
    const activeUsers = teamUsers.filter(u => (u.assigned_modules && u.assigned_modules.includes(mod)) || u.assigned_module === mod).length;
    return activeInvites + activeUsers;
  };

  const getCombinedAccPurchUsage = () => {
    const activeInvites = invites.filter(i => {
      const mods = i.modules || [i.module];
      return mods.includes('Accounting') || mods.includes('Purchasing');
    }).length;
    const activeUsers = teamUsers.filter(u => {
      const mods = u.assigned_modules || [u.assigned_module];
      return mods.includes('Accounting') || mods.includes('Purchasing');
    }).length;
    return activeInvites + activeUsers;
  };

  const handleGenerateCode = async () => {
    if (selectedModules.length === 0) {
      toast({ title: "Error", description: "Select at least one module.", variant: "destructive" });
      return;
    }

    // Determine if this code consumes an Add-on seat or an Included seat
    let isAddon = false;

    if (isStarter && (selectedModules.includes('Accounting') || selectedModules.includes('Purchasing'))) {
      const includedAccPurchUsage = invites.filter(i => !i.is_addon && (i.modules?.includes('Accounting') || i.modules?.includes('Purchasing') || i.module === 'Accounting' || i.module === 'Purchasing')).length + 
                                    teamUsers.filter(u => !u.is_addon && (u.assigned_modules?.includes('Accounting') || u.assigned_modules?.includes('Purchasing') || u.assigned_module === 'Accounting' || u.assigned_module === 'Purchasing')).length;
      if (includedAccPurchUsage >= 1) { // 1 is the combined base limit for Starter
        isAddon = true;
      }
    }

    for (const mod of selectedModules) {
      if (isStarter && (mod === 'Accounting' || mod === 'Purchasing')) continue;
      
      const baseLimit = basePlanLimits[mod] || 0;
      const includedUsage = invites.filter(i => !i.is_addon && (i.modules?.includes(mod) || i.module === mod)).length + 
                            teamUsers.filter(u => !u.is_addon && (u.assigned_modules?.includes(mod) || u.assigned_module === mod)).length;
      
      if (includedUsage >= baseLimit) {
        isAddon = true;
      }
    }

    const prefix = isAddon ? 'ADD-' : 'INC-';
    const randomPart = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = prefix + randomPart;

    const { error } = await supabase.from('invite_codes').insert({
      code,
      module: selectedModules[0],
      modules: selectedModules,
      project_ids: selectedModules.includes("Site Personnel") ? selectedProjects : [],
      company_id: companyId,
      is_addon: isAddon
    });

    if (error) {
      toast({ title: "Error", description: "Failed to generate code.", variant: "destructive" });
    } else {
      toast({ title: "Code Generated", description: `Invite code ${code} created for ${selectedModules.join(", ")}.` });
      loadTeamData();
    }
  };

  const handleDeleteCode = async (id: string) => {
    await supabase.from('invite_codes').delete().eq('id', id);
    loadTeamData();
  };

  const handleSaveCompany = async () => {
    if (companyId) {
      await supabase.from('company_settings').update({
        name: localCompany.name,
        address: localCompany.address,
        tax_id: localCompany.taxId,
        website: localCompany.website,
        logo: localCompany.logo,
        auto_approve_materials: localCompany.auto_approve_materials
      }).eq('id', companyId);
    }
    setCompany(localCompany);
    toast({
      title: "Company Settings Updated",
      description: "Company information and automation preferences have been saved.",
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLocalCompany({ ...localCompany, logo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSaveNotifications = () => {
    toast({
      title: "Notification Preferences Saved",
      description: "Your notification settings have been updated.",
    });
  };

  const handleSaveCurrency = (val: any) => {
    setCurrency(val);
    toast({
      title: "Currency Updated",
      description: `Global currency has been set to ${val}.`,
    });
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">
            {isGM ? "Settings" : "Preferences"}
          </h1>
          <p className="text-muted-foreground">
            {isGM ? "Manage your company preferences and global application settings" : "Manage your application appearance and preferences"}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="shrink-0 flex flex-wrap w-full gap-1 h-auto bg-transparent p-0 mb-2">
            {isGM && (
              <>
                <TabsTrigger value="company" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100">
                  <Building2 className="h-3 w-3 mr-1.5 hidden sm:inline" /> Company
                </TabsTrigger>
                <TabsTrigger value="team" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-indigo-700 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                  <Users className="h-3 w-3 mr-1.5 hidden sm:inline" /> Team Access
                </TabsTrigger>
              </>
            )}
            <TabsTrigger value="appearance" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-emerald-700 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
              <Palette className="h-3 w-3 mr-1.5 hidden sm:inline" /> Appearance
            </TabsTrigger>
          </TabsList>

          <TabsContent value="company">
            <Card>
              <CardHeader>
                <CardTitle>Company Settings</CardTitle>
                <CardDescription>Manage your company information</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-6 mb-4">
                  {/* Logo Upload Section */}
                  <div className="shrink-0 flex flex-col items-center gap-3">
                    <Label>Company Logo</Label>
                    {localCompany.logo ? (
                      <img src={localCompany.logo} alt="Logo" className="h-24 w-24 object-contain rounded-md border bg-white" />
                    ) : (
                      <div className="h-24 w-24 rounded-md border bg-muted flex items-center justify-center text-xs text-muted-foreground">
                        No Logo
                      </div>
                    )}
                    <div className="relative">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleLogoUpload} 
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                      />
                      <Button type="button" variant="outline" size="sm">Upload Logo</Button>
                    </div>
                  </div>

                  {/* Company Info Fields */}
                  <div className="grid grid-cols-2 gap-4 flex-1">
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name</Label>
                      <Input
                        id="companyName"
                        value={localCompany.name}
                        onChange={(e) => setLocalCompany({ ...localCompany, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxId">Tax ID</Label>
                      <Input
                        id="taxId"
                        value={localCompany.taxId}
                        onChange={(e) => setLocalCompany({ ...localCompany, taxId: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="address">Office Address</Label>
                      <Input
                        id="address"
                        value={localCompany.address}
                        onChange={(e) => setLocalCompany({ ...localCompany, address: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2 col-span-2">
                      <Label htmlFor="website">Website</Label>
                      <Input
                        id="website"
                        value={localCompany.website}
                        onChange={(e) => setLocalCompany({ ...localCompany, website: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="space-y-4">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Bell className="h-5 w-5 text-primary" />
                    Automation & Workflows
                  </h3>
                  
                  <div className="flex flex-row items-center justify-between rounded-lg border p-4 bg-muted/20">
                    <div className="space-y-0.5">
                      <Label className="text-base font-semibold">Auto-Approve Material Requests</Label>
                      <p className="text-sm text-muted-foreground">
                        When enabled, all incoming material requests from Site Personnel will automatically be marked as "Approved", bypassing the manual review step.
                      </p>
                    </div>
                    <Switch
                      checked={localCompany.auto_approve_materials}
                      onCheckedChange={(checked) => setLocalCompany({ ...localCompany, auto_approve_materials: checked })}
                    />
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <Button onClick={handleSaveCompany} className="flex items-center gap-2 w-full sm:w-auto">
                    <Save className="h-4 w-4" />
                    Save Company Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="team">
            <Card>
              <CardHeader>
                <CardTitle>Team Access & Modules</CardTitle>
                <CardDescription>Generate invite codes to grant specific module access based on your {currentPlan} plan limits.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6 pt-4 border-t">
                  
                  {/* INCLUDED COLUMN */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg">Independent User (Included)</h3>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Invite Codes</h4>
                      {invites.filter(i => !i.is_addon).length === 0 ? (
                        <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-md border border-dashed">No active included invite codes.</p>
                      ) : (
                        <div className="border rounded-md divide-y">
                          {invites.filter(i => !i.is_addon).map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-3 bg-white">
                              <div>
                                <div className="font-mono font-bold text-sm tracking-widest text-primary">{inv.code}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(inv.modules && inv.modules.length > 0 ? inv.modules : [inv.module]).map((m: string) => (
                                    <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                                  ))}
                                </div>
                              </div>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteCode(inv.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Team Members</h4>
                      {teamUsers.filter(u => !u.is_addon).length === 0 ? (
                        <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-md border border-dashed">No included team members yet.</p>
                      ) : (
                        <div className="border rounded-md divide-y">
                          {teamUsers.filter(u => !u.is_addon).map(u => (
                            <div key={u.id} className="flex items-center justify-between p-3 bg-white">
                              <div>
                                <div className="font-medium text-sm">{u.email || u.full_name || 'User'}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(u.assigned_modules && u.assigned_modules.length > 0 ? u.assigned_modules : [u.assigned_module]).map((m: string) => (
                                    <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                                  ))}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  Auto-renews with GM plan
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                <Button size="sm" variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 hover:bg-emerald-50 h-6 px-2" onClick={() => router.push('/subscription')}>
                                  Renew Seat
                                </Button>
                                <div className="flex items-center gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => {
                                    setEditingUser(u);
                                    setEditModules(u.assigned_modules && u.assigned_modules.length > 0 ? u.assigned_modules : [u.assigned_module]);
                                    setEditProjects(u.assigned_project_ids || []);
                                    setEditExpiryDate(u.subscription_end_date || "");
                                  }} className="h-6 w-6">
                                    <Edit className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => setDeletingUser(u)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-6 w-6">
                                    <UserX className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ADD-ON COLUMN */}
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-8 w-8 rounded bg-emerald-100 flex items-center justify-center">
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                      </div>
                      <h3 className="font-semibold text-lg">Independent User (Add-ons)</h3>
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Invite Codes</h4>
                      {invites.filter(i => i.is_addon).length === 0 ? (
                        <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-md border border-dashed">No active add-on invite codes.</p>
                      ) : (
                        <div className="border rounded-md divide-y">
                          {invites.filter(i => i.is_addon).map(inv => (
                            <div key={inv.id} className="flex items-center justify-between p-3 bg-white">
                              <div>
                                <div className="font-mono font-bold text-sm tracking-widest text-emerald-600">{inv.code}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(inv.modules && inv.modules.length > 0 ? inv.modules : [inv.module]).map((m: string) => (
                                    <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                                  ))}
                                </div>
                              </div>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteCode(inv.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8">
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Active Team Members</h4>
                      {teamUsers.filter(u => u.is_addon).length === 0 ? (
                        <p className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-md border border-dashed">No add-on team members yet.</p>
                      ) : (
                        <div className="border rounded-md divide-y">
                          {teamUsers.filter(u => u.is_addon).map(u => (
                            <div key={u.id} className="flex items-center justify-between p-3 bg-white">
                              <div>
                                <div className="font-medium text-sm">{u.email || u.full_name || 'User'}</div>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {(u.assigned_modules && u.assigned_modules.length > 0 ? u.assigned_modules : [u.assigned_module]).map((m: string) => (
                                    <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                                  ))}
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">
                                  <strong className="text-foreground">Expiry:</strong> {u.subscription_end_date ? new Date(u.subscription_end_date).toLocaleDateString() : "Unset"}
                                  {u.subscription_end_date && new Date(u.subscription_end_date) < new Date() && (
                                    <Badge variant="destructive" className="ml-2 text-[10px]">Expired</Badge>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col gap-1 items-end">
                                <Button size="sm" variant="outline" className="text-[10px] border-emerald-500 text-emerald-600 hover:bg-emerald-50 h-6 px-2" onClick={() => router.push('/subscription')}>
                                  Renew Seat
                                </Button>
                                <div className="flex items-center gap-1">
                                  <Button size="icon" variant="ghost" onClick={() => {
                                    setEditingUser(u);
                                    setEditModules(u.assigned_modules && u.assigned_modules.length > 0 ? u.assigned_modules : [u.assigned_module]);
                                    setEditProjects(u.assigned_project_ids || []);
                                    setEditExpiryDate(u.subscription_end_date || "");
                                  }} className="h-6 w-6">
                                    <Edit className="w-3 h-3 text-muted-foreground" />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={() => setDeletingUser(u)} className="text-red-500 hover:text-red-700 hover:bg-red-50 h-6 w-6">
                                    <UserX className="w-3 h-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the visual mode and styling of the application</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between max-w-md">
                  <div className="space-y-0.5">
                    <Label className="flex items-center gap-2">
                      {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
                      Visual Theme
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Toggle between light and dark mode
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Light</span>
                    <Switch
                      checked={theme === "dark"}
                      onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
                    />
                    <span className="text-sm text-muted-foreground">Dark</span>
                  </div>
                </div>

                <Separator />

                <div>
                  <div className="space-y-0.5 mb-4">
                    <Label className="flex items-center gap-2">
                      <Palette className="h-4 w-4" />
                      Theme Color
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Choose your preferred accent color across the app
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {[
                      { name: "Blue", value: "blue", colorClass: "bg-blue-600" },
                      { name: "Green", value: "green", colorClass: "bg-green-600" },
                      { name: "Orange", value: "orange", colorClass: "bg-orange-500" },
                      { name: "Rose", value: "rose", colorClass: "bg-rose-600" },
                      { name: "Violet", value: "violet", colorClass: "bg-violet-600" },
                    ].map((c) => (
                      <button
                        key={c.value}
                        onClick={() => setThemeColor(c.value as any)}
                        className={cn(
                          "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                          c.colorClass,
                          themeColor === c.value ? "ring-2 ring-offset-2 ring-primary scale-110" : "ring-0 hover:scale-105"
                        )}
                        title={c.name}
                      >
                        {themeColor === c.value && <Check className="w-4 h-4 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
        </Tabs>

        {/* Edit User Access Dialog */}
        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User Access</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Assigned Modules</Label>
                <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2 bg-background">
                  {Object.keys(planLimits).map(mod => {
                    const isAccPurch = isStarter && (mod === 'Accounting' || mod === 'Purchasing');
                    const combinedLimit = isStarter ? 1 + (activeAddOns['extra_acc'] || 0) + (activeAddOns['purchasing'] || 0) : 0;
                    
                    const disabled = isAccPurch ? combinedLimit === 0 : planLimits[mod] === 0;
                    
                    return (
                      <div key={mod} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`edit-mod-${mod}`} 
                          checked={editModules.includes(mod)}
                          disabled={disabled}
                          onCheckedChange={(checked) => {
                            if (checked) setEditModules([...editModules, mod]);
                            else setEditModules(editModules.filter(m => m !== mod));
                          }}
                        />
                        <label htmlFor={`edit-mod-${mod}`} className={cn("text-sm font-medium leading-none cursor-pointer", disabled && "opacity-50")}>
                          {mod}
                        </label>
                      </div>
                    );
                  })}
                </div>
              </div>

              {editModules.includes("Site Personnel") && (
                <div className="space-y-2">
                  <Label>Restrict to Projects (Max {currentPlan === 'starter' || currentPlan === 'trial' || isTrial ? 2 : 'Unlimited'})</Label>
                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2 bg-background">
                    {projects.map(p => (
                      <div key={p.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`edit-proj-${p.id}`} 
                          checked={editProjects.includes(p.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if ((currentPlan === 'starter' || currentPlan === 'trial' || isTrial) && editProjects.length >= 2) {
                                toast({ title: "Limit Reached", description: "Starter/Trial plan allows a maximum of 2 projects per user.", variant: "destructive" });
                                return;
                              }
                              setEditProjects([...editProjects, p.id]);
                            } else {
                              setEditProjects(editProjects.filter(id => id !== p.id));
                            }
                          }}
                        />
                        <label htmlFor={`edit-proj-${p.id}`} className="text-sm font-medium cursor-pointer">
                          {p.name}
                        </label>
                      </div>
                    ))}
                    {projects.length === 0 && <p className="text-xs text-muted-foreground">No projects found.</p>}
                  </div>
                </div>
              )}

              <div className="space-y-2 pt-2 border-t mt-4">
                <Label>Custom Expiry Date (Add-on Seats)</Label>
                <Input 
                  type="date" 
                  value={editExpiryDate} 
                  onChange={(e) => setEditExpiryDate(e.target.value)} 
                />
                <p className="text-xs text-muted-foreground">Leave blank to synchronize with the GM's main billing cycle. Set a date to decouple this specific user.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>Cancel</Button>
              <Button onClick={async () => {
                try {
                  if (editModules.length === 0) {
                    toast({ title: "Error", description: "Select at least one module.", variant: "destructive" });
                    return;
                  }

                  if (isStarter && (editModules.includes('Accounting') || editModules.includes('Purchasing'))) {
                    const hadAccPurch = editingUser.assigned_modules?.includes('Accounting') || 
                                        editingUser.assigned_modules?.includes('Purchasing') || 
                                        editingUser.assigned_module === 'Accounting' || 
                                        editingUser.assigned_module === 'Purchasing';
                    
                    if (!hadAccPurch) {
                      const combinedLimit = 1 + (activeAddOns['extra_acc'] || 0) + (activeAddOns['purchasing'] || 0);
                      if (getCombinedAccPurchUsage() >= combinedLimit) {
                        toast({ 
                          title: "Limit Reached", 
                          description: `Starter/Trial plan allows a combined total of ${combinedLimit} user(s) for Accounting/Purchasing.`, 
                          variant: "destructive" 
                        });
                        return;
                      }
                    }
                  }

                  const isSitePersonnel = editModules.includes("Site Personnel");
                  const currentProjects = editingUser.assigned_project_ids || [];
                  const isProjectChanged = isSitePersonnel && JSON.stringify([...editProjects].sort()) !== JSON.stringify([...currentProjects].sort());

                  if (isProjectChanged) {
                    if ((editingUser.project_change_count || 0) >= 5) {
                      toast({ 
                        title: "Limit Reached", 
                        description: "You have reached the maximum limit of 5 project reassignments for this user.", 
                        variant: "destructive" 
                      });
                      return;
                    }
                  }

                  const updates: any = {
                    assigned_module: editModules[0],
                    assigned_modules: editModules,
                    assigned_project_ids: isSitePersonnel ? editProjects : [],
                    subscription_end_date: editExpiryDate || null
                  };

                  if (isProjectChanged) {
                    updates.project_change_count = (editingUser.project_change_count || 0) + 1;
                  }

                  const { error } = await supabase.from('profiles').update(updates).eq('id', editingUser.id);
                  
                  if (error) {
                    console.error("Supabase update error:", error);
                    toast({ title: "Error Saving", description: error.message || "Failed to update user access.", variant: "destructive" });
                  } else {
                    toast({ title: "Success", description: "User access updated successfully." });
                    setEditingUser(null);
                    loadTeamData();
                  }
                } catch (err: any) {
                  console.error("Caught error in save:", err);
                  toast({ title: "Error", description: err.message || "An unexpected error occurred.", variant: "destructive" });
                }
              }}>
                Save Changes
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Remove User Dialog */}
        <Dialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Remove Team Member</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p>Are you sure you want to remove <strong>{deletingUser?.email || deletingUser?.full_name || 'this user'}</strong> from the team?</p>
              <p className="text-sm text-muted-foreground mt-2">This will instantly revoke their access to all modules and free up their allocated seats.</p>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeletingUser(null)}>Cancel</Button>
              <Button variant="destructive" onClick={async () => {
                const { error } = await supabase.from('profiles').update({
                  assigned_module: null,
                  assigned_modules: [],
                  assigned_project_ids: []
                }).eq('id', deletingUser.id);
                
                if (error) {
                  toast({ title: "Error", description: "Failed to remove user.", variant: "destructive" });
                } else {
                  toast({ title: "User Removed", description: "Team member has been removed and seats are now available." });
                  setDeletingUser(null);
                  loadTeamData();
                }
              }}>
                Remove User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}