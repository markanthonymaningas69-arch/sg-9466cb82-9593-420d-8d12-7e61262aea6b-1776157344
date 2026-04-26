import { useEffect, useMemo, useState } from "react";
import { Archive, AlertTriangle, Pencil, Plus, Warehouse as WarehouseIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { warehouseService } from "@/services/warehouseService";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

type WarehouseItem = Database["public"]["Tables"]["inventory"]["Row"];

interface SiteWarehouseInventoryTabProps {
  projectId: string;
}

interface WarehouseFormState {
  name: string;
  category: string;
  quantity: string;
  unit: string;
  unitCost: string;
  reorderLevel: string;
  lastRestocked: string;
}

const initialFormState = (): WarehouseFormState => ({
  name: "",
  category: "",
  quantity: "",
  unit: "",
  unitCost: "",
  reorderLevel: "",
  lastRestocked: new Date().toISOString().split("T")[0],
});

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "AED",
  minimumFractionDigits: 2,
});

export function SiteWarehouseInventoryTab({ projectId }: SiteWarehouseInventoryTabProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<WarehouseItem | null>(null);
  const [formData, setFormData] = useState<WarehouseFormState>(initialFormState);

  useEffect(() => {
    void loadItems();
  }, [projectId]);

  async function loadItems() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("inventory")
        .select("*")
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      setItems(data || []);
    } catch (error) {
      console.error("Error loading site warehouse items:", error);
      toast({
        title: "Error",
        description: "Failed to load site warehouse items.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingItem(null);
    setFormData(initialFormState());
  }

  function handleEdit(item: WarehouseItem) {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category || "",
      quantity: String(item.quantity || 0),
      unit: item.unit,
      unitCost: String(item.unit_cost || 0),
      reorderLevel: String(item.reorder_level || 0),
      lastRestocked: item.last_restocked || new Date().toISOString().split("T")[0],
    });
    setDialogOpen(true);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      name: formData.name.trim(),
      category: formData.category.trim() || null,
      quantity: Number(formData.quantity) || 0,
      unit: formData.unit.trim(),
      unit_cost: Number(formData.unitCost) || 0,
      reorder_level: Number(formData.reorderLevel) || 0,
      last_restocked: formData.lastRestocked,
      project_id: projectId,
    };

    if (!payload.name || !payload.unit) {
      toast({
        title: "Required fields missing",
        description: "Item name and unit are required.",
        variant: "destructive",
      });
      return;
    }

    try {
      const result = editingItem
        ? await warehouseService.update(editingItem.id, payload)
        : await warehouseService.create(payload);

      if (result.error) {
        throw result.error;
      }

      toast({
        title: editingItem ? "Item updated" : "Item added",
        description: editingItem
          ? "Site warehouse item has been updated."
          : "New site warehouse item has been added.",
      });

      setDialogOpen(false);
      resetForm();
      void loadItems();
    } catch (error) {
      console.error("Error saving site warehouse item:", error);
      toast({
        title: "Error",
        description: "Failed to save site warehouse item.",
        variant: "destructive",
      });
    }
  }

  async function handleArchive(id: string) {
    if (!confirm("Archive this site warehouse item?")) {
      return;
    }

    try {
      const result = await warehouseService.delete(id);
      if (result.error) {
        throw result.error;
      }

      toast({
        title: "Item archived",
        description: "The site warehouse item has been archived.",
      });
      void loadItems();
    } catch (error) {
      console.error("Error archiving site warehouse item:", error);
      toast({
        title: "Error",
        description: "Failed to archive site warehouse item.",
        variant: "destructive",
      });
    }
  }

  const totals = useMemo(() => {
    const lowStock = items.filter((item) => item.quantity <= (item.reorder_level || 0)).length;
    const inventoryValue = items.reduce((sum, item) => sum + item.quantity * item.unit_cost, 0);

    return {
      count: items.length,
      lowStock,
      inventoryValue,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tracked Items</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.count}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Alerts</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.lowStock}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{currencyFormatter.format(totals.inventoryValue)}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="flex items-center gap-2">
            <WarehouseIcon className="h-5 w-5" />
            Site Warehouse
          </CardTitle>

          <Dialog
            open={dialogOpen}
            onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) {
                resetForm();
              }
            }}
          >
            <DialogTrigger asChild>
              <Button size="sm" onClick={resetForm}>
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Site Warehouse Item" : "Add Site Warehouse Item"}</DialogTitle>
              </DialogHeader>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="site-warehouse-name">Item Name</Label>
                    <Input
                      id="site-warehouse-name"
                      value={formData.name}
                      onChange={(event) => setFormData((current) => ({ ...current, name: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-warehouse-category">Category</Label>
                    <Input
                      id="site-warehouse-category"
                      value={formData.category}
                      onChange={(event) => setFormData((current) => ({ ...current, category: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-warehouse-quantity">Quantity</Label>
                    <Input
                      id="site-warehouse-quantity"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.quantity}
                      onChange={(event) => setFormData((current) => ({ ...current, quantity: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-warehouse-unit">Unit</Label>
                    <Input
                      id="site-warehouse-unit"
                      value={formData.unit}
                      onChange={(event) => setFormData((current) => ({ ...current, unit: event.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-warehouse-unit-cost">Unit Cost</Label>
                    <Input
                      id="site-warehouse-unit-cost"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.unitCost}
                      onChange={(event) => setFormData((current) => ({ ...current, unitCost: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="site-warehouse-reorder-level">Reorder Level</Label>
                    <Input
                      id="site-warehouse-reorder-level"
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.reorderLevel}
                      onChange={(event) => setFormData((current) => ({ ...current, reorderLevel: event.target.value }))}
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <Label htmlFor="site-warehouse-last-restocked">Last Restocked</Label>
                    <Input
                      id="site-warehouse-last-restocked"
                      type="date"
                      value={formData.lastRestocked}
                      onChange={(event) => setFormData((current) => ({ ...current, lastRestocked: event.target.value }))}
                    />
                  </div>
                </div>

                <Button className="w-full" type="submit">
                  {editingItem ? "Save Changes" : "Add Item"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading site warehouse items...</div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No site warehouse items recorded for this project yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Restocked</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="w-[90px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => {
                  const isLowStock = item.quantity <= (item.reorder_level || 0);

                  return (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell>{item.category || "-"}</TableCell>
                      <TableCell>
                        {item.quantity} {item.unit}
                      </TableCell>
                      <TableCell>
                        {isLowStock ? (
                          <Badge variant="outline" className="gap-1 text-amber-700">
                            <AlertTriangle className="h-3.5 w-3.5" />
                            Low Stock
                          </Badge>
                        ) : (
                          <Badge variant="outline">Available</Badge>
                        )}
                      </TableCell>
                      <TableCell>{item.last_restocked || "-"}</TableCell>
                      <TableCell className="text-right">{currencyFormatter.format(item.quantity * item.unit_cost)}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(item)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => void handleArchive(item.id)}>
                            <Archive className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}