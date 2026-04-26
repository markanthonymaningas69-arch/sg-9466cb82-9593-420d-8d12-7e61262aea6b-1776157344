import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { siteService } from "@/services/siteService";

type TransactionType = "site_purchase" | "delivery";
const OTHER_MATERIAL_OPTION = "__others__";

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
  receipt_number: string | null;
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
  bom_scope_id: string;
  item_name: string;
  quantity: string;
  unit: string;
  unit_cost: string;
  supplier: string;
  delivery_date: string;
  receipt_number: string;
  notes: string;
  custom_item_name: string;
}

function getTodayDate() {
  return new Date().toISOString().split("T")[0];
}

const defaultFormState: FormState = {
  bom_scope_id: "",
  item_name: "",
  quantity: "",
  unit: "",
  unit_cost: "",
  supplier: "",
  delivery_date: getTodayDate(),
  receipt_number: "",
  notes: "",
  custom_item_name: "",
};

function getScopeName(record: DeliveryRecord) {
  if (Array.isArray(record.bom_scope_of_work)) {
    return record.bom_scope_of_work[0]?.name || "—";
  }

  return record.bom_scope_of_work?.name || "—";
}

function formatCurrency(value: number | null) {
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
  const [isOtherMaterial, setIsOtherMaterial] = useState(false);

  const amount = useMemo(() => {
    const quantity = Number(formData.quantity || 0);
    const unitCost = Number(formData.unit_cost || 0);
    return quantity * unitCost;
  }, [formData.quantity, formData.unit_cost]);

  const filteredMaterials = useMemo(() => {
    if (!formData.bom_scope_id) {
      return [];
    }

    return materials.filter((material) => material.scope_id === formData.bom_scope_id);
  }, [formData.bom_scope_id, materials]);

  const selectedMaterialValue = useMemo(() => {
    if (isOtherMaterial) {
      return OTHER_MATERIAL_OPTION;
    }

    return formData.item_name;
  }, [formData.item_name, isOtherMaterial]);

  const availableUnits = useMemo(() => {
    if (!formData.bom_scope_id) {
      return [];
    }

    if (isOtherMaterial) {
      return Array.from(new Set(filteredMaterials.map((material) => material.unit).filter(Boolean)));
    }

    const selectedMaterial = filteredMaterials.find((material) => material.name === formData.item_name);

    if (selectedMaterial?.unit) {
      return [selectedMaterial.unit];
    }

    return Array.from(new Set(filteredMaterials.map((material) => material.unit).filter(Boolean)));
  }, [filteredMaterials, formData.bom_scope_id, formData.item_name, isOtherMaterial]);

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

      if (deliveriesResult.error) {
        throw deliveriesResult.error;
      }

      if (scopesResult.error) {
        throw scopesResult.error;
      }

      if (materialsResult.error) {
        throw materialsResult.error;
      }

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
      delivery_date: getTodayDate(),
    });
    setIsOtherMaterial(false);
  }

  function handleScopeChange(scopeId: string) {
    setFormData((prev) => ({
      ...prev,
      bom_scope_id: scopeId,
      item_name: "",
      custom_item_name: "",
      unit: "",
    }));
    setIsOtherMaterial(false);
  }

  function handleMaterialChange(materialName: string) {
    if (materialName === OTHER_MATERIAL_OPTION) {
      setIsOtherMaterial(true);
      setFormData((prev) => ({
        ...prev,
        item_name: "",
        custom_item_name: "",
        unit: "",
      }));
      return;
    }

    const selectedMaterial = filteredMaterials.find((material) => material.name === materialName);
    setIsOtherMaterial(false);

    setFormData((prev) => ({
      ...prev,
      item_name: materialName,
      custom_item_name: "",
      unit: selectedMaterial?.unit || "",
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
        receipt_number: formData.receipt_number || null,
      });

      toast({
        title: "Success",
        description: "Site purchase recorded successfully",
      });

      setDialogOpen(false);
      resetForm();
      await loadData();
    } catch (error) {
      console.error("Error creating site purchase record:", error);
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

      if (error) {
        throw error;
      }

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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader className="space-y-1">
              <DialogTitle>Record Site Purchase</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="scope">Select Scope</Label>
                <Select value={formData.bom_scope_id} onValueChange={handleScopeChange}>
                  <SelectTrigger id="scope" className="h-9">
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

              <div className="space-y-1.5">
                <Label htmlFor="material">Select Material</Label>
                <Select value={selectedMaterialValue} onValueChange={handleMaterialChange} disabled={!formData.bom_scope_id}>
                  <SelectTrigger id="material" className="h-9">
                    <SelectValue placeholder={formData.bom_scope_id ? "Select material" : "Select scope first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMaterials.map((material) => (
                      <SelectItem key={material.id} value={material.name}>
                        {material.name}
                      </SelectItem>
                    ))}
                    <SelectItem value={OTHER_MATERIAL_OPTION}>Others</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedMaterialValue === OTHER_MATERIAL_OPTION ? (
                <div className="space-y-1.5">
                  <Label htmlFor="custom_material">Other Material</Label>
                  <Input
                    id="custom_material"
                    className="h-9"
                    value={formData.custom_item_name}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        custom_item_name: event.target.value,
                        item_name: event.target.value,
                      }))
                    }
                    placeholder="Enter material name"
                    required
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-9"
                    value={formData.quantity}
                    onChange={(event) => setFormData((prev) => ({ ...prev, quantity: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="unit">Unit</Label>
                  {isOtherMaterial ? (
                    <Input
                      id="unit"
                      className="h-9"
                      value={formData.unit}
                      onChange={(event) => setFormData((prev) => ({ ...prev, unit: event.target.value }))}
                      placeholder="Enter unit"
                      required
                    />
                  ) : (
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, unit: value }))}
                      disabled={!formData.bom_scope_id || availableUnits.length === 0}
                    >
                      <SelectTrigger id="unit" className="h-9">
                        <SelectValue
                          placeholder={
                            !formData.bom_scope_id
                              ? "Select scope first"
                              : availableUnits.length === 0
                                ? "No BOM units available"
                                : "Select unit"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUnits.map((unitOption) => (
                          <SelectItem key={unitOption} value={unitOption}>
                            {unitOption}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="unit_cost">Unit Cost</Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-9"
                    value={formData.unit_cost}
                    onChange={(event) => setFormData((prev) => ({ ...prev, unit_cost: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amount">Amount</Label>
                  <Input id="amount" className="h-9" value={amount ? formatCurrency(amount) : "0.00"} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="supplier">Supplier</Label>
                  <Input
                    id="supplier"
                    className="h-9"
                    value={formData.supplier}
                    onChange={(event) => setFormData((prev) => ({ ...prev, supplier: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="receipt_number">Receipt Number</Label>
                  <Input
                    id="receipt_number"
                    className="h-9"
                    value={formData.receipt_number}
                    onChange={(event) => setFormData((prev) => ({ ...prev, receipt_number: event.target.value }))}
                    placeholder="Enter receipt number"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="delivery_date">Purchase Date</Label>
                <Input
                  id="delivery_date"
                  type="date"
                  className="h-9"
                  value={formData.delivery_date}
                  onChange={(event) => setFormData((prev) => ({ ...prev, delivery_date: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  rows={2}
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>

              <Button type="submit" className="h-9 w-full">
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
                <TableHead>Receipt No.</TableHead>
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
                  <TableCell>{record.receipt_number || "—"}</TableCell>
                  <TableCell>{getScopeName(record)}</TableCell>
                  <TableCell className="font-medium">{record.item_name}</TableCell>
                  <TableCell>
                    {record.quantity || 0} {record.unit || ""}
                  </TableCell>
                  <TableCell>{record.supplier || "—"}</TableCell>
                  <TableCell>{formatCurrency(record.transaction_type === "site_purchase" ? record.amount : null)}</TableCell>
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