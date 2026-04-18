import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { warehouseService } from "@/services/warehouseService";
import { projectService } from "@/services/projectService";
import { useSettings } from "@/contexts/SettingsProvider";
import { Plus, Pencil, Trash2, Archive, Package, Building2, Warehouse as WarehouseIcon, FileSpreadsheet, Truck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type WarehouseItem = Database["public"]["Tables"]["inventory"]["Row"] & {
  projects?: { name: string } | null;
};

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

export default function Warehouse() {
  const { formatCurrency } = useSettings();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [consumptions, setConsumptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs and Filters
  const [activeTab, setActiveTab] = useState("main");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  
  // Form State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [deploymentDialogOpen, setDeploymentDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [deployingItem, setDeployingItem] = useState<WarehouseItem | null>(null);
  const [editingDeployment, setEditingDeployment] = useState<any>(null);
  const [deployForm, setDeployForm] = useState({ project_id: "", quantity: 1 });
  const [deploymentForm, setDeploymentForm] = useState({ quantity: 0 });
  const [isManualName, setIsManualName] = useState(false);
  const [isManualCategory, setIsManualCategory] = useState(false);
  const [isManualUnit, setIsManualUnit] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    quantity: "",
    unit: "",
    unit_cost: "",
    reorder_level: "",
    last_restocked: new Date().toISOString().split("T")[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: itemsData }, { data: projectsData }, { data: masterData }, { data: deliveriesData }, { data: consumptionsData }] = await Promise.all([
      warehouseService.getAll(),
      projectService.getAll(),
      projectService.getMasterItems(),
      supabase.from('deliveries').select('*, projects(name)'),
      (supabase as any).from('site_material_consumption').select('*, projects(name)')
    ]);
    setItems(itemsData as WarehouseItem[] || []);
    setProjects(projectsData || []);
    setMasterItems(masterData || []);
    setDeliveries(deliveriesData || []);
    setConsumptions(consumptionsData || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const itemData = {
      name: formData.name,
      category: formData.category,
      quantity: parseInt(formData.quantity) || 0,
      unit: formData.unit,
      unit_cost: parseFloat(formData.unit_cost) || 0,
      reorder_level: parseInt(formData.reorder_level) || 0,
      last_restocked: formData.last_restocked,
      project_id: null // Always add to main warehouse first
    };

    if (editingItem) {
      await warehouseService.update(editingItem.id, itemData);
    } else {
      await warehouseService.create(itemData as any);
    }

    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleEdit = (item: WarehouseItem) => {
    setEditingItem(item);
    
    // Convert legacy database categories to standard labels
    let cat = item.category || "";
    if (cat === "materials") cat = "Construction Materials";
    if (cat === "tools") cat = "Tools";
    if (cat === "equipment") cat = "Equipments";
    if (cat === "safety") cat = "PPE";

    setFormData({
      name: item.name,
      category: cat,
      quantity: item.quantity.toString(),
      unit: item.unit,
      unit_cost: item.unit_cost.toString(),
      reorder_level: item.reorder_level?.toString() || "0",
      last_restocked: item.last_restocked || new Date().toISOString().split("T")[0]
    });
    
    setIsManualCategory(cat ? !STANDARD_CATEGORIES.includes(cat) : false);
    setIsManualUnit(item.unit ? !STANDARD_UNITS.includes(item.unit) : false);
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to archive this item?")) {
      await warehouseService.delete(id);
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      category: "",
      quantity: "",
      unit: "",
      unit_cost: "",
      reorder_level: "",
      last_restocked: new Date().toISOString().split("T")[0]
    });
    setEditingItem(null);
    setIsManualName(false);
    setIsManualCategory(false);
    setIsManualUnit(false);
  };

  const getCategoryLabel = (val: string) => {
    const legacyMap: Record<string, string> = { materials: "Construction Materials", tools: "Tools", equipment: "Equipments", safety: "PPE" };
    return legacyMap[val] || val;
  };

  // Generate dynamic unique categories from the actual items in the database
  const uniqueCategories = Array.from(new Set(items.map(i => getCategoryLabel(i.category || "Uncategorized"))));

  // Splitting and Filtering Logic
  const mainWarehouseItems = items.filter(item => !item.project_id);
  const projectWarehouseItems = items.filter(item => item.project_id);

  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deployingItem || !deployForm.project_id) return;
    
    await warehouseService.deployItem(deployingItem.id, deployForm.project_id, deployForm.quantity);
    
    setDeployDialogOpen(false);
    setDeployingItem(null);
    setDeployForm({ project_id: "", quantity: 1 });
    loadData();
  };

  const handleDeploymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDeployment) return;
    await warehouseService.updateDeployment(editingDeployment.id, deploymentForm.quantity);
    setDeploymentDialogOpen(false);
    setEditingDeployment(null);
    loadData();
  };

  const filteredMain = mainWarehouseItems.filter(item => {
    const matchCategory = categoryFilter === "all" || getCategoryLabel(item.category || "Uncategorized") === categoryFilter;
    const matchDate = !dateFilter || item.last_restocked === dateFilter;
    return matchCategory && matchDate;
  });

  const filteredProject = projectWarehouseItems.filter(item => {
    const matchCategory = categoryFilter === "all" || getCategoryLabel(item.category || "Uncategorized") === categoryFilter;
    const matchProject = projectFilter === "all" || item.project_id === projectFilter;
    const matchDate = !dateFilter || item.last_restocked === dateFilter || item.created_at?.startsWith(dateFilter);
    return matchCategory && matchProject && matchDate;
  });

  // Calculate Balance Checking summaries
  const balanceSummary = Object.values(items.reduce((acc, item) => {
    const key = `${item.name}-${item.unit}`;
    if (!acc[key]) {
      acc[key] = {
        name: item.name,
        category: getCategoryLabel(item.category || "Uncategorized"),
        unit: item.unit,
        mainQty: 0,
        deployedQty: 0,
      };
    }
    if (item.project_id) {
      acc[key].deployedQty += item.quantity;
    } else {
      acc[key].mainQty += item.quantity;
    }
    return acc;
  }, {} as Record<string, any>));

  const filteredBalance = balanceSummary.filter(item => {
    return categoryFilter === "all" || item.category === categoryFilter;
  });

  const totalValue = items.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

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
      <div className="space-y-6 flex flex-col h-full">
        <div className="flex justify-between items-center shrink-0">
          <div>
            <h1 className="text-3xl font-heading font-bold">Inventory Management</h1>
            <p className="text-muted-foreground mt-1">Track materials, tools, equipment, and PPE</p>
          </div>
          {activeTab === "main" && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={resetForm}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Edit Item" : "Add New Item"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Item Name *</Label>
                      {!isManualName ? (
                        <Select value={formData.name} onValueChange={(val) => {
                          if (val === "others") {
                            setIsManualName(true);
                            setFormData({ ...formData, name: "" });
                          } else {
                            const item = masterItems.find(m => m.name === val);
                            if (item) {
                              setFormData({
                                ...formData,
                                name: val,
                                category: item.category,
                                unit: item.unit,
                                unit_cost: item.default_cost.toString()
                              });
                              setIsManualCategory(item.category ? !STANDARD_CATEGORIES.includes(item.category) : false);
                              setIsManualUnit(item.unit ? !STANDARD_UNITS.includes(item.unit) : false);
                            } else {
                              setFormData({ ...formData, name: val });
                            }
                          }
                        }} required>
                          <SelectTrigger><SelectValue placeholder="Select from catalog" /></SelectTrigger>
                          <SelectContent>
                            {masterItems.map(m => <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>)}
                            <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-2">
                          <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Custom item name" required />
                          <Button type="button" variant="outline" className="px-2" onClick={() => { setIsManualName(false); setFormData({ ...formData, name: "" }); }}>List</Button>
                        </div>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label>Category *</Label>
                      {!isManualCategory ? (
                        <Select value={formData.category} onValueChange={(val) => {
                          if (val === "others") {
                            setIsManualCategory(true);
                            setFormData({ ...formData, category: "" });
                          } else {
                            setFormData({ ...formData, category: val });
                          }
                        }} required>
                          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                          <SelectContent>
                            {STANDARD_CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                            <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-2">
                          <Input
                            value={formData.category}
                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                            placeholder="Custom category"
                            required
                          />
                          <Button type="button" variant="outline" className="px-2" onClick={() => {
                            setIsManualCategory(false);
                            setFormData({ ...formData, category: "" });
                          }}>List</Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity *</Label>
                      <Input id="quantity" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="unit">Unit *</Label>
                      {!isManualUnit ? (
                        <Select value={formData.unit} onValueChange={(val) => {
                          if (val === "Other") {
                            setIsManualUnit(true);
                            setFormData({ ...formData, unit: "" });
                          } else {
                            setFormData({ ...formData, unit: val });
                          }
                        }} required>
                          <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                          <SelectContent>
                            {STANDARD_UNITS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                            <SelectItem value="Other" className="font-semibold text-blue-600">Other (Manual Input)</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex gap-2">
                          <Input id="unit" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="Custom unit" required />
                          <Button type="button" variant="outline" className="px-2" onClick={() => {
                            setIsManualUnit(false);
                            setFormData({ ...formData, unit: "" });
                          }}>List</Button>
                        </div>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="unit_cost">Unit Cost *</Label>
                      <Input id="unit_cost" type="number" step="0.01" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reorder_level">Low Stock Alert Level *</Label>
                      <Input id="reorder_level" type="number" value={formData.reorder_level} onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="last_restocked">Re-stock Date *</Label>
                      <Input id="last_restocked" type="date" value={formData.last_restocked} onChange={(e) => setFormData({ ...formData, last_restocked: e.target.value })} required />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">{editingItem ? "Update" : "Add Item"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          )}

          <Dialog open={deployDialogOpen} onOpenChange={setDeployDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Deploy Item to Project</DialogTitle>
              </DialogHeader>
              {deployingItem && (
                <form onSubmit={handleDeploySubmit} className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="font-semibold text-lg">{deployingItem.name}</div>
                    <div className="text-sm text-muted-foreground">Available in Main Warehouse: {deployingItem.quantity} {deployingItem.unit}</div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Target Project *</Label>
                    <Select 
                      value={deployForm.project_id} 
                      onValueChange={(val) => setDeployForm({ ...deployForm, project_id: val })} 
                      required
                    >
                      <SelectTrigger><SelectValue placeholder="Select active project" /></SelectTrigger>
                      <SelectContent>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Quantity to Deploy ({deployingItem.unit}) *</Label>
                    <Input 
                      type="number" 
                      min="1" 
                      max={deployingItem.quantity} 
                      value={deployForm.quantity} 
                      onChange={(e) => setDeployForm({ ...deployForm, quantity: parseInt(e.target.value) || 1 })} 
                      required 
                    />
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDeployDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Confirm Deployment</Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>

          <Dialog open={deploymentDialogOpen} onOpenChange={setDeploymentDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Deployment Quantity</DialogTitle>
              </DialogHeader>
              {editingDeployment && (
                <form onSubmit={handleDeploymentSubmit} className="space-y-4">
                  <div className="bg-muted p-4 rounded-lg">
                    <div className="font-semibold text-lg">{editingDeployment.item_name}</div>
                    <div className="text-sm text-muted-foreground">Deployed to: {editingDeployment.projects?.name}</div>
                    <div className="text-sm text-muted-foreground mt-1">Status: <Badge variant="outline" className="ml-1">{editingDeployment.status?.toUpperCase()}</Badge></div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Deployed Quantity ({editingDeployment.unit}) *</Label>
                    <Input 
                      type="number" 
                      step="0.01"
                      min="0.01" 
                      value={deploymentForm.quantity} 
                      onChange={(e) => setDeploymentForm({ quantity: parseFloat(e.target.value) || 0 })} 
                      required 
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Changing this will automatically update the Site Deliveries list and adjust the Main Warehouse balance accordingly.
                    </p>
                  </div>
                  
                  <div className="flex justify-end gap-2 pt-4">
                    <Button type="button" variant="outline" onClick={() => setDeploymentDialogOpen(false)}>Cancel</Button>
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              )}
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-1 max-w-sm shrink-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Asset Value</CardTitle>
              <Package className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{formatCurrency(totalValue)}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setCategoryFilter("all"); setProjectFilter("all"); setDateFilter(""); }} className="flex-1 flex flex-col min-h-0">
          <TabsList className="shrink-0 flex flex-wrap w-full gap-1 h-auto bg-transparent p-0">
            <TabsTrigger value="main" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100">
              <WarehouseIcon className="h-3 w-3 mr-1.5 hidden sm:inline" /> Main
            </TabsTrigger>
            <TabsTrigger value="balance" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-indigo-700 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
              <FileSpreadsheet className="h-3 w-3 mr-1.5 hidden sm:inline" /> Balance
            </TabsTrigger>
            <TabsTrigger value="deployments" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-emerald-700 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
              <Truck className="h-3 w-3 mr-1.5 hidden sm:inline" /> Deploy
            </TabsTrigger>
            <TabsTrigger value="project" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-amber-700 bg-amber-50 text-amber-700 hover:bg-amber-100">
              <Building2 className="h-3 w-3 mr-1.5 hidden sm:inline" /> Project
            </TabsTrigger>
          </TabsList>

          <div className="bg-muted/30 p-3 mt-4 border rounded-lg flex flex-wrap items-end gap-4 shrink-0">
            <div className="space-y-1">
              <Label className="text-xs">Filter by Category:</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-background">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            {activeTab === "project" && (
              <div className="space-y-1">
                <Label className="text-xs">Filter by Project:</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-background">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {activeTab === "deployments" && (
              <div className="space-y-1">
                <Label className="text-xs">Filter by Project:</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-[200px] h-9 bg-white dark:bg-background">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {activeTab !== "balance" && (
              <div className="space-y-1">
                <Label className="text-xs">Filter by Date:</Label>
                <Input 
                  type="date" 
                  className="w-[200px] h-9 bg-white dark:bg-background" 
                  value={dateFilter} 
                  onChange={(e) => setDateFilter(e.target.value)} 
                />
              </div>
            )}
            
            {(categoryFilter !== "all" || projectFilter !== "all" || dateFilter) && (
              <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter("all"); setProjectFilter("all"); setDateFilter(""); }} className="text-muted-foreground h-9 ml-1">
                Clear Filters
              </Button>
            )}
          </div>

          <TabsContent value="main" className="flex-1 mt-4 data-[state=active]:flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none">
              <div className="overflow-y-auto rounded-md border h-full relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Restock Value</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMain.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                          No items found in the Main Warehouse.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMain.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-muted-foreground whitespace-nowrap">{item.last_restocked || "-"}</TableCell>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getCategoryLabel(item.category || "-")}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-semibold">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-right text-muted-foreground">{item.reorder_level || 0} {item.unit}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.unit_cost)}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            {formatCurrency(item.quantity * item.unit_cost)}
                          </TableCell>
                          <TableCell>
                            {item.quantity <= (item.reorder_level || 0) ? (
                              <Badge className="bg-warning/20 text-warning border-warning/50">Low Stock</Badge>
                            ) : (
                              <Badge className="bg-success/20 text-success border-success/50">In Stock</Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="default" className="bg-blue-600 hover:bg-blue-700" onClick={() => {
                                setDeployingItem(item);
                                setDeployForm({ project_id: "", quantity: 1 });
                                setDeployDialogOpen(true);
                              }}>
                                Deploy
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)} title="Archive">
                                <Archive className="h-4 w-4 text-orange-600" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="project" className="flex-1 mt-4 data-[state=active]:flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none">
              <div className="overflow-y-auto rounded-md border h-full relative bg-white">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-100 z-10 border-b">
                    <TableRow>
                      <TableHead className="font-bold text-black">Item Name</TableHead>
                      <TableHead className="font-bold text-black">Category</TableHead>
                      <TableHead className="font-bold text-black">Project</TableHead>
                      <TableHead className="text-right font-bold text-blue-700 bg-blue-50 border-l">Total Received</TableHead>
                      <TableHead className="text-right font-bold text-orange-700 bg-orange-50">Total Consumed</TableHead>
                      <TableHead className="text-right font-bold text-green-700 bg-green-50 border-r">Current Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const projInvMap: Record<string, any> = {};
                      
                      deliveries.filter(d => d.status === "received").forEach(d => {
                        if (projectFilter !== "all" && d.project_id !== projectFilter) return;
                        if (dateFilter && d.delivery_date !== dateFilter) return;
                        
                        const key = `${d.project_id}-${d.item_name}-${d.unit}`;
                        if (!projInvMap[key]) {
                          const mItem = masterItems.find(m => m.name.toLowerCase() === d.item_name.toLowerCase());
                          projInvMap[key] = {
                            project_id: d.project_id,
                            project_name: d.projects?.name || "Unknown",
                            name: d.item_name,
                            category: mItem ? mItem.category : "Uncategorized",
                            unit: d.unit,
                            received: 0,
                            consumed: 0,
                            balance: 0
                          };
                        }
                        projInvMap[key].received += d.quantity;
                        projInvMap[key].balance += d.quantity;
                      });

                      consumptions.forEach(c => {
                        if (projectFilter !== "all" && c.project_id !== projectFilter) return;
                        if (dateFilter && c.date_used !== dateFilter) return;

                        const key = `${c.project_id}-${c.item_name}-${c.unit}`;
                        if (!projInvMap[key]) {
                          const mItem = masterItems.find(m => m.name.toLowerCase() === c.item_name.toLowerCase());
                          projInvMap[key] = {
                            project_id: c.project_id,
                            project_name: c.projects?.name || "Unknown",
                            name: c.item_name,
                            category: mItem ? mItem.category : "Uncategorized",
                            unit: c.unit,
                            received: 0,
                            consumed: 0,
                            balance: 0
                          };
                        }
                        projInvMap[key].consumed += c.quantity;
                        projInvMap[key].balance -= c.quantity;
                      });

                      const siteInventory = Object.values(projInvMap).filter((item: any) => {
                         const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
                         return matchCategory;
                      }).sort((a: any, b: any) => a.project_name.localeCompare(b.project_name) || a.name.localeCompare(b.name));

                      if (siteInventory.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No project inventory found matching the filters.
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return siteInventory.map((item: any, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/50">
                          <TableCell className="font-medium text-black">{item.name}</TableCell>
                          <TableCell><Badge variant="outline" className="text-xs">{item.category}</Badge></TableCell>
                          <TableCell><Badge variant="secondary" className="font-semibold text-blue-700 bg-blue-50 border-blue-200">{item.project_name}</Badge></TableCell>
                          <TableCell className="text-right font-semibold text-blue-700 bg-blue-50/30 border-l">{item.received} <span className="text-xs text-blue-400 font-normal">{item.unit}</span></TableCell>
                          <TableCell className="text-right font-semibold text-orange-700 bg-orange-50/30">{item.consumed} <span className="text-xs text-orange-400 font-normal">{item.unit}</span></TableCell>
                          <TableCell className={`text-right font-bold text-lg border-r ${item.balance < 0 ? 'text-red-600 bg-red-50/30' : 'text-green-700 bg-green-50/30'}`}>{item.balance} <span className={`text-xs font-normal ${item.balance < 0 ? 'text-red-400' : 'text-green-500'}`}>{item.unit}</span></TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="deployments" className="flex-1 mt-4 data-[state=active]:flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none">
              <div className="overflow-y-auto rounded-md border h-full relative bg-white">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-100 z-10 border-b">
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Item</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(() => {
                      const deployedList = deliveries.filter(d => d.supplier === "Main Warehouse");
                      const filteredDeployed = deployedList.filter(d => {
                        const matchProject = projectFilter === "all" || d.project_id === projectFilter;
                        const matchDate = !dateFilter || d.delivery_date === dateFilter;
                        const mItem = masterItems.find(m => m.name.toLowerCase() === d.item_name.toLowerCase());
                        const cat = mItem ? mItem.category : "Uncategorized";
                        const matchCategory = categoryFilter === "all" || cat === categoryFilter;
                        return matchProject && matchDate && matchCategory;
                      }).sort((a,b) => new Date(b.delivery_date).getTime() - new Date(a.delivery_date).getTime());

                      if (filteredDeployed.length === 0) {
                        return (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                              No deployments found matching the filter.
                            </TableCell>
                          </TableRow>
                        );
                      }

                      return filteredDeployed.map(d => (
                        <TableRow key={d.id}>
                          <TableCell>{d.delivery_date}</TableCell>
                          <TableCell><Badge variant="secondary">{d.projects?.name || "Unknown"}</Badge></TableCell>
                          <TableCell className="font-medium">{d.item_name}</TableCell>
                          <TableCell className="text-right font-semibold">{d.quantity} <span className="text-xs text-muted-foreground font-normal">{d.unit}</span></TableCell>
                          <TableCell>
                            <Badge variant="outline" className={d.status === 'received' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}>
                              {d.status?.toUpperCase()}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button size="sm" variant="ghost" onClick={() => {
                              setEditingDeployment(d);
                              setDeploymentForm({ quantity: d.quantity });
                              setDeploymentDialogOpen(true);
                            }}>
                              <Pencil className="h-4 w-4 text-blue-600" /> Edit Qty
                            </Button>
                          </TableCell>
                        </TableRow>
                      ));
                    })()}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="balance" className="flex-1 mt-4 data-[state=active]:flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none">
              <div className="overflow-y-auto rounded-md border h-full relative bg-white">
                <Table>
                  <TableHeader className="sticky top-0 bg-gray-100 z-10 border-b">
                    <TableRow>
                      <TableHead className="font-bold text-black">Item Name</TableHead>
                      <TableHead className="font-bold text-black">Category</TableHead>
                      <TableHead className="text-right font-bold text-black border-l bg-gray-50">Total Items (Restocked)</TableHead>
                      <TableHead className="text-right font-bold text-blue-700 bg-blue-50">Total Deployed</TableHead>
                      <TableHead className="text-right font-bold text-green-700 bg-green-50 border-r">Main Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBalance.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                          No items found matching the filter.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredBalance.map((item, idx) => {
                        const totalRestocked = item.mainQty + item.deployedQty;
                        return (
                          <TableRow key={idx} className="hover:bg-muted/50">
                            <TableCell className="font-medium text-black">{item.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">{item.category}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-lg border-l bg-gray-50/50">
                              {totalRestocked} <span className="text-xs text-muted-foreground font-normal">{item.unit}</span>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-blue-700 bg-blue-50/30">
                              {item.deployedQty} <span className="text-xs text-blue-400 font-normal">{item.unit}</span>
                            </TableCell>
                            <TableCell className="text-right font-semibold text-green-700 bg-green-50/30 border-r">
                              {item.mainQty} <span className="text-xs text-green-400 font-normal">{item.unit}</span>
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}