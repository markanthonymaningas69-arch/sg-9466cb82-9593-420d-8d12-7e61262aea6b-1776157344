import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Package, Plus, Trash2 } from "lucide-react";

interface Delivery {
  id: string;
  project_id: string;
  material_name: string;
  quantity: number;
  unit: string;
  supplier: string;
  delivery_date: string;
  received_by: string;
  notes?: string;
  created_at: string;
}

interface WarehouseItem {
  id: string;
  name: string;
  quantity: number;
  unit: string;
}

export function SiteWarehouseTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    material_name: "",
    quantity: "",
    unit: "",
    supplier: "",
    delivery_date: new Date().toISOString().split("T")[0],
    received_by: "",
    notes: "",
  });

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      // Load deliveries
      const { data: deliveriesData, error: deliveriesError } = await supabase
        .from("deliveries")
        .select("*")
        .eq("project_id", projectId)
        .order("delivery_date", { ascending: false });

      if (deliveriesError) throw deliveriesError;
      setDeliveries(deliveriesData || []);

      // Load warehouse items for autocomplete (inventory table)
      const { data: warehouseData, error: warehouseError } = await supabase
        .from("inventory")
        .select("id, name, quantity, unit")
        .eq("project_id", projectId)
        .order("name");

      if (warehouseError) throw warehouseError;
      setWarehouseItems(warehouseData || []);
    } catch (error) {
      console.error("Error loading deliveries:", error);
      toast({
        title: "Error",
        description: "Failed to load delivery data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { error } = await supabase.from("deliveries").insert({
        project_id: projectId,
        item_name: formData.material_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        supplier: formData.supplier,
        delivery_date: formData.delivery_date,
        received_by: formData.received_by,
        notes: formData.notes || null,
        status: "pending"
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Delivery recorded successfully",
      });

      setDialogOpen(false);
      setFormData({
        material_name: "",
        quantity: "",
        unit: "",
        supplier: "",
        delivery_date: new Date().toISOString().split("T")[0],
        received_by: "",
        notes: "",
      });
      void loadData();
    } catch (error) {
      console.error("Error creating delivery:", error);
      toast({
        title: "Error",
        description: "Failed to record delivery",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this delivery record?")) return;

    try {
      const { error } = await supabase.from("deliveries").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Delivery deleted",
      });
      void loadData();
    } catch (error) {
      console.error("Error deleting delivery:", error);
      toast({
        title: "Error",
        description: "Failed to delete delivery",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Site Warehouse - Material Deliveries
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Record Delivery
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Material Delivery</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="material_name">Material Name</Label>
                <Select
                  value={formData.material_name}
                  onValueChange={(value) => {
                    const item = warehouseItems.find((i) => i.name === value);
                    setFormData((prev) => ({
                      ...prev,
                      material_name: value,
                      unit: item?.unit || prev.unit,
                    }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouseItems.map((item) => (
                      <SelectItem key={item.id} value={item.name}>
                        {item.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(e) => setFormData((prev) => ({ ...prev, supplier: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="delivery_date">Delivery Date</Label>
                  <Input
                    id="delivery_date"
                    type="date"
                    value={formData.delivery_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, delivery_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="received_by">Received By</Label>
                  <Input
                    id="received_by"
                    value={formData.received_by}
                    onChange={(e) => setFormData((prev) => ({ ...prev, received_by: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <Button type="submit" className="w-full">
                Record Delivery
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading deliveries...</div>
        ) : deliveries.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No deliveries recorded yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Received By</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow key={delivery.id}>
                  <TableCell>{new Date(delivery.delivery_date).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{delivery.item_name}</TableCell>
                  <TableCell>
                    {delivery.quantity} {delivery.unit}
                  </TableCell>
                  <TableCell>{delivery.supplier}</TableCell>
                  <TableCell>{delivery.received_by}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{delivery.notes || "-"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => void handleDelete(delivery.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}