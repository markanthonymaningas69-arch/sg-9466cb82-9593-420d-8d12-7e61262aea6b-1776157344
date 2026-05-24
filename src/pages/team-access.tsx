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
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/contexts/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";
import { useRouter } from "next/router";
import { 
  DollarSign,
  Users,
  Trash2,
  Edit,
  UserX,
  Plus,
  Copy
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function TeamAccess() {
  const router = useRouter();
  const { toast } = useToast();
  const { currentPlan, isTrial, companyId } = useSettings();

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

  const [activeAddOns, setActiveAddOns] = useState<Record<string, number>>({});
  const [generateDialogType, setGenerateDialogType] = useState<'included' | 'addon' | null>(null);

  useEffect(() => {
    if (companyId) {
      loadTeamData();
      loadProjects();
    }

    // Load purchased add-ons from subscription
    const savedAddOns = localStorage.getItem('app_subscription_features');
    if (savedAddOns) {
      try {
        setActiveAddOns(JSON.parse(savedAddOns));
      } catch(e) {}
    }
  }, [companyId]);

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
      loadTeamData();
      setGenerateDialogType(null);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast({ title: "Copied!", description: "Invite code copied to clipboard." });
  };

  const handleDeleteCode = async (id: string) => {
    await supabase.from('invite_codes').delete().eq('id', id);
    loadTeamData();
  };

  const includedUsage = 
    invites.filter(i => !i.is_addon).reduce((acc, i) => acc + (i.modules?.length || (i.module ? 1 : 0)), 0) + 
    teamUsers.filter(u => !u.is_addon).reduce((acc, u) => acc + (u.assigned_modules?.length || (u.assigned_module ? 1 : 0)), 0);
  const includedLimit = isStarter ? 3 : 7; 
  
  const addonUsage = 
    invites.filter(i => i.is_addon).reduce((acc, i) => acc + (i.modules?.length || (i.module ? 1 : 0)), 0) + 
    teamUsers.filter(u => u.is_addon).reduce((acc, u) => acc + (u.assigned_modules?.length || (u.assigned_module ? 1 : 0)), 0);
  const addonLimit = Object.values(activeAddOns).reduce((a, b) => Number(a) + Number(b), 0);

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Team Access</h1>
          <p className="text-muted-foreground">
            Manage your team's module access and user permissions
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Team Access & Modules</CardTitle>
            <CardDescription>
              Manage your team's access. Included seats auto-renew with your plan. Add-on seats are managed separately.
              <strong className="text-primary mt-2 block font-medium bg-primary/5 p-2 rounded border border-primary/10">
                {isStarter 
                  ? "Starter Inclusions: 3 Total Independent Seats (1 Site Personnel, 1 Accounting, 1 Purchasing)" 
                  : "Professional Inclusions: 7 Total Independent Seats (3 Site Personnel, 1 Accounting, 1 Purchasing, 1 HR, 1 Warehouse)"}
              </strong>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6 pt-2">
              
              {/* INCLUDED COLUMN */}
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center shrink-0">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Included Users</h3>
                      <p className="text-xs text-muted-foreground">{includedUsage} of {includedLimit} base seats used</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={() => {
                    setSelectedModules([]);
                    setSelectedProjects([]);
                    setGenerateDialogType('included');
                  }}>
                    <Plus className="h-4 w-4 mr-1" /> Code
                  </Button>
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
                            <div className="flex items-center gap-2">
                              <div className="font-mono font-bold text-sm tracking-widest text-primary">{inv.code}</div>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-primary" onClick={() => handleCopyCode(inv.code)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
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
                          <div className="flex flex-col gap-1 items-end justify-center h-full">
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
                <div className="flex items-center justify-between mb-4 border-b pb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded bg-emerald-100 flex items-center justify-center shrink-0">
                      <DollarSign className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">Add-on Users</h3>
                      <p className="text-xs text-muted-foreground">{addonUsage} of {addonLimit} extra seats used</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="border-emerald-500 text-emerald-600 hover:bg-emerald-50" onClick={() => {
                    setSelectedModules([]);
                    setSelectedProjects([]);
                    setGenerateDialogType('addon');
                  }}>
                    <Plus className="h-4 w-4 mr-1" /> Code
                  </Button>
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
                            <div className="flex items-center gap-2">
                              <div className="font-mono font-bold text-sm tracking-widest text-emerald-600">{inv.code}</div>
                              <Button size="icon" variant="ghost" className="h-6 w-6 text-muted-foreground hover:text-emerald-600" onClick={() => handleCopyCode(inv.code)}>
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
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
                              {!isStarter && (
                                <Button size="icon" variant="ghost" onClick={() => {
                                  setEditingUser(u);
                                  setEditModules(u.assigned_modules && u.assigned_modules.length > 0 ? u.assigned_modules : [u.assigned_module]);
                                  setEditProjects(u.assigned_project_ids || []);
                                  setEditExpiryDate(u.subscription_end_date || "");
                                }} className="h-6 w-6">
                                  <Edit className="w-3 h-3 text-muted-foreground" />
                                </Button>
                              )}
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

        {/* Generate Code Dialog */}
        <Dialog open={!!generateDialogType} onOpenChange={(open) => !open && setGenerateDialogType(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Generate {generateDialogType === 'addon' ? 'Add-on' : 'Included'} Invite Code</DialogTitle>
              <DialogDescription>
                {generateDialogType === 'addon' 
                  ? "Select modules for an extra purchased add-on seat." 
                  : "Select modules using your base plan limits."}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Select Module(s) to Assign</Label>
                <div className="flex flex-wrap gap-2">
                  {(generateDialogType === 'addon' 
                    ? (isStarter ? ['Site Personnel'] : ['Site Personnel', 'Accounting', 'Purchasing'])
                    : (isStarter ? ['Site Personnel', 'Accounting', 'Purchasing'] : ['Site Personnel', 'Accounting', 'Purchasing', 'Warehouse', 'Human Resources'])
                  ).map(mod => (
                    <div key={mod} className="flex items-center space-x-2 border rounded-md p-2 bg-muted/20">
                      <Checkbox 
                        id={`gen-mod-${mod}`}
                        checked={selectedModules.includes(mod)}
                        onCheckedChange={(checked) => {
                          if (checked) setSelectedModules([...selectedModules, mod]);
                          else setSelectedModules(selectedModules.filter(m => m !== mod));
                        }}
                      />
                      <Label htmlFor={`gen-mod-${mod}`} className="cursor-pointer text-sm font-medium">{mod}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {selectedModules.includes("Site Personnel") && (
                <div className="space-y-2">
                  <Label>Restrict to Projects (Max {currentPlan === 'starter' || currentPlan === 'trial' || isTrial ? 2 : 'Unlimited'})</Label>
                  <div className="border rounded-md p-2 max-h-32 overflow-y-auto space-y-2 bg-background">
                    {projects.map(p => (
                      <div key={p.id} className="flex items-center space-x-2">
                        <Checkbox 
                          id={`proj-${p.id}`}
                          checked={selectedProjects.includes(p.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              if ((currentPlan === 'starter' || currentPlan === 'trial' || isTrial) && selectedProjects.length >= 2) {
                                toast({ title: "Limit Reached", description: "Starter/Trial plan allows a maximum of 2 projects per user.", variant: "destructive" });
                                return;
                              }
                              setSelectedProjects([...selectedProjects, p.id]);
                            } else {
                              setSelectedProjects(selectedProjects.filter(id => id !== p.id));
                            }
                          }}
                        />
                        <Label htmlFor={`proj-${p.id}`} className="text-sm font-medium cursor-pointer">
                          {p.name}
                        </Label>
                      </div>
                    ))}
                    {projects.length === 0 && <p className="text-xs text-muted-foreground">No projects found.</p>}
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setGenerateDialogType(null)}>Cancel</Button>
              <Button onClick={handleGenerateSpecificCode}>Generate Code</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                    const disabled = planLimits[mod] === 0;
                    
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