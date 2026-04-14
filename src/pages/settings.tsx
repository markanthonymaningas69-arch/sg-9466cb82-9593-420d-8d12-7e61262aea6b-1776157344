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
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeProvider";
import { useSettings } from "@/contexts/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";
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
  Trash2
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function Settings() {
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const { currency, setCurrency, company, setCompany, currentPlan } = useSettings();

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

  useEffect(() => {
    setLocalCompany(company);
    loadTeamData();
    loadProjects();
  }, [company]);

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, name').order('name');
    setProjects(data || []);
  };

  const loadTeamData = async () => {
    const { data: invData } = await supabase.from('invite_codes').select('*').eq('status', 'active');
    setInvites(invData || []);
    
    const { data: usrData } = await supabase.from('profiles').select('*').not('assigned_module', 'eq', 'GM');
    setTeamUsers(usrData || []);
  };

  const planLimits: Record<string, number> = currentPlan === 'starter' 
    ? { 'Site Personnel': 1, 'Accounting': 1, 'Purchasing': 0, 'Human Resources': 0, 'Warehouse': 0 }
    : { 'Site Personnel': 3, 'Accounting': 1, 'Purchasing': 1, 'Human Resources': 1, 'Warehouse': 1 };

  const getUsageCount = (mod: string) => {
    const activeInvites = invites.filter(i => (i.modules && i.modules.includes(mod)) || i.module === mod).length;
    const activeUsers = teamUsers.filter(u => (u.assigned_modules && u.assigned_modules.includes(mod)) || u.assigned_module === mod).length;
    return activeInvites + activeUsers;
  };

  const handleGenerateCode = async () => {
    if (selectedModules.length === 0) {
      toast({ title: "Error", description: "Select at least one module.", variant: "destructive" });
      return;
    }

    for (const mod of selectedModules) {
      const limit = planLimits[mod] || 0;
      const currentUsage = getUsageCount(mod);
      
      if (currentUsage >= limit) {
        toast({
          title: "Limit Reached",
          description: `Your ${currentPlan} plan only allows ${limit} user(s) for ${mod}. Upgrade to add more.`,
          variant: "destructive"
        });
        return;
      }
    }

    if (selectedModules.includes("Site Personnel") && currentPlan === 'starter' && selectedProjects.length > 2) {
      toast({ title: "Limit Reached", description: "Starter plan limits Site Personnel to a maximum of 2 projects.", variant: "destructive" });
      return;
    }

    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const { error } = await supabase.from('invite_codes').insert({
      code,
      module: selectedModules[0],
      modules: selectedModules,
      project_ids: selectedModules.includes("Site Personnel") ? selectedProjects : []
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

  const handleSaveCompany = () => {
    setCompany(localCompany);
    toast({
      title: "Company Settings Updated",
      description: "Company information has been saved successfully.",
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
          <h1 className="text-3xl font-heading font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground">Manage your company preferences and global application settings</p>
        </div>

        <Tabs defaultValue="company" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="company" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Company
            </TabsTrigger>
            <TabsTrigger value="team" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team Access
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Notifications
            </TabsTrigger>
            <TabsTrigger value="appearance" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </TabsTrigger>
            <TabsTrigger value="currency" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Currency
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
                <Button onClick={handleSaveCompany} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save Changes
                </Button>
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
                <div className="bg-muted/30 p-4 rounded-lg border space-y-4">
                  <h3 className="font-semibold text-sm">Generate Invite Code</h3>
                  <div className="flex items-end gap-4">
                    <div className="space-y-2 flex-1">
                      <Label>Assign Modules (Multiple allowed)</Label>
                      <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2 bg-background">
                        {Object.keys(planLimits).map(mod => {
                          const disabled = planLimits[mod] === 0;
                          return (
                            <div key={mod} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`mod-${mod}`} 
                                checked={selectedModules.includes(mod)}
                                disabled={disabled}
                                onCheckedChange={(checked) => {
                                  if (checked) setSelectedModules([...selectedModules, mod]);
                                  else setSelectedModules(selectedModules.filter(m => m !== mod));
                                }}
                              />
                              <label htmlFor={`mod-${mod}`} className={cn("text-sm font-medium leading-none cursor-pointer", disabled && "opacity-50")}>
                                {mod} <span className="text-xs text-muted-foreground">({getUsageCount(mod)}/{planLimits[mod]} used)</span>
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    {selectedModules.includes("Site Personnel") && (
                      <div className="space-y-2 flex-1">
                        <Label>Restrict to Projects (Max {currentPlan === 'starter' ? 2 : 'Unlimited'})</Label>
                        <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2 bg-background">
                          {projects.map(p => (
                            <div key={p.id} className="flex items-center space-x-2">
                              <Checkbox 
                                id={`proj-${p.id}`} 
                                checked={selectedProjects.includes(p.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    if (currentPlan === 'starter' && selectedProjects.length >= 2) {
                                      toast({ title: "Limit Reached", description: "Starter plan allows a maximum of 2 projects per user.", variant: "destructive" });
                                      return;
                                    }
                                    setSelectedProjects([...selectedProjects, p.id]);
                                  } else {
                                    setSelectedProjects(selectedProjects.filter(id => id !== p.id));
                                  }
                                }}
                              />
                              <label htmlFor={`proj-${p.id}`} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                                {p.name}
                              </label>
                            </div>
                          ))}
                          {projects.length === 0 && <p className="text-xs text-muted-foreground">No projects found.</p>}
                        </div>
                      </div>
                    )}
                    <Button onClick={handleGenerateCode} className="bg-primary">
                      <Key className="w-4 h-4 mr-2" /> Generate Code
                    </Button>
                  </div>
                  {planLimits[selectedModules[0]] === 0 && (
                    <p className="text-xs text-destructive">Your current plan does not include access to the {selectedModules[0]} module.</p>
                  )}
                </div>

                <div className="space-y-4">
                  <h3 className="font-semibold text-sm">Active Invite Codes</h3>
                  {invites.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active invite codes.</p>
                  ) : (
                    <div className="border rounded-md divide-y">
                      {invites.map(inv => (
                        <div key={inv.id} className="flex items-center justify-between p-3 bg-white">
                          <div>
                            <div className="font-mono font-bold text-lg tracking-widest text-primary">{inv.code}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(inv.modules && inv.modules.length > 0 ? inv.modules : [inv.module]).map((m: string) => (
                                <Badge key={m} variant="secondary" className="text-[10px]">{m}</Badge>
                              ))}
                            </div>
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteCode(inv.id)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-4 pt-4 border-t">
                  <h3 className="font-semibold text-sm">Active Team Members</h3>
                  {teamUsers.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No team members joined yet.</p>
                  ) : (
                    <div className="border rounded-md divide-y">
                      {teamUsers.map(u => (
                        <div key={u.id} className="flex items-center justify-between p-3 bg-white">
                          <div>
                            <div className="font-medium">{u.email || u.full_name || 'User'}</div>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {(u.assigned_modules && u.assigned_modules.length > 0 ? u.assigned_modules : [u.assigned_module]).map((m: string) => (
                                <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>Choose what notifications you want to receive</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">Receive email updates about your account</p>
                    </div>
                    <Switch
                      checked={notifications.emailNotifications}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, emailNotifications: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Project Updates</Label>
                      <p className="text-sm text-muted-foreground">Get notified about project status changes</p>
                    </div>
                    <Switch
                      checked={notifications.projectUpdates}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, projectUpdates: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Inventory Alerts</Label>
                      <p className="text-sm text-muted-foreground">Receive alerts when inventory is low</p>
                    </div>
                    <Switch
                      checked={notifications.inventoryAlerts}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, inventoryAlerts: checked })}
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Financial Reports</Label>
                      <p className="text-sm text-muted-foreground">Get monthly financial reports</p>
                    </div>
                    <Switch
                      checked={notifications.financialReports}
                      onCheckedChange={(checked) => setNotifications({ ...notifications, financialReports: checked })}
                    />
                  </div>
                </div>
                <Button onClick={handleSaveNotifications} className="flex items-center gap-2">
                  <Save className="h-4 w-4" />
                  Save Preferences
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="appearance">
            <Card>
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Customize the visual mode of the application</CardDescription>
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
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="currency">
            <Card>
              <CardHeader>
                <CardTitle>Currency Settings</CardTitle>
                <CardDescription>Set the global currency used across all modules (BOM, Purchasing, Accounting, etc.)</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2 max-w-md">
                  <Label htmlFor="currency">Global Currency format</Label>
                  <Select value={currency} onValueChange={handleSaveCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">United States Dollar (USD $)</SelectItem>
                      <SelectItem value="EUR">Euro (EUR €)</SelectItem>
                      <SelectItem value="GBP">British Pound (GBP £)</SelectItem>
                      <SelectItem value="JPY">Japanese Yen (JPY ¥)</SelectItem>
                      <SelectItem value="PHP">Philippine Peso (PHP ₱)</SelectItem>
                      <SelectItem value="AUD">Australian Dollar (AUD $)</SelectItem>
                      <SelectItem value="CAD">Canadian Dollar (CAD $)</SelectItem>
                      <SelectItem value="SGD">Singapore Dollar (SGD $)</SelectItem>
                      <SelectItem value="AED">UAE Dirham (AED)</SelectItem>
                      <SelectItem value="INR">Indian Rupee (INR ₹)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground mt-2 pt-2 border-t">
                    Updating this setting instantly formats all monetary values across the entire application to the selected currency.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

        </Tabs>
      </div>
    </Layout>
  );
}