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
import { useToast } from "@/hooks/use-toast";
import { warehouseService } from "@/services/warehouseService";
import { projectService } from "@/services/projectService";
import { useSettings } from "@/contexts/SettingsProvider";
import { Plus, Pencil, Trash2, Archive, Package, Building2, Warehouse as WarehouseIcon, FileSpreadsheet, Truck, Filter } from "lucide-react";
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
  const { formatCurrency, isLocked } = useSettings();
  const { toast } = useToast();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Tabs and Filters
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Form State
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deployDialogOpen, setDeployDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [deployingItem, setDeployingItem] = useState<WarehouseItem | null>(null);
  const [deployForm, setDeployForm] = useState({ projectId: "", quantity: "", notes: "" });
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
    const [{ data: itemsData }, { data: projectsData }, { data: masterData }] = await Promise.all([
      warehouseService.getAll(),
      projectService.getAll(),
      projectService.getMasterItems()
    ]);
    
    const allItems = itemsData as WarehouseItem[] || [];
    
    setItems(allItems);
    setProjects(projectsData || []);
    setMasterItems(masterData || []);
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
      project_id: null // CRITICAL: Always null for Main warehouse items added via "Add Item" button
    };

    try {
      if (editingItem) {
        await warehouseService.update(editingItem.id, itemData);
        toast({
          title: "Success",
          description: "Item updated successfully",
        });
      } else {
        await warehouseService.create(itemData as any);
        toast({
          title: "Success", 
          description: `${itemData.name} added to Main Warehouse`,
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Error saving item:", error);
      toast({
        title: "Error",
        description: "Failed to save item",
        variant: "destructive",
      });
    }
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

  const handleDeploySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!deployingItem || !deployForm.projectId || !deployForm.quantity) {
      return;
    }

    const deployQty = parseInt(deployForm.quantity);
    
    if (deployQty > deployingItem.quantity) {
      toast({
        title: "Error",
        description: "Deploy quantity exceeds available stock",
        variant: "destructive",
      });
      return;
    }

    try {
      // Create project inventory record
      const { error: createError } = await supabase.from("inventory").insert({
        name: deployingItem.name,
        category: deployingItem.category,
        quantity: deployQty,
        unit: deployingItem.unit,
        unit_cost: deployingItem.unit_cost,
        reorder_level: 0,
        project_id: deployForm.projectId,
        last_restocked: new Date().toISOString().split("T")[0]
      });

      if (createError) throw createError;

      // Reduce quantity from main warehouse
      const { error: updateError } = await supabase
        .from("inventory")
        .update({ quantity: deployingItem.quantity - deployQty })
        .eq("id", deployingItem.id);

      if (updateError) throw updateError;

      toast({
        title: "Success",
        description: `Deployed ${deployQty} ${deployingItem.unit} of ${deployingItem.name} to project`,
      });

      setDeployDialogOpen(false);
      setDeployingItem(null);
      setDeployForm({ projectId: "", quantity: "", notes: "" });
      await loadData();
    } catch (error) {
      console.error("Error deploying item:", error);
      toast({
        title: "Error",
        description: "Failed to deploy item",
        variant: "destructive",
      });
    }
  };

  const getCategoryLabel = (val: string) => {
    const legacyMap: Record<string, string> = { materials: "Construction Materials", tools: "Tools", equipment: "Equipments", safety: "PPE" };
    return legacyMap[val] || val;
  };

  // Generate dynamic unique categories from the actual items in the database
  const uniqueCategories = Array.from(new Set(items.map(i => getCategoryLabel(i.category || "Uncategorized"))));

  // Main warehouse items only
  const mainWarehouseItems = items.filter(item => !item.project_id);

  const filteredMain = mainWarehouseItems.filter(item => {
    const matchCategory = categoryFilter === "all" || getCategoryLabel(item.category || "Uncategorized") === categoryFilter;
    const matchDate = !dateFilter || item.last_restocked === dateFilter;
    return matchCategory && matchDate;
  });

  const totalValue = mainWarehouseItems.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);

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
              <Button onClick={resetForm} disabled={isLocked}>
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
                      value={deployForm.projectId} 
                      onValueChange={(val) => setDeployForm({ ...deployForm, projectId: val })} 
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
                      onChange={(e) => setDeployForm({ ...deployForm, quantity: e.target.value })} 
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

        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mt-2">
            <h2 className="text-xl font-semibold">Main Warehouse</h2>
            <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="shrink-0 h-9 w-full sm:w-auto">
              <Filter className="h-4 w-4 mr-2" />
              {showFilters ? "Hide Filters" : "Filters"}
              {(categoryFilter !== "all" || dateFilter) && (
                <span className="ml-2 flex h-2 w-2 rounded-full bg-primary shadow-[0_0_4px_rgba(var(--primary),0.5)]"></span>
              )}
            </Button>
          </div>

          {showFilters && (
            <div className="bg-muted/30 p-3 mt-4 border rounded-lg flex flex-wrap items-end gap-4 shrink-0">
              <div className="space-y-1">
                <Label className="text-xs">Filter by Category:</Label>
                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger className="w-[200px] h-9 bg-background">
                    <SelectValue placeholder="All Categories" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {uniqueCategories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="text-xs">Filter by Date:</Label>
                <Input 
                  type="date" 
                  className="w-[200px] h-9 bg-background" 
                  value={dateFilter} 
                  onChange={(e) => setDateFilter(e.target.value)} 
                />
              </div>
              
              {(categoryFilter !== "all" || dateFilter) && (
                <Button variant="ghost" size="sm" onClick={() => { setCategoryFilter("all"); setDateFilter(""); }} className="text-muted-foreground h-9 ml-1">
                  Clear Filters
                </Button>
              )}
            </div>
          )}

          <Card className="flex-1 flex flex-col min-h-0 border-0 shadow-none bg-background mt-4">
            <div className="overflow-x-auto rounded-md border h-full relative bg-background -mx-3 px-3 sm:mx-0 sm:px-0">
              <Table className="min-w-[900px]">
                <TableHeader className="sticky top-0 bg-muted z-10">
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
                        {mainWarehouseItems.length === 0 ? (
                          <>No items found in the Main Warehouse. Click "Add Item" to get started.</>
                        ) : (
                          <>No items match the current filters. {categoryFilter !== "all" || dateFilter ? <button onClick={() => { setCategoryFilter("all"); setDateFilter(""); }} className="text-primary underline ml-1">Clear filters</button> : null}</>
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredMain.map((item) => (
                      <TableRow key={item.id} className={item.quantity === 0 ? "opacity-50" : ""}>
                        <TableCell>{item.last_restocked || "—"}</TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {item.name}
                            {item.quantity === 0 && (
                              <Badge variant="outline" className="text-[10px] h-5 bg-red-50 text-red-700 border-red-200">
                                Out of Stock
                              </Badge>
                            )}
                            {item.quantity > 0 && item.quantity <= (item.reorder_level || 0) && (
                              <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">
                                Low Stock
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] h-5">
                            {item.category || "Uncategorized"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span className={item.quantity === 0 ? "text-red-600" : ""}>
                            {item.quantity} {item.unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">{item.reorder_level || 0}</TableCell>
                        <TableCell className="text-right">{formatCurrency(item.unit_cost || 0)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency((item.quantity || 0) * (item.unit_cost || 0))}
                        </TableCell>
                        <TableCell>
                          {item.quantity === 0 ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              Out of Stock
                            </Badge>
                          ) : item.quantity <= (item.reorder_level || 0) ? (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                              Low Stock
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              In Stock
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onClick={() => handleEdit(item)}
                            >
                              Edit
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2"
                              onClick={() => {
                                setDeployingItem(item);
                                setDeployForm({ projectId: "", quantity: "", notes: "" });
                                setDeployDialogOpen(true);
                              }}
                              disabled={item.quantity === 0}
                            >
                              Deploy
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(item.id)}
                            >
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
          </Card>
        </div>
      </div>
    </Layout>
  );
}