import { useEffect, useMemo, useState } from "react";
import { Package, Plus, Trash2, Filter, Eye } from "lucide-react";
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
import { requestWorkflowService } from "@/services/requestWorkflowService";
import { notificationService } from "@/services/notificationService";

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

interface PendingMaterialLine {
  bom_scope_id: string;
  item_name: string;
  quantity: string;
  unit: string;
  unit_cost: string;
}

interface ReceiptGroup {
  key: string;
  receiptNumber: string | null;
  transactionType: TransactionType | null;
  deliveryDate: string | null;
  supplier: string | null;
  notes: string | null;
  totalAmount: number;
  items: DeliveryRecord[];
}

interface ReadyForReceivingRecord {
  id: string;
  site_request_id: string;
  purchase_id: string | null;
  voucher_request_id: string | null;
  voucher_id: string | null;
  voucher_number: string | null;
  lifecycle_status: string;
  supplier: string | null;
  total_amount: number | null;
  actual_quantity: number | null;
  updated_at: string | null;
  received_at: string | null;
  remarks: string | null;
  initial_approval_request_id: string | null;
  site_requests?: { item_name?: string | null; quantity?: number | null; unit?: string | null; requested_by?: string | null } | Array<{ item_name?: string | null; quantity?: number | null; unit?: string | null; requested_by?: string | null }> | null;
  purchases?: { order_number?: string | null; item_name?: string | null } | Array<{ order_number?: string | null; item_name?: string | null }> | null;
  voucher_requests?: { description?: string | null; total_amount?: number | null } | Array<{ description?: string | null; total_amount?: number | null }> | null;
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

function getRelationItem<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] || null;
  }

  return value || null;
}

