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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/contexts/ThemeProvider";
import { useSettings } from "@/contexts/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";
import { 
  Building2, 
  Palette, 
  Save,
  Moon,
  Sun,
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

  const [isGM, setIsGM] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<string>("appearance");
  const [activeAddOns, setActiveAddOns] = useState<Record<string, number>>({});
  const [generateDialogType, setGenerateDialogType] = useState<'included' | 'addon' | null>(null);

  useEffect(() => {
    setLocalCompany(company);
  }, [company]);

  useEffect(() => {
    // Run only once on mount to prevent tab bouncing
    const saved = localStorage.getItem('app_assigned_modules');
    if (saved) {
      const mods = JSON.parse(saved);
      const gm = mods.includes('GM');
      setIsGM(gm);
      if (gm) setActiveTab("company");
    }
  }, []);

  const isStarter = currentPlan === 'starter' || currentPlan === 'trial' || isTrial;

  // Base limits based purely on the plan type
  const basePlanLimits: Record<string, number> = isStarter
    ? { 'Site Personnel': 1, 'Accounting': 1, 'Purchasing': 1 }
    : { 'Site Personnel': 3, 'Accounting': 1, 'Purchasing': 1, 'Human Resources': 1, 'Warehouse': 1 };

  // Calculate true limits: Base Plan + Purchased Add-ons
  const planLimits: Record<string, number> = {
    'Site Personnel': basePlanLimits['Site Personnel'] + (activeAddOns['extra_site'] || 0),
    'Accounting': basePlanLimits['Accounting'] + (activeAddOns['extra_acc'] || 0),
    'Purchasing': basePlanLimits['Purchasing'] + (activeAddOns['purchasing'] || 0),
    'Human Resources': basePlanLimits['Human Resources'] || 0,
    'Warehouse': basePlanLimits['Warehouse'] || 0
  };

  const getUsageCount = (mod: string) => {
    const activeInvites = invites.filter(i => (i.modules && i.modules.includes(mod)) || i.module === mod).length;
    const activeUsers = teamUsers.filter(u => (u.assigned_modules && u.assigned_modules.includes(mod)) || u.assigned_module === mod).length;
    return activeInvites + activeUsers;
  };

  const getSpecificUsage = (isAddon: boolean, mods: string[]) => {
    const invCount = invites.filter(i => !!i.is_addon === isAddon && mods.some(m => (i.modules || [i.module]).includes(m))).length;
    const usrCount = teamUsers.filter(u => !!u.is_addon === isAddon && mods.some(m => (u.assigned_modules || [u.assigned_module]).includes(m))).length;
    return invCount + usrCount;
  };

  const handleGenerateSpecificCode = async () => {
    if (selectedModules.length === 0) {
      toast({ title: "Error", description: "Select at least one module.", variant: "destructive" });
      return;
    }

    const isAddon = generateDialogType === 'addon';

    if (selectedModules.includes("Site Personnel") && isStarter && selectedProjects.length > 2) {
      toast({ title: "Limit Reached", description: "Starter plan limits Site Personnel to a maximum of 2 projects.", variant: "destructive" });
      return;
    }

    // Check limits based on type
    if (!isAddon) {
       for (const mod of selectedModules) {
         const limit = basePlanLimits[mod] || 0;
         const usage = getSpecificUsage(false, [mod]);
         if (usage >= limit) {
            toast({ title: "Limit Reached", description: `Included base limit reached for ${mod}.`, variant: "destructive" });
            return;
         }
       }
    } else {
       for (const mod of selectedModules) {
         let addonPurchased = 0;
         if (mod === 'Site Personnel') addonPurchased = activeAddOns['extra_site'] || 0;
         else if (mod === 'Accounting') addonPurchased = activeAddOns['extra_acc'] || 0;
         else if (mod === 'Purchasing') addonPurchased = activeAddOns['purchasing'] || 0;
         else addonPurchased = 0;

         const usage = getSpecificUsage(true, [mod]);
         if (usage >= addonPurchased) {
            toast({ 
              title: "Limit Reached", 
              description: `Add-on limit reached for ${mod}. Please purchase more seats in the Subscription tab.`, 
              variant: "destructive" 
            });
            return;
         }
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
      toast({ title: "Code Generated", description: `Invite code ${code} created.` });
      setGenerateDialogType(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Invite code copied to clipboard." });
  };

  const handleDeleteCode = async (id: string) => {
    await supabase.from('invite_codes').delete().eq('id', id);
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
              <TabsTrigger value="company" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100">
                <Building2 className="h-3 w-3 mr-1.5 hidden sm:inline" /> Company
              </TabsTrigger>
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

                <div className="pt-4 border-t">
                  <Button onClick={handleSaveCompany} className="flex items-center gap-2 w-full sm:w-auto">
                    <Save className="h-4 w-4" />
                    Save Company Settings
                  </Button>
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
      </div>
    </Layout>
  );
}