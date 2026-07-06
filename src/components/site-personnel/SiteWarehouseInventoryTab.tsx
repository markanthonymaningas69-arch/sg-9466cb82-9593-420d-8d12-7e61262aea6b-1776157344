import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, PackageSearch, Save, Warehouse as WarehouseIcon, Filter, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { siteService, type WarehouseMaterialLedgerItem } from "@/services/siteService";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  item_name: string;
  item_type: "material" | "tool_equipment" | null;
  quantity: number | null;
  unit: string | null;
  location: string | null;
  notes: string | null;
  updated_at: string | null;
}

const quantityFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function formatQuantity(value: number) {
  return quantityFormatter.format(value);
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

function getStatusBadge(status: WarehouseMaterialLedgerItem["varianceStatus"]) {
  if (status === "balanced") {
    return { label: "Balanced", className: "border-emerald-300 text-emerald-700" };
  }

  if (status === "missing") {
    return { label: "Missing", className: "border-amber-300 text-amber-700" };
  }

  if (status === "excess") {
    return { label: "Excess", className: "border-sky-300 text-sky-700" };
  }

  return { label: "Needs Count", className: "border-slate-300 text-slate-700" };
}

export function SiteWarehouseInventoryTab({ projectId }: SiteWarehouseInventoryTabProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<WarehouseMaterialLedgerItem[]>([]);
  const [remainingInputs, setRemainingInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    material: "",
    scope: "all",
    status: "all",
    countState: "all",
  });
  const [activeTab, setActiveTab] = useState<"material" | "tool_equipment">("material");
  const [formData, setFormData] = useState<FormState>({
    item_name: "",
    item_type: "material",
    quantity: "",
    unit: "",
    location: "",
    notes: "",
  });

  useEffect(() => {
    void loadItems();
  }, [projectId]);

  async function loadItems() {
    try {
      setLoading(true);
      const { data, error } = await siteService.getWarehouseMaterialLedger(projectId);

      if (error) {
        throw error;
      }

      const nextItems = data || [];
      setItems(nextItems);
      setRemainingInputs(
        Object.fromEntries(
          nextItems.map((item) => [item.key, item.recordedRemaining === null ? "" : String(item.recordedRemaining)])
        )
      );
    } catch (error) {
      console.error("Error loading linked site warehouse ledger:", error);
      toast({
        title: "Error",
        description: "Failed to load linked site warehouse data.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function loadData() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .order("item_name");

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

  async function handleSaveRemaining(item: WarehouseMaterialLedgerItem) {
    const rawValue = remainingInputs[item.key];

    if (rawValue === "" || Number.isNaN(Number(rawValue))) {
      toast({
        title: "Remaining materials required",
        description: "Enter a valid remaining quantity before saving.",
        variant: "destructive",
      });
      return;
    }

    if (!item.unit.trim()) {
      toast({
        title: "Unit missing",
        description: "This material needs a unit before remaining quantity can be saved.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingKey(item.key);

      const payload = {
        project_id: projectId,
        name: item.name,
        category: item.category || "Construction Materials",
        quantity: Number(rawValue),
        unit: item.unit,
        unit_cost: 0,
        reorder_level: 0,
        last_restocked: item.lastRestocked || getTodayDate(),
      };

      const query = item.inventoryId
        ? supabase.from("inventory").update(payload).eq("id", item.inventoryId).select().single()
        : supabase.from("inventory").insert(payload).select().single();

      const { error } = await query;

      if (error) {
        throw error;
      }

      toast({
        title: "Remaining materials saved",
        description: `${item.name} has been updated in Site Warehouse.`,
      });

      await loadItems();
    } catch (error) {
      console.error("Error saving remaining materials:", error);
      toast({
        title: "Error",
        description: "Failed to save remaining materials.",
        variant: "destructive",
      });
    } finally {
      setSavingKey(null);
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
        item_name: formData.item_name,
        item_type: formData.item_type,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        location: formData.location || null,
        notes: formData.notes || null,
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
          item_name: formData.item_name,
          item_type: formData.item_type,
          quantity: Number(formData.quantity),
          unit: formData.unit,
          location: formData.location || null,
          notes: formData.notes || null,
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

  function openEditDialog(item: InventoryItem) {
    setEditingItem(item);
    setFormData({
      item_name: item.item_name,
      item_type: item.item_type || "material",
      quantity: String(item.quantity || 0),
      unit: item.unit || "",
      location: item.location || "",
      notes: item.notes || "",
    });
    setEditDialogOpen(true);
  }

  const scopeOptions = useMemo(() => {
    return Array.from(new Set(items.flatMap((item) => item.scopeNames))).sort((left, right) => left.localeCompare(right));
  }, [items]);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    return inventory
      .filter((item) => {
        if (item.item_type !== activeTab) return false;
        if (filters.itemName && !item.item_name.toLowerCase().includes(filters.itemName.toLowerCase())) return false;
        if (filters.location && !item.location?.toLowerCase().includes(filters.location.toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => a.item_name.localeCompare(b.item_name));
  }, [inventory, activeTab, filters.itemName, filters.location]);

  const filteredSummary = useMemo(() => {
    return {
      materialCount: filteredItems.length,
      counted: filteredItems.filter((item) => item.recordedRemaining !== null).length,
      issues: filteredItems.filter((item) => item.varianceStatus === "missing" || item.varianceStatus === "excess").length,
    };
  }, [filteredItems]);

  function clearFilters() {
    setFilters({
      material: "",
      scope: "all",
      status: "all",
      countState: "all",
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 py-3">
        <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
          <WarehouseIcon className="h-4 w-4" />
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

                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                      placeholder="Additional notes (optional)"
                      rows={3}
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
                          <TableHead className="h-8 px-2 text-[11px]">Notes</TableHead>
                          <TableHead className="h-8 px-2 text-right text-[11px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredInventory.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell className="px-2 py-1.5 font-medium">
                              <CompactText value={item.item_name} className="max-w-[200px]" />
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-right whitespace-nowrap">
                              {item.quantity} {item.unit}
                            </TableCell>
                            <TableCell className="px-2 py-1.5">
                              <CompactText value={item.location || "—"} className="max-w-[150px]" />
                            </TableCell>
                            <TableCell className="px-2 py-1.5 text-muted-foreground">
                              <CompactText value={item.notes || "—"} className="max-w-[200px]" />
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

              <div className="space-y-2">
                <Label htmlFor="edit_notes">Notes</Label>
                <Textarea
                  id="edit_notes"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={3}
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