export function SiteWarehouseTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [records, setRecords] = useState<DeliveryRecord[]>([]);
  const [readyForReceiving, setReadyForReceiving] = useState<ReadyForReceivingRecord[]>([]);
  const [scopes, setScopes] = useState<ScopeOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<FormState>(defaultFormState);
  const [pendingLines, setPendingLines] = useState<PendingMaterialLine[]>([]);
  const [isOtherMaterial, setIsOtherMaterial] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedReceiptGroup, setSelectedReceiptGroup] = useState<ReceiptGroup | null>(null);
  const [selectedReadyRecord, setSelectedReadyRecord] = useState<ReadyForReceivingRecord | null>(null);
  const [receivingForm, setReceivingForm] = useState({
    receivedBy: "Site Personnel",
    actualQuantity: "",
    remarks: "",
  });
  const [savingReceipt, setSavingReceipt] = useState(false);

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

  const supplierOptions = useMemo(() => {
    return Array.from(
      new Set(
        records
          .map((record) => record.supplier?.trim())
          .filter((supplier): supplier is string => Boolean(supplier))
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [records]);

  const filteredRecords = useMemo(() => {
    const materialQuery = filters.material.trim().toLowerCase();
    const receiptQuery = filters.receipt.trim().toLowerCase();

    return records.filter((record) => {
      if (filters.scopeId !== "all" && record.bom_scope_id !== filters.scopeId) {
        return false;
      }

      if (filters.supplier !== "all" && (record.supplier || "").trim() !== filters.supplier) {
        return false;
      }

      if (materialQuery && !record.item_name.toLowerCase().includes(materialQuery)) {
        return false;
      }

      if (receiptQuery && !(record.receipt_number || "").toLowerCase().includes(receiptQuery)) {
        return false;
      }

      if (filters.dateFrom && (record.delivery_date || "") < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && (record.delivery_date || "") > filters.dateTo) {
        return false;
      }

      return true;
    });
  }, [filters, records]);

  const groupedReceipts = useMemo(() => {
    const groups = new Map<string, ReceiptGroup>();

    filteredRecords.forEach((record) => {
      const normalizedReceipt = record.receipt_number?.trim();
      const groupKey = normalizedReceipt ? `receipt-${normalizedReceipt.toLowerCase()}` : `record-${record.id}`;
      const existingGroup = groups.get(groupKey);

      if (existingGroup) {
        existingGroup.items.push(record);
        existingGroup.totalAmount += Number(record.amount || 0);

        if (!existingGroup.notes && record.notes) {
          existingGroup.notes = record.notes;
        }

        return;
      }

      groups.set(groupKey, {
        key: groupKey,
        receiptNumber: normalizedReceipt || null,
        transactionType: record.transaction_type,
        deliveryDate: record.delivery_date,
        supplier: record.supplier,
        notes: record.notes,
        totalAmount: Number(record.amount || 0),
        items: [record],
      });
    });

    return Array.from(groups.values());
  }, [filteredRecords]);

  const historySummary = useMemo(() => {
    const supplierCount = new Set(
      filteredRecords
        .map((record) => record.supplier?.trim())
        .filter((supplier): supplier is string => Boolean(supplier))
    ).size;

    const totalAmount = filteredRecords.reduce((sum, record) => sum + Number(record.amount || 0), 0);

    return {
      recordCount: filteredRecords.length,
      receiptCount: groupedReceipts.length,
      supplierCount,
      totalAmount,
    };
  }, [filteredRecords, groupedReceipts]);

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
      setReadyForReceiving((await requestWorkflowService.getReadyForReceiving(projectId)) as ReadyForReceivingRecord[]);
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
    setPendingLines([]);
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

  function clearFilters() {
    setFilters({
      scopeId: "all",
      supplier: "all",
      material: "",
      receipt: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  function buildLinePayload(line: PendingMaterialLine | FormState) {
    return {
      project_id: projectId,
      transaction_type: "site_purchase" as const,
      bom_scope_id: line.bom_scope_id || null,
      item_name: line.item_name,
      quantity: Number(line.quantity),
      unit: line.unit,
      supplier: formData.supplier,
      delivery_date: formData.delivery_date,
      received_by: null,
      notes: formData.notes || null,
      status: "pending",
      unit_cost: Number(line.unit_cost || 0),
      amount: Number(line.quantity || 0) * Number(line.unit_cost || 0),
      receipt_number: formData.receipt_number || null,
    };
  }

  function resetMaterialFields() {
    setFormData((prev) => ({
      ...prev,
      bom_scope_id: "",
      item_name: "",
      quantity: "",
      unit: "",
      unit_cost: "",
      custom_item_name: "",
    }));
    setIsOtherMaterial(false);
  }

  function addCurrentLine() {
    if (!formData.item_name || !formData.quantity || !formData.unit || !formData.unit_cost) {
      toast({
        title: "Incomplete material line",
        description: "Complete the current material details before adding another material",
        variant: "destructive",
      });
      return;
    }

    setPendingLines((current) => [
      ...current,
      {
        bom_scope_id: formData.bom_scope_id,
        item_name: formData.item_name,
        quantity: formData.quantity,
        unit: formData.unit,
        unit_cost: formData.unit_cost,
      },
    ]);
    resetMaterialFields();
  }

  function removePendingLine(index: number) {
    setPendingLines((current) => current.filter((_, lineIndex) => lineIndex !== index));
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const linesToSave = [...pendingLines];

      if (formData.item_name && formData.quantity && formData.unit && formData.unit_cost) {
        linesToSave.push({
          bom_scope_id: formData.bom_scope_id,
          item_name: formData.item_name,
          quantity: formData.quantity,
          unit: formData.unit,
          unit_cost: formData.unit_cost,
        });
      }

      if (linesToSave.length === 0) {
        toast({
          title: "No material lines",
          description: "Add at least one material for this receipt",
          variant: "destructive",
        });
        return;
      }

      const results = await Promise.all(linesToSave.map((line) => siteService.createDelivery(buildLinePayload(line))));
      const failedResult = results.find((result) => result.error);

      if (failedResult?.error) {
        throw failedResult.error;
      }

      toast({
        title: "Success",
        description:
          linesToSave.length === 1
            ? "Site purchase recorded successfully"
            : "Site purchase recorded successfully with multiple materials",
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

  async function handleDeleteGroup(group: ReceiptGroup) {
    const targetLabel = group.receiptNumber
      ? `receipt ${group.receiptNumber}`
      : group.items.length === 1
        ? "this purchase or delivery record"
        : "these purchase or delivery records";

    if (!confirm(`Delete ${targetLabel}?`)) {
      return;
    }

    try {
      const results = await Promise.all(group.items.map((item) => siteService.deleteDelivery(item.id)));
      const failedResult = results.find((result) => result.error);

      if (failedResult?.error) {
        throw failedResult.error;
      }

      if (selectedReceiptGroup?.key === group.key) {
        setSelectedReceiptGroup(null);
      }

      toast({
        title: "Success",
        description: group.items.length > 1 ? "Receipt records deleted" : "Record deleted",
      });
      await loadData();
    } catch (error) {
      console.error("Error deleting record group:", error);
      toast({
        title: "Error",
        description: "Failed to delete the record",
        variant: "destructive",
      });
    }
  }

  function openReceiveDialog(record: ReadyForReceivingRecord) {
    const linkedSiteRequest = getRelationItem(record.site_requests);

    setSelectedReadyRecord(record);
    setReceivingForm({
      receivedBy: linkedSiteRequest?.requested_by || "Site Personnel",
      actualQuantity: linkedSiteRequest?.quantity ? String(linkedSiteRequest.quantity) : "",
      remarks: "",
    });
    setReceivingDialogOpen(true);
  }

  async function handleMarkReceived() {
    if (!selectedReadyRecord) {
      return;
    }

    if (!selectedReadyRecord.voucher_number || selectedReadyRecord.lifecycle_status !== "ready_for_delivery" || selectedReadyRecord.received_at) {
      toast({
        title: "Receiving locked",
        description: "Only voucher-approved records that are ready for delivery can be marked as received.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSavingReceipt(true);
      const linkedSiteRequest = getRelationItem(selectedReadyRecord.site_requests);
      const itemLabel = linkedSiteRequest?.item_name || "Request item";

      await requestWorkflowService.markReceived({
        siteRequestId: selectedReadyRecord.site_request_id,
        deliveryId: selectedReadyRecord.purchase_id,
        receivedBy: receivingForm.receivedBy || "Site Personnel",
        actualQuantity: receivingForm.actualQuantity ? Number(receivingForm.actualQuantity) : null,
        remarks: receivingForm.remarks || null,
      });

      if (selectedReadyRecord.initial_approval_request_id) {
        await notificationService.createNotification({
          approvalRequestId: selectedReadyRecord.initial_approval_request_id,
          audienceModule: "Purchasing",
          targetSurface: "Purchasing",
          eventType: "request_received",
          title: "Delivery received on site",
          message: `${itemLabel} has been marked as received`,
          payload: {
            siteRequestId: selectedReadyRecord.site_request_id,
            purchaseId: selectedReadyRecord.purchase_id,
            voucherNumber: selectedReadyRecord.voucher_number,
          },
        });

        await notificationService.createNotification({
          approvalRequestId: selectedReadyRecord.initial_approval_request_id,
          audienceModule: "Accounting",
          targetSurface: "Accounting",
          eventType: "request_received",
          title: "Delivery received on site",
          message: `${itemLabel} has been marked as received`,
          payload: {
            siteRequestId: selectedReadyRecord.site_request_id,
            purchaseId: selectedReadyRecord.purchase_id,
            voucherNumber: selectedReadyRecord.voucher_number,
          },
        });
      }

      toast({
        title: "Received",
        description: "The delivery was confirmed successfully.",
      });

      setReceivingDialogOpen(false);
      setSelectedReadyRecord(null);
      await loadData();
    } catch (error) {
      console.error("Error marking request as received:", error);
      toast({
        title: "Error",
        description: "Failed to confirm receiving.",
        variant: "destructive",
      });
    } finally {
      setSavingReceipt(false);
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
          <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base">Record Site Purchase</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-2.5 pb-1">
              <div className="space-y-1">
                <Label htmlFor="scope" className="text-[11px]">
                  Select Scope
                </Label>
                <Select value={formData.bom_scope_id} onValueChange={handleScopeChange}>
                  <SelectTrigger id="scope" className="h-8 text-xs">
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

              <div className="space-y-1">
                <Label htmlFor="material" className="text-[11px]">
                  Select Material
                </Label>
                <Select value={selectedMaterialValue} onValueChange={handleMaterialChange} disabled={!formData.bom_scope_id}>
                  <SelectTrigger id="material" className="h-8 text-xs">
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
                <div className="space-y-1">
                  <Label htmlFor="custom_material" className="text-[11px]">
                    Other Material
                  </Label>
                  <Input
                    id="custom_material"
                    className="h-8 text-xs"
                    value={formData.custom_item_name}
                    onChange={(event) =>
                      setFormData((prev) => ({
                        ...prev,
                        custom_item_name: event.target.value,
                        item_name: event.target.value,
                      }))
                    }
                    placeholder="Enter material name"
                    required={pendingLines.length === 0}
                  />
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="quantity" className="text-[11px]">
                    Quantity
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-8 text-xs"
                    value={formData.quantity}
                    onChange={(event) => setFormData((prev) => ({ ...prev, quantity: event.target.value }))}
                    required={pendingLines.length === 0}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="unit" className="text-[11px]">
                    Unit
                  </Label>
                  {isOtherMaterial ? (
                    <Input
                      id="unit"
                      className="h-8 text-xs"
                      value={formData.unit}
                      onChange={(event) => setFormData((prev) => ({ ...prev, unit: event.target.value }))}
                      placeholder="Enter unit"
                      required={pendingLines.length === 0}
                    />
                  ) : (
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData((prev) => ({ ...prev, unit: value }))}
                      disabled={!formData.bom_scope_id || availableUnits.length === 0}
                    >
                      <SelectTrigger id="unit" className="h-8 text-xs">
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
                <div className="space-y-1">
                  <Label htmlFor="unit_cost" className="text-[11px]">
                    Unit Cost
                  </Label>
                  <Input
                    id="unit_cost"
                    type="number"
                    step="0.01"
                    min="0"
                    className="h-8 text-xs"
                    value={formData.unit_cost}
                    onChange={(event) => setFormData((prev) => ({ ...prev, unit_cost: event.target.value }))}
                    required={pendingLines.length === 0}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="amount" className="text-[11px]">
                    Amount
                  </Label>
                  <Input id="amount" className="h-8 text-xs" value={amount ? formatCurrency(amount) : "0.00"} readOnly />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="supplier" className="text-[11px]">
                    Supplier
                  </Label>
                  <Input
                    id="supplier"
                    className="h-8 text-xs"
                    value={formData.supplier}
                    onChange={(event) => setFormData((prev) => ({ ...prev, supplier: event.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="receipt_number" className="text-[11px]">
                    Receipt Number
                  </Label>
                  <Input
                    id="receipt_number"
                    className="h-8 text-xs"
                    value={formData.receipt_number}
                    onChange={(event) => setFormData((prev) => ({ ...prev, receipt_number: event.target.value }))}
                    placeholder="Enter receipt number"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="delivery_date" className="text-[11px]">
                  Purchase Date
                </Label>
                <Input
                  id="delivery_date"
                  type="date"
                  className="h-8 text-xs"
                  value={formData.delivery_date}
                  onChange={(event) => setFormData((prev) => ({ ...prev, delivery_date: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-[11px]">
                  Notes (Optional)
                </Label>
                <Textarea
                  id="notes"
                  rows={2}
                  className="min-h-[56px] text-xs"
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
                />
              </div>

              {pendingLines.length > 0 ? (
                <div className="space-y-2 rounded-md border border-dashed p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-foreground">Receipt materials</p>
                    <p className="text-[11px] text-muted-foreground">{pendingLines.length} added</p>
                  </div>
                  <div className="space-y-2">
                    {pendingLines.map((line, index) => (
                      <div key={[line.item_name, line.unit, index].join("-")} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2">
                        <div className="space-y-0.5 text-xs">
                          <p className="font-medium text-foreground">{line.item_name}</p>
                          <p className="text-muted-foreground">
                            {line.quantity} {line.unit} · {formatCurrency(Number(line.quantity || 0) * Number(line.unit_cost || 0))}
                          </p>
                        </div>
                        <Button type="button" variant="ghost" size="icon" className="h-7 w-7" onClick={() => removePendingLine(index)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="flex gap-2">
                <Button type="button" variant="outline" className="h-8 flex-1 text-xs" onClick={addCurrentLine}>
                  Add Material to Receipt
                </Button>
                <Button type="submit" className="h-8 flex-1 text-xs">
                  Save Record
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading purchase and delivery records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No purchase records match the current filters.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-emerald-50/40 p-3">
              <div className="space-y-1">
                <p className="text-sm font-medium text-foreground">Ready for Receiving</p>
                <p className="text-xs text-muted-foreground">
                  Voucher-approved records appear here when they are ready for delivery and release to site.
                </p>
              </div>

              {readyForReceiving.length === 0 ? (
                <div className="mt-3 rounded-md border border-dashed bg-background/70 py-6 text-center text-sm text-muted-foreground">
                  No voucher-approved records are ready for receiving.
                </div>
              ) : (
                <div className="mt-3 overflow-auto rounded-md border bg-background">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Voucher No.</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Last Update</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {readyForReceiving.map((record) => {
                        const linkedSiteRequest = getRelationItem(record.site_requests);
                        const isEligible = Boolean(record.voucher_number) && record.lifecycle_status === "ready_for_delivery" && !record.received_at;

                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{linkedSiteRequest?.item_name || "—"}</TableCell>
                            <TableCell>{record.supplier || "—"}</TableCell>
                            <TableCell>{record.voucher_number || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={record.received_at ? "default" : "secondary"}>
                                {record.received_at ? "received" : record.lifecycle_status.replaceAll("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {linkedSiteRequest?.quantity || 0} {linkedSiteRequest?.unit || ""}
                            </TableCell>
                            <TableCell>{record.updated_at ? new Date(record.updated_at).toLocaleString() : "—"}</TableCell>
                            <TableCell className="text-right">
                              {record.received_at ? (
                                <span className="text-xs text-muted-foreground">Received</span>
                              ) : (
                                <Button size="sm" disabled={!isEligible} onClick={() => openReceiveDialog(record)}>
                                  Mark as Received
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Purchase History</p>
                  <p className="text-xs text-muted-foreground">
                    Review saved site purchases by material, supplier, receipt number, scope, and date range.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => setFiltersOpen((current) => !current)}
                  >
                    <Filter className="mr-2 h-3.5 w-3.5" />
                    {filtersOpen ? "Hide filters" : "Filter"}
                  </Button>
                  {filtersOpen ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={clearFilters}
                    >
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              </div>

              {filtersOpen ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  <div className="space-y-1">
                    <Label htmlFor="history-material" className="text-[11px]">
                      Material
                    </Label>
                    <Input
                      id="history-material"
                      className="h-8 text-xs"
                      value={filters.material}
                      onChange={(event) => setFilters((current) => ({ ...current, material: event.target.value }))}
                      placeholder="Search material"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="history-scope" className="text-[11px]">
                      Scope
                    </Label>
                    <Select
                      value={filters.scopeId}
                      onValueChange={(value) => setFilters((current) => ({ ...current, scopeId: value }))}
                    >
                      <SelectTrigger id="history-scope" className="h-8 text-xs">
                        <SelectValue placeholder="All scopes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All scopes</SelectItem>
                        {scopes.map((scope) => (
                          <SelectItem key={scope.id} value={scope.id}>
                            {scope.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="history-supplier" className="text-[11px]">
                      Supplier
                    </Label>
                    <Select
                      value={filters.supplier}
                      onValueChange={(value) => setFilters((current) => ({ ...current, supplier: value }))}
                    >
                      <SelectTrigger id="history-supplier" className="h-8 text-xs">
                        <SelectValue placeholder="All suppliers" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All suppliers</SelectItem>
                        {supplierOptions.map((supplier) => (
                          <SelectItem key={supplier} value={supplier}>
                            {supplier}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="history-receipt" className="text-[11px]">
                      Receipt Number
                    </Label>
                    <Input
                      id="history-receipt"
                      className="h-8 text-xs"
                      value={filters.receipt}
                      onChange={(event) => setFilters((current) => ({ ...current, receipt: event.target.value }))}
                      placeholder="Search receipt"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="history-date-from" className="text-[11px]">
                      Date From
                    </Label>
                    <Input
                      id="history-date-from"
                      type="date"
                      className="h-8 text-xs"
                      value={filters.dateFrom}
                      onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="history-date-to" className="text-[11px]">
                      Date To
                    </Label>
                    <Input
                      id="history-date-to"
                      type="date"
                      className="h-8 text-xs"
                      value={filters.dateTo}
                      onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                    />
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{historySummary.recordCount} records</span>
                <span>{historySummary.receiptCount} receipts</span>
                <span>{historySummary.supplierCount} suppliers</span>
                <span>Total purchase value: {formatCurrency(historySummary.totalAmount)}</span>
              </div>
            </div>

            {groupedReceipts.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No purchase records match the current filters.
              </div>
            ) : (
              <>
                <div className="h-[420px] overflow-auto overscroll-contain rounded-md border text-xs [&_td]:py-2 [&_th]:py-2 [&_th]:text-[11px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Receipt No.</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Materials</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead className="w-[112px] text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupedReceipts.map((group) => (
                        <TableRow key={group.key}>
                          <TableCell>{group.deliveryDate ? new Date(group.deliveryDate).toLocaleDateString() : "—"}</TableCell>
                          <TableCell>{group.transactionType === "site_purchase" ? "Site Purchase" : "Delivery"}</TableCell>
                          <TableCell>{group.receiptNumber || "—"}</TableCell>
                          <TableCell>
                            {Array.from(
                              new Set(group.items.map((item) => getScopeName(item)).filter((scopeName) => scopeName !== "—"))
                            ).join(", ") || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="space-y-0.5">
                              <p className="font-medium">{group.items.length} material{group.items.length > 1 ? "s" : ""}</p>
                              <p className="max-w-[240px] truncate text-xs text-muted-foreground">
                                {group.items.map((item) => item.item_name).join(", ")}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>{group.supplier || "—"}</TableCell>
                          <TableCell>{formatCurrency(group.transactionType === "site_purchase" ? group.totalAmount : null)}</TableCell>
                          <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{group.notes || "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button type="button" variant="ghost" size="icon" onClick={() => setSelectedReceiptGroup(group)}>
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button type="button" variant="ghost" size="icon" onClick={() => void handleDeleteGroup(group)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <Dialog open={Boolean(selectedReceiptGroup)} onOpenChange={(open) => (!open ? setSelectedReceiptGroup(null) : null)}>
                  <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader className="space-y-1">
                      <DialogTitle className="text-base">
                        {selectedReceiptGroup?.receiptNumber ? `Receipt ${selectedReceiptGroup.receiptNumber}` : "Purchase details"}
                      </DialogTitle>
                    </DialogHeader>

                    {selectedReceiptGroup ? (
                      <div className="space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
                            <p className="text-muted-foreground">Date</p>
                            <p className="font-medium text-foreground">
                              {selectedReceiptGroup.deliveryDate ? new Date(selectedReceiptGroup.deliveryDate).toLocaleDateString() : "—"}
                            </p>
                          </div>
                          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
                            <p className="text-muted-foreground">Supplier</p>
                            <p className="font-medium text-foreground">{selectedReceiptGroup.supplier || "—"}</p>
                          </div>
                          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
                            <p className="text-muted-foreground">Type</p>
                            <p className="font-medium text-foreground">
                              {selectedReceiptGroup.transactionType === "site_purchase" ? "Site Purchase" : "Delivery"}
                            </p>
                          </div>
                          <div className="space-y-1 rounded-md border bg-muted/30 p-3 text-xs">
                            <p className="text-muted-foreground">Total Amount</p>
                            <p className="font-medium text-foreground">
                              {formatCurrency(
                                selectedReceiptGroup.transactionType === "site_purchase" ? selectedReceiptGroup.totalAmount : null
                              )}
                            </p>
                          </div>
                        </div>

                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Scope</TableHead>
                              <TableHead>Material</TableHead>
                              <TableHead>Quantity</TableHead>
                              <TableHead>Unit Cost</TableHead>
                              <TableHead>Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {selectedReceiptGroup.items.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell>{getScopeName(item)}</TableCell>
                                <TableCell className="font-medium">{item.item_name}</TableCell>
                                <TableCell>
                                  {item.quantity || 0} {item.unit || ""}
                                </TableCell>
                                <TableCell>{formatCurrency(item.unit_cost)}</TableCell>
                                <TableCell>{formatCurrency(item.amount)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        <div className="space-y-1 text-xs">
                          <p className="font-medium text-foreground">Notes</p>
                          <p className="rounded-md border bg-muted/20 p-3 text-muted-foreground">
                            {selectedReceiptGroup.notes || "—"}
                          </p>
                        </div>
                      </div>
                    ) : null}
                  </DialogContent>
                </Dialog>

                <Dialog open={receivingDialogOpen} onOpenChange={setReceivingDialogOpen}>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader className="space-y-1">
                      <DialogTitle className="text-base">Confirm Receiving</DialogTitle>
                    </DialogHeader>

                    {selectedReadyRecord ? (
                      <div className="space-y-4">
                        <div className="rounded-md border bg-muted/30 p-3 text-sm">
                          <p className="font-medium text-foreground">{getRelationItem(selectedReadyRecord.site_requests)?.item_name || "Request item"}</p>
                          <p className="text-xs text-muted-foreground">
                            Voucher {selectedReadyRecord.voucher_number || "—"} · {selectedReadyRecord.supplier || "No supplier"}
                          </p>
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="received-by">Received by</Label>
                          <Input
                            id="received-by"
                            value={receivingForm.receivedBy}
                            onChange={(event) => setReceivingForm((current) => ({ ...current, receivedBy: event.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="actual-quantity">Actual quantity received</Label>
                          <Input
                            id="actual-quantity"
                            type="number"
                            step="0.01"
                            value={receivingForm.actualQuantity}
                            onChange={(event) => setReceivingForm((current) => ({ ...current, actualQuantity: event.target.value }))}
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="receiving-remarks">Remarks</Label>
                          <Textarea
                            id="receiving-remarks"
                            rows={3}
                            value={receivingForm.remarks}
                            onChange={(event) => setReceivingForm((current) => ({ ...current, remarks: event.target.value }))}
                            placeholder="Optional remarks about the receiving confirmation"
                          />
                        </div>

                        <div className="flex justify-end gap-2">
                          <Button type="button" variant="outline" onClick={() => setReceivingDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button type="button" onClick={() => void handleMarkReceived()} disabled={savingReceipt}>
                            {savingReceipt ? "Saving..." : "Confirm Received"}
                          </Button>
                        </div>
                      </div>
                    ) : null}
                  </DialogContent>
                </Dialog>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}