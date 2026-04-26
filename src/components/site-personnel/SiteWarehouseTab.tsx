import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { siteService } from "@/services/siteService";
import { Package, Plus, Trash2 } from "lucide-react";

type TransactionType = "site_purchase" | "delivery";

interface DeliveryRecord {
  id: string;
  item_name: string;
  quantity: number | null;
  unit: string | null;
  supplier: string | null;
  delivery_date: string | null;
  notes: string | null;
  transaction_type: TransactionType | null;
  bom_scope_id: string | null;
  unit_cost: number | null;
  amount: number | null;
  bom_scope_of_work?: { name?: string | null } | Array<{ name?: string | null }> | null;
}

interface ScopeOption {
  id: string;
  name: string;
}

interface MaterialOption {
  id: string;
  name: string;
  unit: string;
  scope_id: string | null;
}

interface FormState {
  transaction_type: TransactionType;
  bom_scope_id: string;
  item_name: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  supplier: string;
  delivery_date: string;
  notes: string;
}

const defaultFormState: FormState = {
  transaction_type: "site_purchase",
  bom_scope_id: "",
  item_name: "",
  quantity: "",
  unit: "",
  unit_cost: "",
  supplier: "",
  delivery_date: new Date().toISOString().split("T")[0],
  notes: "",
};

function getScopeName(record: DeliveryRecord) {
  if (Array.isArray(record.bom_scope_of_work)) {
    return record.bom_scope_of_work[0]?.name || "—";
  }

  return record.bom_scope_of_work?.name || "—";
}

function formatAmount(value: number | null) {
  if (value === null || value === undefined) {
    return "Recorded in accounting";
  }

  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function SiteWarehouseTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormState>(defaultFormState);

  const amount = useMemo(() => {
    const quantity = Number(formData.quantity || 0);
    const unitCost = Number(formData.unit_cost || 0);
    return quantity * unitCost;
  }, [formData.quantity, formData.unit_cost]);

  const filteredMaterials = useMemo(() => {
    if (!formData.bom_scope_id) {
      return materials;
    }

    return materials.filter((material) => material.scope_id === formData.bom_scope_id);
  }, [formData.bom_scope_id, materials]);

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      const [deliveriesResult, scopesResult, materialsResult] = await Promise.all([
        siteService.getDeliveries(projectId),
        siteService.getScopeOfWorks(projectId),
        siteService.getBomMaterials(projectId),
      ]);

      if (deliveriesResult.error) throw deliveriesResult.error;
      if (scopesResult.error) throw scopesResult.error;
      if (materialsResult.error) throw materialsResult.error;

      setRecords((deliveriesResult.data || []) as DeliveryRecord[]);
      setScopes(
        (scopesResult.data || []).map((scope) => ({
          id: scope.id,
          name: scope.name || "Untitled scope",
        }))
      );
      setMaterials(
        (materialsResult.data || []).map((material) => ({
          id: material.id,
          name: material.name,
          unit: material.unit || "",
          scope_id: material.scope_id || null,
        }))
      );
    } catch (error) {
      console.error("Error loading purchase and delivery records:", error);
      toast({
        title: "Error",
        description: "Failed to load purchase and delivery data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setFormData({
      ...defaultFormState,
      delivery_date: new Date().toISOString().split("T")[0],
    });
  }

  function handleScopeChange(scopeId: string) {
    setFormData((prev) => ({
      ...prev,
      bom_scope_id: scopeId,
      item_name: "",
      unit: "",
    }));
  }

  function handleMaterialChange(materialName: string) {
    const selectedMaterial = materials.find((material) => material.name === materialName);

    setFormData((prev) => ({
      ...prev,
      item_name: materialName,
      unit: selectedMaterial?.unit || prev.unit,
      bom_scope_id: prev.bom_scope_id || selectedMaterial?.scope_id || "",
    }));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      await siteService.createDelivery({
        project_id: projectId,
        transaction_type: "site_purchase",
        bom_scope_id: formData.bom_scope_id || null,
        item_name: formData.item_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        supplier: formData.supplier,
        delivery_date: formData.delivery_date,
        received_by: null,
        notes: formData.notes || null,
        status: "pending",
        unit_cost: Number(formData.unit_cost || 0),
        amount,
      });

      toast({
        title: "Success",
        description: "Site purchase recorded successfully",
      });

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Error creating purchase or delivery record:", error);
      toast({
        title: "Error",
        description: "Failed to save the record",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this purchase or delivery record?")) {
      return;
    }

    try {
      const { error } = await siteService.deleteDelivery(id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Record deleted",
      });
      await loadData();
    } catch (error) {
      console.error("Error deleting record:", error);
      toast({
        title: "Error",
        description: "Failed to delete the record",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5" />
          Site Purchase & Deliveries
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Record
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>Record Site Purchase</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="scope">Select Scope</Label>
                <Select value={formData.bom_scope_id} onValueChange={handleScopeChange}>
                  <SelectTrigger id="scope">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    {scopes.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>
                        {scope.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="material">Select Material</Label>
                <Select value={formData.item_name} onValueChange={handleMaterialChange}>
                  <SelectTrigger id="material">
                    <SelectValue placeholder="Select material" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMaterials.map((material) => (
                      <SelectItem key={material.id} value={material.name}>
                        {material.name}
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
                    min="0"
                    value={formData.quantity}
                    onChange={(event) => setFormData((prev) => ({ ...prev, quantity: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(event) => setFormData((prev) => ({ ...prev, unit: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="unit_cost">Unit Cost</Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.unit_cost}
                    onChange={(event) => setFormData((prev) => ({ ...prev, unit_cost: event.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" value={amount ? formatAmount(amount) : "0.00"} readOnly />
                </div>
              </div>

              <div>
                <Label htmlFor="supplier">Supplier</Label>
                <Input
                  id="supplier"
                  value={formData.supplier}
                  onChange={(event) => setFormData((prev) => ({ ...prev, supplier: event.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="delivery_date">Purchase Date</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  value={formData.delivery_date}
                  onChange={(event) => setFormData((prev) => ({ ...prev, delivery_date: event.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full">
                Save Record
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading purchase and delivery records...</div>
        ) : records.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No purchase or delivery records yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Material</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[80px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {records.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>{record.delivery_date ? new Date(record.delivery_date).toLocaleDateString() : "—"}</TableCell>
                  <TableCell>{record.transaction_type === "site_purchase" ? "Site Purchase" : "Delivery"}</TableCell>
                  <TableCell>{getScopeName(record)}</TableCell>
                  <TableCell className="font-medium">{record.item_name}</TableCell>
                  <TableCell>
                    {record.quantity || 0} {record.unit || ""}
                  </TableCell>
                  <TableCell>{record.supplier || "—"}</TableCell>
                  <TableCell>{formatAmount(record.transaction_type === "site_purchase" ? record.amount : null)}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">{record.notes || "—"}</TableCell>
                  <TableCell className="text-right">
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