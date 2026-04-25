import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { useSettings } from "@/contexts/SettingsProvider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2, Archive, FileText, Database, X, CheckCircle2 } from "lucide-react";
import type { Database as SupabaseDatabase } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";

type Project = SupabaseDatabase["public"]["Tables"]["projects"]["Row"];

export default function Projects() {
  const router = useRouter();
  const { formatCurrency, isLocked } = useSettings();
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Main Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isCatalogOpen, setIsCatalogOpen] = useState(false);
  const [newItemDialogOpen, setNewItemDialogOpen] = useState(false);
  
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    client: "",
    budget: ""
  });

  // Master Items State
  const [isItemModalOpen, setIsItemModalOpen] = useState(false);
  const [isScopeModalOpen, setIsScopeModalOpen] = useState(false);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [masterForm, setMasterForm] = useState({ name: "", category: "", unit: "", associated_scopes: [] as string[] });
  const [isManualMasterCategory, setIsManualMasterCategory] = useState(false);
  const [isManualMasterUnit, setIsManualMasterUnit] = useState(false);
  const [currentScopeSelection, setCurrentScopeSelection] = useState("");
  const [editingMasterItemId, setEditingMasterItemId] = useState<string | null>(null);

  // Master Items Filters
  const [masterItemSearch, setMasterItemSearch] = useState("");
  const [masterItemCategoryFilter, setMasterItemCategoryFilter] = useState("all");
  const [masterItemScopeFilter, setMasterItemScopeFilter] = useState("all");

  // Master Scopes State
  const [masterScopes, setMasterScopes] = useState<any[]>([]);
  const [masterScopeForm, setMasterScopeForm] = useState({ name: "" });
  const [editingMasterScopeId, setEditingMasterScopeId] = useState<string | null>(null);

  const STANDARD_CATEGORIES = [
    "Construction Materials",
    "Equipments",
    "Hand Tools",
    "PPE",
    "Tools"
  ];
  
  const STANDARD_UNITS = [
    "Bag",
    "Bd.ft",
    "Box",
    "Cu.m",
    "Gal",
    "Kg",
    "Length",
    "Lin.m",
    "Liter",
    "Lot",
    "M",
    "Pail",
    "Pair",
    "Pc",
    "Roll",
    "Set",
    "Sq.m",
    "Unit"
  ];

  useEffect(() => {
    loadProjects();
    loadMasterItems();
    loadMasterScopes();
  }, []);

  const loadMasterItems = async () => {
    const { data } = await projectService.getMasterItems();
    setMasterItems(data || []);
  };

  const loadMasterScopes = async () => {
    const { data } = await projectService.getMasterScopes();
    setMasterScopes(data || []);
  };

  const loadProjects = async () => {
    const { data } = await projectService.getAll();
    setProjects(data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const projectData = {
      name: formData.name,
      location: formData.location,
      client: formData.client,
      start_date: editingProject?.start_date || null,
      end_date: editingProject?.end_date || null,
      status: editingProject?.status || "planning",
      budget: parseFloat(formData.budget) || 0,
      spent: editingProject ? editingProject.spent : 0
    };

    if (editingProject) {
      await projectService.update(editingProject.id, projectData);
      toast({ title: "Success", description: "Project updated successfully." });
    } else {
      await projectService.create(projectData);
      toast({ title: "Success", description: "Project created successfully." });
    }

    setDialogOpen(false);
    resetForm();
    loadProjects();
  };

  const handleMasterItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!masterForm.name.trim() || !masterForm.category.trim() || !masterForm.unit.trim()) {
      toast({ 
        title: "Missing Fields", 
        description: "Please fill in all required fields: Name, Category, and Unit.", 
        variant: "destructive" 
      });
      return;
    }

    const payload = {
      name: masterForm.name.trim(),
      category: masterForm.category.trim(),
      unit: masterForm.unit.trim(),
      associated_scopes: masterForm.associated_scopes || []
    };

    try {
      if (editingMasterItemId) {
        await projectService.updateMasterItem(editingMasterItemId, payload);
        toast({ title: "Updated", description: "Item successfully updated in catalog." });
      } else {
        await projectService.createMasterItem(payload);
        toast({ title: "Saved", description: "New item added to catalog." });
      }
      
      // Clean Reset
      setMasterForm({ name: "", category: "", unit: "", associated_scopes: [] });
      setIsManualMasterCategory(false);
      setIsManualMasterUnit(false);
      setCurrentScopeSelection("");
      setEditingMasterItemId(null);
      setIsItemModalOpen(false);
      loadMasterItems();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save item.", variant: "destructive" });
    }
  };

  const handleEditMasterItem = (item: any) => {
    setEditingMasterItemId(item.id);
    setMasterForm({
      name: item.name,
      category: item.category,
      unit: item.unit,
      associated_scopes: item.associated_scopes || []
    });
    setIsManualMasterCategory(!STANDARD_CATEGORIES.includes(item.category));
    setIsManualMasterUnit(!STANDARD_UNITS.includes(item.unit));
    setIsItemModalOpen(true);
  };

  const handleDeleteMasterItem = async (id: string) => {
    if (confirm("Are you sure you want to delete this master item?")) {
      await projectService.deleteMasterItem(id);
      toast({ title: "Deleted", description: "Item removed from catalog." });
      loadMasterItems();
    }
  };

  const handleMasterScopeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!masterScopeForm.name.trim()) {
      toast({ title: "Missing Fields", description: "Please enter a Scope Name.", variant: "destructive" });
      return;
    }

    try {
      if (editingMasterScopeId) {
        await projectService.updateMasterScope(editingMasterScopeId, { name: masterScopeForm.name.trim() });
        toast({ title: "Updated", description: "Scope updated successfully." });
      } else {
        await projectService.createMasterScope({ name: masterScopeForm.name.trim() });
        toast({ title: "Saved", description: "New scope added to catalog." });
      }
      setMasterScopeForm({ name: "" });
      setEditingMasterScopeId(null);
      setIsScopeModalOpen(false);
      loadMasterScopes();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to save scope.", variant: "destructive" });
    }
  };

  const handleEditMasterScope = (scope: any) => {
    setEditingMasterScopeId(scope.id);
    setMasterScopeForm({ name: scope.name });
    setIsScopeModalOpen(true);
  };

  const handleDeleteMasterScope = async (id: string) => {
    if (confirm("Are you sure you want to delete this master scope?")) {
      await projectService.deleteMasterScope(id);
      toast({ title: "Deleted", description: "Scope removed from catalog." });
      loadMasterScopes();
    }
  };

  const handleAddScopeToItem = () => {
    if (currentScopeSelection && !(masterForm.associated_scopes || []).includes(currentScopeSelection)) {
      setMasterForm({
        ...masterForm,
        associated_scopes: [...(masterForm.associated_scopes || []), currentScopeSelection]
      });
      setCurrentScopeSelection("");
    }
  };

  const handleRemoveScopeFromItem = (scopeName: string) => {
    setMasterForm({
      ...masterForm,
      associated_scopes: (masterForm.associated_scopes || []).filter(s => s !== scopeName)
    });
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setFormData({
      name: project.name,
      location: project.location || "",
      client: project.client || "",
      budget: project.budget ? project.budget.toString() : ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to archive this project?")) {
      await projectService.delete(id);
      toast({ title: "Archived", description: "Project archived successfully." });
      loadProjects();
    }
  };

  const handleBOM = (projectId: string) => {
    router.push(`/bom/${projectId}`);
  };

  const resetForm = () => {
    setFormData({
      name: "",
      location: "",
      client: "",
      budget: ""
    });
    setEditingProject(null);
  };

  const statusColors: Record<string, string> = {
    planning: "bg-blue-100 text-blue-800",
    active: "bg-green-100 text-green-800",
    on_hold: "bg-yellow-100 text-yellow-800",
    completed: "bg-gray-100 text-gray-800"
  };

  const filteredMasterItems = masterItems.filter(item => {
    const matchSearch = item.name.toLowerCase().includes(masterItemSearch.toLowerCase());
    const matchCategory = masterItemCategoryFilter === "all" || item.category === masterItemCategoryFilter;
    const matchScope = masterItemScopeFilter === "all" || (item.associated_scopes && item.associated_scopes.includes(masterItemScopeFilter));
    return matchSearch && matchCategory && matchScope;
  });

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">Manage construction projects</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={() => setIsCatalogOpen(true)} className="w-full sm:w-auto">
              <Database className="h-4 w-4 mr-2" />
              Master Catalog Engine
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm} disabled={isLocked} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="client">Client Name</Label>
                      <Input
                        id="client"
                        value={formData.client}
                        onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        value={formData.location}
                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="budget">Contract Amount</Label>
                      <Input
                        id="budget"
                        type="number"
                        step="0.01"
                        value={formData.budget}
                        onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                        disabled
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">
                      {editingProject ? "Update" : "Create"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>All Projects</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table className="text-[11px] sm:text-xs">
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[150px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Project Name</TableHead>
                    <TableHead className="min-w-[120px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Location</TableHead>
                    <TableHead className="min-w-[120px] px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Client</TableHead>
                    <TableHead className="min-w-[120px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Contract Amount</TableHead>
                    <TableHead className="min-w-[180px] px-3 py-2 text-right text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projects.map((project) => (
                    <TableRow key={project.id}>
                      <TableCell className="px-3 py-2 font-medium text-[11px] sm:text-xs">{project.name}</TableCell>
                      <TableCell className="px-3 py-2 text-[11px] sm:text-xs">{project.location || "-"}</TableCell>
                      <TableCell className="px-3 py-2 text-[11px] sm:text-xs">{project.client || "-"}</TableCell>
                      <TableCell className="px-3 py-2 text-right font-medium text-[11px] sm:text-xs">{formatCurrency(project.budget || 0)}</TableCell>
                      <TableCell className="px-3 py-2 text-right">
                        <div className="flex flex-col items-stretch justify-end gap-1.5 sm:flex-row sm:items-center">
                          <Button 
                            size="sm" 
                            className="h-7 w-full whitespace-nowrap bg-green-600 px-2 text-[10px] text-white hover:bg-green-700 sm:w-auto" 
                            onClick={() => handleBOM(project.id)}
                          >
                            <FileText className="mr-1 h-3 w-3" /> <span>Add/Edit BOM</span>
                          </Button>
                          <Button size="icon" variant="outline" className="h-7 w-7 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleEdit(project)} disabled={isLocked}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="outline" className="h-7 w-7 text-orange-600 border-orange-200 hover:bg-orange-50" onClick={() => handleDelete(project.id)} title="Archive" disabled={isLocked}>
                            <Archive className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* MASTER CATALOG ENGINE DIALOG */}
      <Dialog open={isCatalogOpen} onOpenChange={setIsCatalogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Database className="h-6 w-6 text-primary" />
              Master Catalog Engine
            </DialogTitle>
          </DialogHeader>

          <Tabs defaultValue="items" className="w-full mt-4">
            <TabsList className="shrink-0 flex flex-wrap w-full gap-1 h-auto bg-transparent p-0 pb-4">
              <TabsTrigger value="items" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-transparent bg-muted/50 text-muted-foreground hover:bg-muted">
                <Database className="h-3 w-3 mr-1.5 hidden sm:inline" /> Materials & Tools
              </TabsTrigger>
              <TabsTrigger value="scopes" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border border-transparent bg-muted/50 text-muted-foreground hover:bg-muted">
                <FileText className="h-3 w-3 mr-1.5 hidden sm:inline" /> Scopes of Work
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-medium">Materials, Tools & Equipments</h3>
                  <p className="text-sm text-muted-foreground">Master catalog for project procurement and warehouse</p>
                </div>
                <Dialog open={newItemDialogOpen} onOpenChange={setNewItemDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => setIsItemModalOpen(true)} disabled={isLocked}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add New Item
                    </Button>
                  </DialogTrigger>
                </Dialog>
              </div>

              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-lg">Encoded Materials & Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item Name</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Linked Scopes</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMasterItems.length === 0 ? (
                        <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No items found.</TableCell></TableRow>
                      ) : (
                        filteredMasterItems.map(item => (
                          <TableRow key={item.id}>
                            <TableCell className="font-medium">{item.name}</TableCell>
                            <TableCell>{item.category}</TableCell>
                            <TableCell>{item.unit}</TableCell>
                            <TableCell>
                              <div className="flex flex-wrap gap-1.5">
                                {(item.associated_scopes || []).map((s: string) => (
                                  <Badge key={s} variant="outline" className="text-[10px] py-0 px-1.5">{s}</Badge>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEditMasterItem(item)} disabled={isLocked}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDeleteMasterItem(item.id)} disabled={isLocked}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scopes" className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={() => setIsScopeModalOpen(true)} disabled={isLocked}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scope
                </Button>
              </div>

              <Card>
                <CardHeader className="py-4">
                  <CardTitle className="text-lg">Encoded Scopes of Work</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scope Name</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {masterScopes.length === 0 ? (
                        <TableRow><TableCell colSpan={2} className="text-center text-muted-foreground py-8">No scopes encoded yet.</TableCell></TableRow>
                      ) : (
                        masterScopes.map(scope => (
                          <TableRow key={scope.id}>
                            <TableCell className="font-medium align-middle">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                {scope.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="icon" onClick={() => handleEditMasterScope(scope)} disabled={isLocked}>
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="text-red-600" onClick={() => handleDeleteMasterScope(scope.id)} disabled={isLocked}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* INDEPENDENT MODALS TO AVOID RADIX UI NESTED DIALOG ISSUES */}
      
      {/* Item Modal */}
      <Dialog open={isItemModalOpen} onOpenChange={(open) => {
        setIsItemModalOpen(open);
        if (!open) {
          setEditingMasterItemId(null);
          setMasterForm({ name: "", category: "", unit: "", associated_scopes: [] });
          setIsManualMasterCategory(false);
          setIsManualMasterUnit(false);
        }
      }}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>{editingMasterItemId ? "Edit Catalog Item" : "Add New Item"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMasterItemSubmit} className="space-y-5 py-4">
            <div className="space-y-1.5">
              <Label className="font-semibold">Item Name <span className="text-red-500">*</span></Label>
              <Input 
                placeholder="e.g. Portland Cement 40kg"
                value={masterForm.name} 
                onChange={(e) => setMasterForm({...masterForm, name: e.target.value})} 
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="font-semibold">Category <span className="text-red-500">*</span></Label>
              {!isManualMasterCategory ? (
                <select
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={masterForm.category || ""}
                  onChange={(e) => {
                    if (e.target.value === "others") {
                      setIsManualMasterCategory(true);
                      setMasterForm({...masterForm, category: ""});
                    } else {
                      setMasterForm({...masterForm, category: e.target.value});
                    }
                  }}
                >
                  <option value="" disabled hidden className="text-muted-foreground">Select Category...</option>
                  {STANDARD_CATEGORIES.map(c => <option key={c} value={c} className="text-foreground bg-background">{c}</option>)}
                  <option value="others" className="text-primary font-semibold bg-primary/10">Others (Type custom...)</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <Input 
                    placeholder="Type custom category..."
                    value={masterForm.category} 
                    onChange={(e) => setMasterForm({...masterForm, category: e.target.value})} 
                  />
                  <Button type="button" variant="outline" className="px-3" onClick={() => {
                    setIsManualMasterCategory(false);
                    setMasterForm({...masterForm, category: ""});
                  }}>Back</Button>
                </div>
              )}
            </div>
            
            <div className="space-y-1.5">
              <Label className="font-semibold">Default Unit <span className="text-red-500">*</span></Label>
              {!isManualMasterUnit ? (
                <select
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={masterForm.unit || ""}
                  onChange={(e) => {
                    if (e.target.value === "others") {
                      setIsManualMasterUnit(true);
                      setMasterForm({...masterForm, unit: ""});
                    } else {
                      setMasterForm({...masterForm, unit: e.target.value});
                    }
                  }}
                >
                  <option value="" disabled hidden className="text-muted-foreground">Select Unit...</option>
                  {STANDARD_UNITS.map(u => <option key={u} value={u} className="text-foreground bg-background">{u}</option>)}
                  <option value="others" className="text-primary font-semibold bg-primary/10">Others (Type custom...)</option>
                </select>
              ) : (
                <div className="flex gap-2">
                  <Input 
                    placeholder="Type custom unit..."
                    value={masterForm.unit} 
                    onChange={(e) => setMasterForm({...masterForm, unit: e.target.value})} 
                  />
                  <Button type="button" variant="outline" className="px-3" onClick={() => {
                    setIsManualMasterUnit(false);
                    setMasterForm({...masterForm, unit: ""});
                  }}>Back</Button>
                </div>
              )}
            </div>
            
            <div className="space-y-2 pt-4 border-t">
              <Label className="font-semibold">Link to Scopes of Work (Optional)</Label>
              <div className="flex gap-2">
                <select 
                  className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background text-foreground px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={currentScopeSelection || ""}
                  onChange={(e) => setCurrentScopeSelection(e.target.value)}
                >
                  <option value="" disabled hidden className="text-muted-foreground">Select a scope...</option>
                  {masterScopes.map(s => <option key={s.id} value={s.name} className="text-foreground bg-background">{s.name}</option>)}
                </select>
                <Button type="button" onClick={handleAddScopeToItem} variant="secondary" className="px-3 shrink-0 bg-primary/10 hover:bg-primary/20 text-primary">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              
              {masterForm.associated_scopes.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3 p-3 bg-muted/50 border rounded-md min-h-[40px]">
                  {masterForm.associated_scopes.map(scope => (
                    <Badge key={scope} variant="secondary" className="flex items-center gap-1 bg-background border shadow-sm px-2 py-1">
                      {scope}
                      <X className="h-3 w-3 ml-1 cursor-pointer text-muted-foreground hover:text-destructive transition-colors" onClick={() => handleRemoveScopeFromItem(scope)} />
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsItemModalOpen(false)}>Cancel</Button>
              <Button type="submit">{editingMasterItemId ? "Update Item" : "Save Item"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Scope Modal */}
      <Dialog open={isScopeModalOpen} onOpenChange={(open) => {
        setIsScopeModalOpen(open);
        if (!open) {
          setEditingMasterScopeId(null);
          setMasterScopeForm({ name: "" });
        }
      }}>
        <DialogContent className="z-[100]">
          <DialogHeader>
            <DialogTitle>{editingMasterScopeId ? "Edit Scope" : "Add Master Scope"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleMasterScopeSubmit} className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="font-semibold">Scope Name <span className="text-red-500">*</span></Label>
              <Input 
                value={masterScopeForm.name} 
                onChange={(e) => setMasterScopeForm({...masterScopeForm, name: e.target.value})} 
                placeholder="e.g. Concrete Works..." 
              />
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={() => setIsScopeModalOpen(false)}>Cancel</Button>
              <Button type="submit">{editingMasterScopeId ? "Update Scope" : "Save Scope"}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}