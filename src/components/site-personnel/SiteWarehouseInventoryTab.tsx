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
  location: string;
  notes: string;
}

interface InventoryItem {
  id: string;
  name: string;
  item_type: "material" | "tool_equipment" | null;
  quantity: number | null;
  unit: string | null;
  location: string | null;
  updated_at: string | null;
}

export function SiteWarehouseInventoryTab({ projectId }: SiteWarehouseInventoryTabProps) {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [activeTab, setActiveTab] = useState<"material" | "tool_equipment">("material");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    itemName: "",
    location: "",
  });
  const [formData, setFormData] = useState<FormState>({
    item_name: "",
    item_type: "material",
    quantity: "",
    unit: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .order("name");

      if (error) throw error;
      setInventory((data || []) as InventoryItem[]);
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

    try {
      const { error } = await supabase.from("inventory").insert({
        project_id: projectId,
        name: formData.item_name,
        item_type: formData.item_type,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        location: formData.location || null,
        category: "Construction Materials",
        unit_cost: 0,
        reorder_level: 0,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${formData.item_type === "material" ? "Material" : "Tool/Equipment"} added to inventory`,
      });

      setDialogOpen(false);
      setFormData({
        item_name: "",
        item_type: "material",
        quantity: "",
        unit: "",
        location: "",
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
          location: formData.location || null,
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
        location: "",
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
      location: item.location || "",
      notes: "",
    });
    setEditDialogOpen(true);
  }

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    return inventory
      .filter((item) => {
        if (item.item_type !== activeTab) return false;
        if (filters.itemName && !item.name.toLowerCase().includes(filters.itemName.toLowerCase())) return false;
        if (filters.location && !item.location?.toLowerCase().includes(filters.location.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inventory, activeTab, filters.itemName, filters.location]);

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

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-8 px-2 text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  Add {activeTab === "material" ? "Material" : "Tool/Equipment"}
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Add {activeTab === "material" ? "Material" : "Tool/Equipment"} to Inventory</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="item_type">Item Type</Label>
                    <Select value={formData.item_type} onValueChange={(value: "material" | "tool_equipment") => setFormData(prev => ({ ...prev, item_type: value }))}>
                      <SelectTrigger id="item_type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="material">Material</SelectItem>
                        <SelectItem value="tool_equipment">Tool/Equipment</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="item_name">Item Name</Label>
                    <Input
                      id="item_name"
                      value={formData.item_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, item_name: e.target.value }))}
                      placeholder={`Enter ${activeTab === "material" ? "material" : "tool/equipment"} name`}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="quantity">Quantity</Label>
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

                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Input
                      id="location"
                      value={formData.location}
                      onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                      placeholder="Storage location (optional)"
                    />
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
          </div>

          <TabsContent value="material" className="mt-4 space-y-3">
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading inventory...</div>
            ) : (
              <>
                <div className="rounded-lg border bg-muted/20 p-2.5">
                  <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-0.5">
                      <p className="text-sm font-medium text-foreground">Materials Inventory</p>
                      <p className="text-xs text-muted-foreground">
                        Track construction materials stored on-site
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
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                      <div className="space-y-1">
                        <Label htmlFor="filter-location" className="text-[11px]">
                          Location
                        </Label>
                        <Input
                          id="filter-location"
                          className="h-8 text-xs"
                          value={filters.location}
                          onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Search location"
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
                          <TableHead className="h-8 px-2 text-[11px]">Item Name</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Quantity</TableHead>
                          <TableHead className="h-8 px-2 text-[11px]">Location</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="px-2 py-1.5 font-medium">
                              <CompactText value={item.name} className="max-w-[200px]" />
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right whitespace-nowrap">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              <CompactText value={item.location || "—"} className="max-w-[150px]" />
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
                        ))}
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
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
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
                      <div className="space-y-1">
                        <Label htmlFor="filter-location" className="text-[11px]">
                          Location
                        </Label>
                        <Input
                          id="filter-location"
                          className="h-8 text-xs"
                          value={filters.location}
                          onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value }))}
                          placeholder="Search location"
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
                          <TableHead className="h-8 px-2 text-right text-[11px]">Quantity</TableHead>
                          <TableHead className="h-8 px-2 text-[11px]">Location</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="px-2 py-1.5 font-medium">
                              <CompactText value={item.name} className="max-w-[200px]" />
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right whitespace-nowrap">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              <CompactText value={item.location || "—"} className="max-w-[150px]" />
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
                        ))}
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
                  <Label htmlFor="edit_quantity">Quantity</Label>
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

              <div className="space-y-2">
                <Label htmlFor="edit_location">Location</Label>
                <Input
                  id="edit_location"
                  value={formData.location}
                  onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                />
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