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
import { Plus, Pencil, Trash2, FileText, Database, X } from "lucide-react";
import type { Database as SupabaseDatabase } from "@/integrations/supabase/types";

type Project = SupabaseDatabase["public"]["Tables"]["projects"]["Row"];

export default function Projects() {
  const router = useRouter();
  const { formatCurrency } = useSettings();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    location: "",
    client: "",
    start_date: "",
    end_date: "",
    status: "planning" as const,
    budget: ""
  });

  // Master Items State
  const [encodeDialogOpen, setEncodeDialogOpen] = useState(false);
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

  const STANDARD_CATEGORIES = ["Construction Materials", "Tools", "Hand Tools", "Equipments", "PPE"];
  const STANDARD_UNITS = ["pcs", "bags", "kgs", "liters", "units", "set", "lot", "m", "sq.m", "cu.m", "length", "box", "roll"];

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
      start_date: formData.start_date || null,
      end_date: formData.end_date || null,
      status: formData.status,
      budget: parseFloat(formData.budget) || 0,
      spent: editingProject ? editingProject.spent : 0
    };

    if (editingProject) {
      await projectService.update(editingProject.id, projectData);
    } else {
      await projectService.create(projectData);
    }

    setDialogOpen(false);
    resetForm();
    loadProjects();
  };

  const handleMasterItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!masterForm.name || !masterForm.category || !masterForm.unit) {
      alert("Please fill in all required fields: Name, Category, and Unit.");
      return;
    }

    const payload = {
      name: masterForm.name,
      category: masterForm.category,
      unit: masterForm.unit,
      associated_scopes: masterForm.associated_scopes || []
    };

    if (editingMasterItemId) {
      await projectService.updateMasterItem(editingMasterItemId, payload);
    } else {
      await projectService.createMasterItem(payload);
    }
    
    setMasterForm({ name: "", category: "", unit: "", associated_scopes: [] });
    setIsManualMasterCategory(false);
    setIsManualMasterUnit(false);
    setCurrentScopeSelection("");
    setEditingMasterItemId(null);
    loadMasterItems();
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
  };

  const handleDeleteMasterItem = async (id: string) => {
    if (confirm("Delete this master item?")) {
      await projectService.deleteMasterItem(id);
      loadMasterItems();
    }
  };

  const handleMasterScopeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (editingMasterScopeId) {
      await projectService.updateMasterScope(editingMasterScopeId, { name: masterScopeForm.name });
    } else {
      await projectService.createMasterScope({ name: masterScopeForm.name });
    }
    setMasterScopeForm({ name: "" });
    setEditingMasterScopeId(null);
    loadMasterScopes();
  };

  const handleEditMasterScope = (scope: any) => {
    setEditingMasterScopeId(scope.id);
    setMasterScopeForm({ name: scope.name });
  };

  const handleDeleteMasterScope = async (id: string) => {
    if (confirm("Delete this master scope?")) {
      await projectService.deleteMasterScope(id);
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
      start_date: project.start_date || "",
      end_date: project.end_date || "",
      status: project.status as any,
      budget: project.budget ? project.budget.toString() : ""
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this project?")) {
      await projectService.delete(id);
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
      start_date: "",
      end_date: "",
      status: "planning",
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold">Project Profile</h1>
            <p className="text-muted-foreground mt-1">Manage construction projects</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={encodeDialogOpen} onOpenChange={setEncodeDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 hover:text-blue-800">
                  <Database className="h-4 w-4 mr-2" />
                  Encode Master Items
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-6xl h-[85vh] flex flex-col">
                <DialogHeader>
                  <DialogTitle>Master Catalog Engine</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="items" className="flex-1 flex flex-col min-h-0">
                  <TabsList>
                    <TabsTrigger value="items">Materials, Tools & PPE</TabsTrigger>
                    <TabsTrigger value="scopes">Scopes of Work</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="items" className="flex-1 min-h-0 flex flex-col mt-4">
                    <div className="grid grid-cols-3 gap-6 flex-1 min-h-0">
                      <div className="col-span-1 border-r pr-6 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-semibold text-lg">{editingMasterItemId ? "Edit Item" : "Add New Item"}</h3>
                          {editingMasterItemId && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
                              setEditingMasterItemId(null);
                              setMasterForm({ name: "", category: "", unit: "", associated_scopes: [] });
                              setIsManualMasterCategory(false);
                              setIsManualMasterUnit(false);
                            }}>Cancel Edit</Button>
                          )}
                        </div>
                        <form onSubmit={handleMasterItemSubmit} className="space-y-4 flex-1 overflow-y-auto pr-2 pb-4">
                          <div className="space-y-2">
                            <Label>Item Name *</Label>
                            <Input value={masterForm.name} onChange={(e) => setMasterForm({...masterForm, name: e.target.value})} />
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Category *</Label>
                            {!isManualMasterCategory ? (
                              <Select value={masterForm.category} onValueChange={(val) => {
                                if (val === "others") { setIsManualMasterCategory(true); setMasterForm({...masterForm, category: ""}); }
                                else setMasterForm({...masterForm, category: val});
                              }}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                  {STANDARD_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                  <SelectItem value="others" className="text-blue-600 font-semibold">Others (Input)</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex gap-2">
                                <Input value={masterForm.category} onChange={(e) => setMasterForm({...masterForm, category: e.target.value})} />
                                <Button type="button" variant="outline" className="px-2" onClick={() => setIsManualMasterCategory(false)}>List</Button>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Default Unit *</Label>
                            {!isManualMasterUnit ? (
                              <Select value={masterForm.unit} onValueChange={(val) => {
                                if (val === "others") { setIsManualMasterUnit(true); setMasterForm({...masterForm, unit: ""}); }
                                else setMasterForm({...masterForm, unit: val});
                              }}>
                                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent>
                                  {STANDARD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                                  <SelectItem value="others" className="text-blue-600 font-semibold">Others (Input)</SelectItem>
                                </SelectContent>
                              </Select>
                            ) : (
                              <div className="flex gap-2">
                                <Input value={masterForm.unit} onChange={(e) => setMasterForm({...masterForm, unit: e.target.value})} />
                                <Button type="button" variant="outline" className="px-2" onClick={() => setIsManualMasterUnit(false)}>List</Button>
                              </div>
                            )}
                          </div>
                          
                          <div className="space-y-2 pt-2 border-t mt-4">
                            <Label>Link to Scopes of Work</Label>
                            <p className="text-xs text-muted-foreground mb-2">Select which scopes use this item (e.g., Cement for Concrete, Masonry)</p>
                            <div className="flex gap-2">
                              <Select value={currentScopeSelection} onValueChange={setCurrentScopeSelection}>
                                <SelectTrigger><SelectValue placeholder="Select a scope..." /></SelectTrigger>
                                <SelectContent>
                                  {masterScopes.map(s => <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>)}
                                </SelectContent>
                              </Select>
                              <Button type="button" onClick={handleAddScopeToItem} variant="secondary"><Plus className="h-4 w-4" /></Button>
                            </div>
                            {masterForm.associated_scopes.length > 0 && (
                              <div className="flex flex-wrap gap-2 mt-3 p-2 bg-muted/50 rounded-md">
                                {masterForm.associated_scopes.map(scope => (
                                  <Badge key={scope} variant="default" className="flex items-center gap-1 bg-blue-100 text-blue-800 hover:bg-blue-200 border-blue-200">
                                    {scope}
                                    <X className="h-3 w-3 cursor-pointer text-blue-500 hover:text-blue-900" onClick={() => handleRemoveScopeFromItem(scope)} />
                                  </Badge>
                                ))}
                              </div>
                            )}
                          </div>
                          
                          <Button type="submit" className="w-full mt-4">{editingMasterItemId ? "Update Item" : "Save to Catalog"}</Button>
                        </form>
                      </div>
                      <div className="col-span-2 flex flex-col min-h-0">
                        <h3 className="font-semibold mb-4 text-lg flex justify-between">
                          <span>Encoded Materials & Tools</span>
                          <Badge variant="secondary">{filteredMasterItems.length} Total</Badge>
                        </h3>
                        
                        <div className="flex flex-wrap gap-2 mb-4 bg-muted/30 p-2 rounded-md border shrink-0">
                          <Input 
                            placeholder="Search item name..." 
                            className="h-8 w-[160px] bg-white text-xs" 
                            value={masterItemSearch}
                            onChange={(e) => setMasterItemSearch(e.target.value)}
                          />
                          <Select value={masterItemCategoryFilter} onValueChange={setMasterItemCategoryFilter}>
                            <SelectTrigger className="h-8 w-[150px] bg-white text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Categories</SelectItem>
                              {Array.from(new Set(masterItems.map(i => i.category))).filter(Boolean).map(c => <SelectItem key={c as string} value={c as string}>{c as string}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          <Select value={masterItemScopeFilter} onValueChange={setMasterItemScopeFilter}>
                            <SelectTrigger className="h-8 w-[150px] bg-white text-xs"><SelectValue placeholder="Linked Scope" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Scopes</SelectItem>
                              {masterScopes.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {(masterItemSearch || masterItemCategoryFilter !== "all" || masterItemScopeFilter !== "all") && (
                            <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-destructive" onClick={() => {
                              setMasterItemSearch("");
                              setMasterItemCategoryFilter("all");
                              setMasterItemScopeFilter("all");
                            }}>Clear</Button>
                          )}
                        </div>

                        <div className="border rounded-md overflow-y-auto flex-1">
                          <Table>
                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                              <TableRow>
                                <TableHead>Name</TableHead>
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
                                      <div className="flex flex-wrap gap-1">
                                        {(item.associated_scopes || []).map((s: string) => (
                                          <Badge key={s} variant="outline" className="text-[10px] py-0">{s}</Badge>
                                        ))}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditMasterItem(item)}>
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteMasterItem(item.id)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="scopes" className="flex-1 min-h-0 flex flex-col mt-4">
                    <div className="grid grid-cols-3 gap-6 flex-1 min-h-0 items-start">
                      <div className="col-span-1 border-r pr-6 flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                          <h3 className="font-semibold text-lg">{editingMasterScopeId ? "Edit Scope" : "Add Master Scope"}</h3>
                          {editingMasterScopeId && (
                            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => {
                              setEditingMasterScopeId(null);
                              setMasterScopeForm({ name: "" });
                            }}>Cancel Edit</Button>
                          )}
                        </div>
                        <form onSubmit={handleMasterScopeSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Scope Name *</Label>
                            <Input value={masterScopeForm.name} onChange={(e) => setMasterScopeForm({...masterScopeForm, name: e.target.value})} placeholder="e.g. Concrete Works" />
                          </div>
                          <Button type="submit" className="w-full mt-4">{editingMasterScopeId ? "Update Scope" : "Save Scope"}</Button>
                        </form>
                      </div>
                      <div className="col-span-2 flex flex-col min-h-0">
                        <h3 className="font-semibold mb-4 text-lg flex justify-between">
                          <span>Encoded Scopes of Work</span>
                          <Badge variant="secondary">{masterScopes.length} Total</Badge>
                        </h3>
                        <div className="border rounded-md overflow-y-auto max-h-[500px]">
                          <Table>
                            <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
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
                                    <TableCell className="font-medium">{scope.name}</TableCell>
                                    <TableCell className="text-right">
                                      <div className="flex justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleEditMasterScope(scope)}>
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-red-500" onClick={() => handleDeleteMasterScope(scope.id)}>
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                ))
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </DialogContent>
            </Dialog>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  New Project
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingProject ? "Edit Project" : "Create New Project"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Project Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="planning">Planning</SelectItem>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="on_hold">On Hold</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                        </SelectContent>
                      </Select>
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
                    <div className="space-y-2">
                      <Label htmlFor="start_date">Plan Start (Start Date)</Label>
                      <Input
                        id="start_date"
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="end_date">Plan Finish (End Date)</Label>
                      <Input
                        id="end_date"
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
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
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Project Name</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contract Amount</TableHead>
                  <TableHead>Plan Start</TableHead>
                  <TableHead>Plan Finish</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow key={project.id}>
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>{project.location || "-"}</TableCell>
                    <TableCell>{project.client || "-"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[project.status] || "bg-gray-100 text-gray-800"}>
                        {project.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(project.budget || 0)}</TableCell>
                    <TableCell>{project.start_date ? new Date(project.start_date).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>{project.end_date ? new Date(project.end_date).toLocaleDateString() : "-"}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 items-center">
                        <Button 
                          size="sm" 
                          className="bg-green-600 hover:bg-green-700 text-white h-8" 
                          onClick={() => handleBOM(project.id)}
                        >
                          <FileText className="h-3.5 w-3.5 mr-1" /> Add/Edit BOM
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 text-amber-600 border-amber-200 hover:bg-amber-50" onClick={() => handleEdit(project)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="outline" className="h-8 w-8 text-red-600 border-red-200 hover:bg-red-50" onClick={() => handleDelete(project.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}