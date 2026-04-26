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
import { TrendingDown, Plus, Trash2 } from "lucide-react";

interface MaterialUsage {
  id: string;
  project_id: string;
  bom_scope_id?: string;
  material_name: string;
  quantity: number;
  unit: string;
  recorded_by: string;
  date_used: string;
  notes?: string;
  created_at: string;
  bom_scope_of_work?: {
    name: string;
  };
}

interface BOMScope {
  id: string;
  name: string;
}

interface WarehouseItem {
  id: string;
  name: string;
  unit: string;
}

export function MaterialUsageTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [usageRecords, setUsageRecords] = useState<MaterialUsage[]>([]);
  const [bomScopes, setBomScopes] = useState<BOMScope[]>([]);
  const [warehouseItems, setWarehouseItems] = useState<WarehouseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    material_name: "",
    quantity: "",
    unit: "",
    recorded_by: "",
    date_used: new Date().toISOString().split("T")[0],
    bom_scope_id: "none",
    notes: "",
  });

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      // Load usage records
      const { data: usageData, error: usageError } = await supabase
        .from("material_consumption")
        .select(`
          *,
          bom_scope_of_work (name)
        `)
        .eq("project_id", projectId)
        .order("date_used", { ascending: false });

      if (usageError) throw usageError;
      setUsageRecords((usageData as any) || []);

      // Load BOM scopes - first get the BOM for this project
      const { data: bomData } = await supabase
        .from("bill_of_materials")
        .select("id")
        .eq("project_id", projectId)
        .single();

      if (bomData) {
        const { data: scopesData, error: scopesError } = await supabase
          .from("bom_scope_of_work")
          .select("id, name")
          .eq("bom_id", bomData.id)
          .order("order_number");

        if (scopesError) throw scopesError;
        setBomScopes(scopesData || []);
      }

      // Load warehouse items (inventory)
      const { data: warehouseData, error: warehouseError } = await supabase
        .from("inventory")
        .select("id, name, unit")
        .eq("project_id", projectId)
        .order("name");

      if (warehouseError) throw warehouseError;
      setWarehouseItems(warehouseData || []);
    } catch (error) {
      console.error("Error loading usage data:", error);
      toast({
        title: "Error",
        description: "Failed to load material usage data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { error } = await supabase.from("material_consumption").insert({
        project_id: projectId,
        material_name: formData.material_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        recorded_by: formData.recorded_by,
        date_used: formData.date_used,
        bom_scope_id: formData.bom_scope_id === "none" ? null : formData.bom_scope_id,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Material usage recorded",
      });

      setDialogOpen(false);
      setFormData({
        material_name: "",
        quantity: "",
        unit: "",
        recorded_by: "",
        date_used: new Date().toISOString().split("T")[0],
        bom_scope_id: "none",
        notes: "",
      });
      void loadData();
    } catch (error) {
      console.error("Error recording usage:", error);
      toast({
        title: "Error",
        description: "Failed to record material usage",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this usage record?")) return;

    try {
      const { error } = await supabase.from("material_consumption").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Usage record deleted",
      });
      void loadData();
    } catch (error) {
      console.error("Error deleting usage:", error);
      toast({
        title: "Error",
        description: "Failed to delete usage record",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <TrendingDown className="h-5 w-5" />
          Material Usage Log
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Log Usage
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Material Usage</DialogTitle>
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
                  <Label htmlFor="quantity">Quantity Used</Label>
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
                <Label htmlFor="bom_scope_id">Scope (Optional)</Label>
                <Select value={formData.bom_scope_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, bom_scope_id: value }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No Scope --</SelectItem>
                    {bomScopes.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>
                        {scope.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="date_used">Usage Date</Label>
                  <Input
                    id="date_used"
                    type="date"
                    value={formData.date_used}
                    onChange={(e) => setFormData((prev) => ({ ...prev, date_used: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="recorded_by">Recorded By</Label>
                  <Input
                    id="recorded_by"
                    value={formData.recorded_by}
                    onChange={(e) => setFormData((prev) => ({ ...prev, recorded_by: e.target.value }))}
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
                Log Usage
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading usage records...</div>
        ) : usageRecords.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No usage records yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Used By</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usageRecords.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{new Date(record.date_used).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{record.material_name}</TableCell>
                  <TableCell>
                    {record.quantity} {record.unit}
                  </TableCell>
                  <TableCell>{record.bom_scope_of_work?.name || "-"}</TableCell>
                  <TableCell>{record.recorded_by}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{record.notes || "-"}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="icon" onClick={() => void handleDelete(record.id)}>
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