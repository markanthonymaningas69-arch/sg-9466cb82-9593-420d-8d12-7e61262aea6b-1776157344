import { useEffect, useMemo, useState } from "react";
import { Warehouse, Plus, Trash2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { CompactText } from "@/components/site-personnel/CompactText";

interface SiteWarehouseInventoryTabProps {
  projectId: string;
}

interface FormState {
  item_name: string;
  item_type: "material" | "tool_equipment";
  quantity: string;
  unit: string;
  notes: string;
}

interface InventoryItem {
  id: string;
  name: string;
  item_type: "material" | "tool_equipment" | null;
  quantity: number | null;
  unit: string | null;
  location: string | null;
  category: string | null;
  unit_cost: number | null;
  reorder_level: number | null;
  last_restocked: string | null;
  company_id: string;
  project_id: string;
  is_archived: boolean;
  created_at: string;
}

export function SiteWarehouseInventoryTab({ projectId }: SiteWarehouseInventoryTabProps) {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [deliveries, setDeliveries] = useState<Array<{ item_name: string; quantity: number; source?: string }>>([]);
  const [consumptions, setConsumptions] = useState<Array<{ item_name: string; quantity: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<"material" | "tool_equipment">("material");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    itemName: "",
  });
  const [formData, setFormData] = useState<FormState>({
    item_name: "",
    item_type: "material",
    quantity: "",
    unit: "",
    notes: "",
  });

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      const [inventoryResult, deliveriesResult, consumptionResult] = await Promise.all([
        supabase
          .from("inventory")
          .select("*")
          .eq("project_id", projectId)
          .eq("is_archived", false)
          .order("name"),
        supabase
          .from("deliveries")
          .select("item_name, quantity, unit, source_location")
          .eq("project_id", projectId)
          .eq("is_archived", false),
        supabase
          .from("material_consumption")
          .select("item_name, quantity, unit")
          .eq("project_id", projectId)
          .eq("is_archived", false)
      ]);

      if (inventoryResult.error) throw inventoryResult.error;
      if (deliveriesResult.error) throw deliveriesResult.error;
      if (consumptionResult.error) throw consumptionResult.error;

      // Get unique material names from both deliveries and consumption
      const deliveryMaterials = new Map<string, { unit: string; totalDelivered: number }>();
      const consumptionMaterials = new Map<string, { unit: string; totalConsumed: number }>();

      // Process deliveries
      (deliveriesResult.data || []).forEach(d => {
        const existing = deliveryMaterials.get(d.item_name) || { unit: d.unit || "", totalDelivered: 0 };
        existing.totalDelivered += Number(d.quantity || 0);
        if (!existing.unit && d.unit) existing.unit = d.unit;
        deliveryMaterials.set(d.item_name, existing);
      });

      // Process consumption
      (consumptionResult.data || []).forEach(c => {
        const existing = consumptionMaterials.get(c.item_name) || { unit: c.unit || "", totalConsumed: 0 };
        existing.totalConsumed += Number(c.quantity || 0);
        if (!existing.unit && c.unit) existing.unit = c.unit;
        consumptionMaterials.set(c.item_name, existing);
      });

      // Get all unique material names
      const allMaterialNames = new Set([
        ...deliveryMaterials.keys(),
        ...consumptionMaterials.keys()
      ]);

      // Build unified inventory list
      const unifiedInventory: InventoryItem[] = Array.from(allMaterialNames).map(materialName => {
        const delivery = deliveryMaterials.get(materialName);
        const consumption = consumptionMaterials.get(materialName);
        const unit = delivery?.unit || consumption?.unit || "";
        
        // Find actual count from inventory table (manual entry)
        const inventoryItem = (inventoryResult.data || []).find(
          (inv: InventoryItem) => inv.name === materialName && inv.item_type === "material"
        );

        // If inventory item exists, use it; otherwise create a virtual record
        if (inventoryItem) {
          return inventoryItem as InventoryItem;
        } else {
          // Create virtual inventory record for materials that exist in deliveries/consumption but not in inventory
          return {
            id: `virtual_${materialName}`,
            name: materialName,
            item_type: "material" as const,
            quantity: 0, // No actual count yet
            unit: unit,
            location: null,
            category: "Construction Materials",
            unit_cost: null,
            reorder_level: null,
            last_restocked: null,
            company_id: "",
            project_id: projectId,
            is_archived: false,
            created_at: new Date().toISOString(),
          };
        }
      });

      // Add tools/equipment from inventory (they don't appear in deliveries/consumption)
      const toolsEquipment = (inventoryResult.data || []).filter(
        (inv: any) => inv.item_type === "tool_equipment"
      ) as InventoryItem[];

      setInventory([...unifiedInventory, ...toolsEquipment]);
      setDeliveries(deliveriesResult.data || []);
      setConsumptions(consumptionResult.data || []);
    } catch (error) {
      console.error("Error loading inventory:", error);
      toast({
        title: "Error",
        description: "Failed to load inventory data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.item_name || !formData.quantity || !formData.unit) {
      toast({
        title: "Required",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Only allow adding tools/equipment manually (materials auto-populate)
    if (formData.item_type !== "tool_equipment") {
      toast({
        title: "Not Allowed",
        description: "Materials are auto-populated from deliveries and usage logs",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("inventory").insert({
        project_id: projectId,
        name: formData.item_name,
        item_type: formData.item_type,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        category: "Construction Materials",
        unit_cost: 0,
        reorder_level: 0,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Tool/Equipment added to inventory",
      });

      setDialogOpen(false);
      setFormData({
        item_name: "",
        item_type: "tool_equipment",
        quantity: "",
        unit: "",
        notes: "",
      });
      void loadData();
    } catch (error: any) {
      console.error("Error adding inventory:", error);
      toast({
        title: "Error",
        description: "Failed to add inventory item",
        variant: "destructive",
      });
    }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();

    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from("inventory")
        .update({
          name: formData.item_name,
          item_type: formData.item_type,
          quantity: Number(formData.quantity),
          unit: formData.unit,
        })
        .eq("id", editingItem.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Inventory item updated",
      });

      setEditDialogOpen(false);
      setEditingItem(null);
      setFormData({
        item_name: "",
        item_type: "material",
        quantity: "",
        unit: "",
        notes: "",
      });
      void loadData();
    } catch (error: any) {
      console.error("Error updating inventory:", error);
      toast({
        title: "Error",
        description: "Failed to update inventory item",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(itemId: string) {
    if (!confirm("Are you sure you want to delete this item?")) return;

    try {
      const { error } = await supabase
        .from("inventory")
        .update({ is_archived: true })
        .eq("id", itemId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Item deleted",
      });

      void loadData();
    } catch (error: any) {
      console.error("Error deleting item:", error);
      toast({
        title: "Error",
        description: "Failed to delete item",
        variant: "destructive",
      });
    }
  }

  function openEditDialog(item: InventoryItem) {
    setEditingItem(item);
    setFormData({
      item_name: item.name,
      item_type: item.item_type || "material",
      quantity: String(item.quantity || 0),
      unit: item.unit || "",
      notes: "",
    });
    setEditDialogOpen(true);
  }

  function calculateExpectedRemaining(materialName: string): number {
    const totalDelivered = deliveries
      .filter(d => d.item_name === materialName)
      .reduce((sum, d) => sum + Number(d.quantity || 0), 0);

    const totalConsumed = consumptions
      .filter(c => c.item_name === materialName)
      .reduce((sum, c) => sum + Number(c.quantity || 0), 0);

    return totalDelivered - totalConsumed;
  }

  function calculateDelivered(materialName: string): number {
    return deliveries
      .filter(d => d.item_name === materialName)
      .reduce((sum, d) => sum + Number(d.quantity || 0), 0);
  }

  function calculateConsumed(materialName: string): number {
    return consumptions
      .filter(c => c.item_name === materialName)
      .reduce((sum, c) => sum + Number(c.quantity || 0), 0);
  }

  async function handleActualCountUpdate(itemId: string, materialName: string, unit: string, newActualCount: number) {
    try {
      // Check if this is a virtual item (starts with "virtual_")
      if (itemId.startsWith("virtual_")) {
        // Create new inventory record
        const { data, error } = await supabase
          .from("inventory")
          .insert({
            project_id: projectId,
            name: materialName,
            item_type: "material",
            quantity: newActualCount,
            unit: unit,
            category: "Construction Materials",
            unit_cost: 0,
            reorder_level: 0,
          })
          .select()
          .single();

        if (error) throw error;

        toast({
          title: "Created",
          description: "Material added to inventory with actual count",
        });

        // Reload to get the real database ID
        void loadData();
      } else {
        // Update existing inventory record
        const { error } = await supabase
          .from("inventory")
          .update({ quantity: newActualCount })
          .eq("id", itemId);

        if (error) throw error;

        // Update local state
        setInventory(prev => prev.map(item => 
          item.id === itemId ? { ...item, quantity: newActualCount } : item
        ));

        toast({
          title: "Updated",
          description: "Actual count updated",
        });
      }
    } catch (error: any) {
      console.error("Error updating actual count:", error);
      toast({
        title: "Error",
        description: "Failed to update actual count",
        variant: "destructive",
      });
    }
  }

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    
    // Filter by tab and search term
    const filtered = inventory.filter((item) => {
      // Filter by search term
      if (filters.itemName && !item.name.toLowerCase().includes(filters.itemName.toLowerCase())) {
        return false;
      }
      
      // Filter by item type based on active tab
      if (activeTab === "material") {
        // Materials tab: show all except tool_equipment
        if (item.item_type === "tool_equipment") return false;
      } else {
        // Tools tab: only show tool_equipment
        if (item.item_type !== "tool_equipment") return false;
      }
      
      return true;
    });
    
    return filtered.sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, activeTab, filters.itemName]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <Warehouse className="h-4 w-4" />
          Site Warehouse Inventory
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4 pt-0">
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "material" | "tool_equipment")}>
          <div className="flex items-center justify-between gap-3">
            <TabsList className="h-9">
              <TabsTrigger value="material" className="text-xs">
                Materials
              </TabsTrigger>
              <TabsTrigger value="tool_equipment" className="text-xs">
                Tools & Equipment
              </TabsTrigger>
            </TabsList>

            {activeTab === "tool_equipment" && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-8 px-2 text-xs">
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Add Tool/Equipment
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add Tool/Equipment to Inventory</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="item_name">Item Name</Label>
                      <Input
                        id="item_name"
                        value={formData.item_name}
                        onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                        placeholder="Enter tool/equipment name"
                        required
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="quantity">Actual Count</Label>
                        <Input
                          id="quantity"
                          type="number"
                          step="0.01"
                          min="0"
                          value={formData.quantity}
                          onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="unit">Unit</Label>
                        <Input
                          id="unit"
                          value={formData.unit}
                          onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                          placeholder={activeTab === "material" ? "bags, pcs, cu.m" : "pcs, units"}
                          required
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button type="button" variant="outline" className="flex-1" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" className="flex-1">
                        Add to Inventory
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <TabsContent value="material" className="mt-4 space-y-3">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading inventory...</div>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Materials Inventory Tracking</p>
                      <p className="text-xs text-muted-foreground">
                        Auto-populated from Site Purchase & Deliveries and Usage Logs
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setFiltersOpen(!filtersOpen)}
                    >
                      <Filter className="mr-1.5 h-3.5 w-3.5" />
                      {filtersOpen ? "Hide filters" : "Filter"}
                    </Button>
                  </div>

                  {filtersOpen && (
                    <div className="mt-3">
                      <div className="space-y-1">
                        <Label htmlFor="filter-item" className="text-[11px]">
                          Item Name
                        </Label>
                        <Input
                          id="filter-item"
                          className="h-8 text-xs"
                          value={filters.itemName}
                          onChange={(e) => setFilters(prev => ({ ...prev, itemName: e.target.value }))}
                          placeholder="Search items"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {filteredInventory.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    No materials in inventory
                  </div>
                ) : (
                  <div className="overflow-auto rounded-md border">
                    <Table className="text-xs">
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="h-8 px-2 text-[11px]">Material Name</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Delivered</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Consumed</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Expected Remaining</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Actual Count</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Variance</TableHead>
                          <TableHead className="h-8 px-2 text-center text-[11px]">Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((item) => {
                          const delivered = calculateDelivered(item.name);
                          const consumed = calculateConsumed(item.name);
                          const expectedRemaining = delivered - consumed;
                          const actualCount = item.quantity || 0;
                          const variance = expectedRemaining - actualCount;
                          
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="px-2 py-1.5 font-medium">
                                <CompactText value={item.name} className="max-w-[180px]" />
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-right whitespace-nowrap text-blue-600 font-medium">
                                {delivered.toFixed(2)} {item.unit}
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-right whitespace-nowrap text-orange-600 font-medium">
                                {consumed.toFixed(2)} {item.unit}
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-right whitespace-nowrap">
                                <span className={`font-semibold ${
                                  expectedRemaining === 0 ? 'text-red-600' : 
                                  expectedRemaining < 10 ? 'text-orange-600' : 
                                  'text-green-600'
                                }`}>
                                  {expectedRemaining.toFixed(2)} {item.unit}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-right">
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  value={actualCount}
                                  onChange={(e) => void handleActualCountUpdate(item.id, item.name, item.unit || "", Number(e.target.value))}
                                  className="h-7 w-20 text-right text-xs"
                                />
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-right whitespace-nowrap">
                                <span className={`font-semibold ${
                                  variance === 0 ? 'text-muted-foreground' : 
                                  variance < 0 ? 'text-red-600' : 
                                  'text-green-600'
                                }`}>
                                  {variance > 0 ? '+' : ''}{variance.toFixed(2)} {item.unit}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-center">
                                {variance === 0 ? (
                                  <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-800">
                                    Match
                                  </span>
                                ) : variance < 0 ? (
                                  <span className="inline-flex items-center rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-red-800">
                                    Missing
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-medium text-green-800">
                                    Excess
                                  </span>
                                )}
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="tool_equipment" className="mt-4 space-y-3">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading inventory...</div>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Tools & Equipment Inventory</p>
                      <p className="text-xs text-muted-foreground">
                        Track tools and equipment stored on-site
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setFiltersOpen(!filtersOpen)}
                    >
                      <Filter className="mr-1.5 h-3.5 w-3.5" />
                      {filtersOpen ? "Hide filters" : "Filter"}
                    </Button>
                  </div>

                  {filtersOpen && (
                    <div className="mt-3">
                      <div className="space-y-1">
                        <Label htmlFor="filter-item-tools" className="text-[11px]">
                          Item Name
                        </Label>
                        <Input
                          id="filter-item-tools"
                          className="h-8 text-xs"
                          value={filters.itemName}
                          onChange={(e) => setFilters(prev => ({ ...prev, itemName: e.target.value }))}
                          placeholder="Search items"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {filteredInventory.length === 0 ? (
                  <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                    No tools or equipment in inventory
                  </div>
                ) : (
                  <div className="overflow-auto rounded-md border">
                    <Table className="text-xs">
                      <TableHeader className="sticky top-0 bg-background">
                        <TableRow>
                          <TableHead className="h-8 px-2 text-[11px]">Item Name</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Delivered</TableHead>
                          <TableHead className="h-8 px-2 text-[11px]">Source</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((item) => {
                          const delivered = calculateDelivered(item.name);
                          const deliverySource = deliveries.find(d => d.item_name === item.name)?.source || "Main Warehouse";
                          
                          return (
                            <TableRow key={item.id}>
                              <TableCell className="px-2 py-1.5 font-medium">
                                <CompactText value={item.name} className="max-w-[200px]" />
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-right whitespace-nowrap text-blue-600 font-medium">
                                {delivered.toFixed(2)} {item.unit}
                              </TableCell>
                              <TableCell className="px-2 py-1.5">
                                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                                  deliverySource === "Main Warehouse" 
                                    ? "bg-blue-100 text-blue-800" 
                                    : "bg-purple-100 text-purple-800"
                                }`}>
                                  {deliverySource}
                                </span>
                              </TableCell>
                              <TableCell className="px-2 py-1.5 text-right">
                                <div className="flex justify-end gap-1">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => openEditDialog(item)}
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5">
                                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                      <path d="m15 5 4 4"/>
                                    </svg>
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7"
                                    onClick={() => void handleDelete(item.id)}
                                  >
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </>
            )}
          </TabsContent>
        </Tabs>

        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Edit Inventory Item</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleEdit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit_item_type">Item Type</Label>
                <Select value={formData.item_type} onValueChange={(value: "material" | "tool_equipment") => setFormData(prev => ({ ...prev, item_type: value }))}>
                  <SelectTrigger id="edit_item_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material">Material</SelectItem>
                    <SelectItem value="tool_equipment">Tool/Equipment</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit_item_name">Item Name</Label>
                <Input
                  id="edit_item_name"
                  value={formData.item_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit_quantity">Actual Count</Label>
                  <Input
                    id="edit_quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit_unit">Unit</Label>
                  <Input
                    id="edit_unit"
                    value={formData.unit}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" className="flex-1">
                  Update
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}