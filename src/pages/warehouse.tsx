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
import { Plus, Pencil, Trash2, Package, AlertTriangle, Building2, Warehouse as WarehouseIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

// Extend the base row type to include our joined project name
type WarehouseItem = Database["public"]["Tables"]["inventory"]["Row"] & {
  projects?: { name: string } | null;
};

const CATEGORIES = [
  { value: "materials", label: "Construction Materials" },
  { value: "tools", label: "Tools" },
  { value: "equipment", label: "Equipments" },
  { value: "safety", label: "PPE" }
];

export default function Warehouse() {
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs and Filters
  const [activeTab, setActiveTab] = useState("main");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");
  
  // Form State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    category: "",
    quantity: "",
    unit: "",
    unit_cost: "",
    reorder_level: "",
    location: "",
    project_id: "main" // "main" = null in db
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [{ data: itemsData }, { data: projectsData }] = await Promise.all([
      warehouseService.getAll(),
      projectService.getAll()
    ]);
    setItems(itemsData as WarehouseItem[] || []);
    setProjects(projectsData || []);
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
      location: formData.location || null,
      project_id: formData.project_id === "main" ? null : formData.project_id
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
    setFormData({
      name: item.name,
      category: item.category || "",
      quantity: item.quantity.toString(),
      unit: item.unit,
      unit_cost: item.unit_cost.toString(),
      reorder_level: item.reorder_level?.toString() || "0",
      location: item.location || "",
      project_id: item.project_id || "main"
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this item?")) {
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
      location: "",
      project_id: "main"
    });
    setEditingItem(null);
  };

  const getCategoryLabel = (val: string) => {
    return CATEGORIES.find(c => c.value === val)?.label || val;
  };

  // Splitting and Filtering Logic
  const mainWarehouseItems = items.filter(item => !item.project_id);
  const projectWarehouseItems = items.filter(item => item.project_id);

  const filteredMain = mainWarehouseItems.filter(item => categoryFilter === "all" || item.category === categoryFilter);
  const filteredProject = projectWarehouseItems.filter(item => {
    const matchCategory = categoryFilter === "all" || item.category === categoryFilter;
    const matchProject = projectFilter === "all" || item.project_id === projectFilter;
    return matchCategory && matchProject;
  });

  const lowStockItems = items.filter(item => item.quantity <= (item.reorder_level || 0));
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
                    <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Category *</Label>
                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })} required>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="quantity">Quantity *</Label>
                    <Input id="quantity" type="number" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="unit">Unit *</Label>
                    <Input id="unit" value={formData.unit} onChange={(e) => setFormData({ ...formData, unit: e.target.value })} placeholder="e.g., bags, pcs, units" required />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="unit_cost">Unit Cost (₱) *</Label>
                    <Input id="unit_cost" type="number" step="0.01" value={formData.unit_cost} onChange={(e) => setFormData({ ...formData, unit_cost: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reorder_level">Low Stock Alert Level *</Label>
                    <Input id="reorder_level" type="number" value={formData.reorder_level} onChange={(e) => setFormData({ ...formData, reorder_level: e.target.value })} required />
                  </div>
                  
                  <div className="space-y-2 col-span-2 p-4 bg-muted/30 border rounded-lg">
                    <Label className="text-base font-semibold mb-2 block">Storage & Deployment</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Location / Assignment</Label>
                        <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                          <SelectTrigger><SelectValue placeholder="Where is this item?" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="main" className="font-semibold text-primary">Main Warehouse</SelectItem>
                            {projects.map(p => <SelectItem key={p.id} value={p.id}>Deployed to: {p.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="location">Specific Shelf/Area</Label>
                        <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="e.g., Shelf 3, Tool Box A" />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                  <Button type="submit">{editingItem ? "Update" : "Add Item"}</Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-4 md:grid-cols-3 shrink-0">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Main Warehouse Items</CardTitle>
              <WarehouseIcon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{mainWarehouseItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Deployed to Projects</CardTitle>
              <Building2 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{projectWarehouseItems.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Asset Value</CardTitle>
              <Package className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">₱{totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); setCategoryFilter("all"); setProjectFilter("all"); }} className="flex-1 flex flex-col min-h-0">
          <TabsList className="w-full justify-start shrink-0">
            <TabsTrigger value="main" className="flex items-center gap-2">
              <WarehouseIcon className="h-4 w-4" /> Main Warehouse
            </TabsTrigger>
            <TabsTrigger value="project" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" /> Project Warehouse
            </TabsTrigger>
          </TabsList>

          <div className="bg-muted/30 p-3 mt-4 border rounded-lg flex gap-4 shrink-0">
            <div className="space-y-1">
              <Label className="text-xs">Filter by Category:</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[250px] h-9 bg-white dark:bg-background">
                  <SelectValue placeholder="All Categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            
            {activeTab === "project" && (
              <div className="space-y-1">
                <Label className="text-xs">Filter by Project:</Label>
                <Select value={projectFilter} onValueChange={setProjectFilter}>
                  <SelectTrigger className="w-[250px] h-9 bg-white dark:bg-background">
                    <SelectValue placeholder="All Projects" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <TabsContent value="main" className="flex-1 mt-4 data-[state=active]:flex flex-col min-h-0">
            <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none">
              <div className="overflow-y-auto rounded-md border h-full relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Unit Price</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMain.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No items found in the Main Warehouse.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredMain.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getCategoryLabel(item.category || "-")}</Badge>
                          </TableCell>
                          <TableCell>{item.location || "General Storage"}</TableCell>
                          <TableCell className="text-right font-semibold">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-right">₱{item.unit_cost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            ₱{(item.quantity * item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
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
              <div className="overflow-y-auto rounded-md border h-full relative">
                <Table>
                  <TableHeader className="sticky top-0 bg-background z-10">
                    <TableRow>
                      <TableHead>Item Name</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Deployed To</TableHead>
                      <TableHead>Specific Area</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                      <TableHead className="text-right">Total Value</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProject.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No items currently deployed to projects.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredProject.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{getCategoryLabel(item.category || "-")}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-semibold text-blue-700 bg-blue-50 border-blue-200">
                              {item.projects?.name || "Unknown Project"}
                            </Badge>
                          </TableCell>
                          <TableCell>{item.location || "-"}</TableCell>
                          <TableCell className="text-right font-semibold">{item.quantity} {item.unit}</TableCell>
                          <TableCell className="text-right font-semibold text-primary">
                            ₱{(item.quantity * item.unit_cost).toLocaleString(undefined, { minimumFractionDigits: 2 })}
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
                              <Button size="sm" variant="ghost" onClick={() => handleEdit(item)}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => handleDelete(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
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
        </Tabs>
      </div>
    </Layout>
  );
}