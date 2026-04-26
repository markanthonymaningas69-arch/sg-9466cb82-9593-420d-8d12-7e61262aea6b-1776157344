import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2, TrendingDown, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";

interface MaterialUsage {
  id: string;
  project_id: string;
  bom_scope_id?: string | null;
  item_name: string;
  quantity: number;
  unit: string;
  date_used: string;
  notes?: string | null;
  created_at: string;
  bom_scope_of_work?: {
    name: string;
  } | null;
}

interface BOMScope {
  id: string;
  name: string;
}

interface BOMMaterial {
  id: string;
  material_name: string;
  unit: string;
  scope_id: string;
}

interface MaterialUsageFormData {
  bom_scope_id: string;
  item_name: string;
  quantity: string;
  unit: string;
  date_used: string;
  notes: string;
}

function getDefaultFormData(): MaterialUsageFormData {
  return {
    bom_scope_id: "none",
    item_name: "",
    quantity: "",
    unit: "",
    date_used: new Date().toISOString().split("T")[0],
    notes: "",
  };
}

function getScopeLabel(record: MaterialUsage) {
  return record.bom_scope_of_work?.name || "Unscoped";
}

export function MaterialUsageTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [usageRecords, setUsageRecords] = useState<MaterialUsage[]>([]);
  const [bomScopes, setBomScopes] = useState<BOMScope[]>([]);
  const [bomMaterials, setBomMaterials] = useState<BOMMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState<MaterialUsageFormData>(getDefaultFormData);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    scopeId: "all",
    material: "",
    unit: "all",
    dateFrom: "",
    dateTo: "",
  });

  const filteredMaterials = useMemo(() => {
    if (formData.bom_scope_id === "none") {
      return bomMaterials;
    }

    return bomMaterials.filter((material) => material.scope_id === formData.bom_scope_id);
  }, [bomMaterials, formData.bom_scope_id]);

  const unitOptions = useMemo(() => {
    return Array.from(new Set(usageRecords.map((record) => record.unit).filter(Boolean))).sort((left, right) =>
      left.localeCompare(right)
    );
  }, [usageRecords]);

  const hasUnscopedRecords = useMemo(() => {
    return usageRecords.some((record) => !record.bom_scope_id);
  }, [usageRecords]);

  const filteredUsageRecords = useMemo(() => {
    const materialQuery = filters.material.trim().toLowerCase();

    return usageRecords.filter((record) => {
      if (filters.scopeId === "unscoped" && record.bom_scope_id) {
        return false;
      }

      if (filters.scopeId !== "all" && filters.scopeId !== "unscoped" && record.bom_scope_id !== filters.scopeId) {
        return false;
      }

      if (materialQuery && !record.item_name.toLowerCase().includes(materialQuery)) {
        return false;
      }

      if (filters.unit !== "all" && record.unit !== filters.unit) {
        return false;
      }

      if (filters.dateFrom && record.date_used < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && record.date_used > filters.dateTo) {
        return false;
      }

      return true;
    });
  }, [filters, usageRecords]);

  const historySummary = useMemo(() => {
    const scopeCount = new Set(filteredUsageRecords.map((record) => getScopeLabel(record))).size;
    const totalQuantity = filteredUsageRecords.reduce((sum, record) => sum + Number(record.quantity || 0), 0);

    return {
      recordCount: filteredUsageRecords.length,
      scopeCount,
      totalQuantity,
    };
  }, [filteredUsageRecords]);

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      const { data: usageData, error: usageError } = await supabase
        .from("material_consumption")
        .select(`
          id,
          project_id,
          bom_scope_id,
          item_name,
          quantity,
          unit,
          date_used,
          notes,
          created_at,
          bom_scope_of_work (name)
        `)
        .eq("project_id", projectId)
        .order("date_used", { ascending: false });

      if (usageError) {
        throw usageError;
      }

      setUsageRecords((usageData as MaterialUsage[]) || []);

      const { data: bomData } = await supabase
        .from("bill_of_materials")
        .select("id")
        .eq("project_id", projectId)
        .maybeSingle();

      if (!bomData?.id) {
        setBomScopes([]);
        setBomMaterials([]);
        return;
      }

      const { data: scopesData, error: scopesError } = await supabase
        .from("bom_scope_of_work")
        .select("id, name")
        .eq("bom_id", bomData.id)
        .order("order_number");

      if (scopesError) {
        throw scopesError;
      }

      const scopes = scopesData || [];
      setBomScopes(scopes);

      if (scopes.length === 0) {
        setBomMaterials([]);
        return;
      }

      const scopeIds = scopes.map((scope) => scope.id);

      const { data: materialsData, error: materialsError } = await supabase
        .from("bom_materials")
        .select("id, material_name, unit, scope_id")
        .in("scope_id", scopeIds)
        .order("material_name");

      if (materialsError) {
        throw materialsError;
      }

      setBomMaterials(materialsData || []);
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

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    try {
      const { error } = await supabase.from("material_consumption").insert({
        project_id: projectId,
        bom_scope_id: formData.bom_scope_id === "none" ? null : formData.bom_scope_id,
        item_name: formData.item_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        date_used: formData.date_used,
        notes: formData.notes || null,
        recorded_by: "Site Personnel",
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Material usage recorded",
      });

      setDialogOpen(false);
      setFormData(getDefaultFormData());
      await loadData();
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
    if (!confirm("Delete this usage record?")) {
      return;
    }

    try {
      const { error } = await supabase.from("material_consumption").delete().eq("id", id);

      if (error) {
        throw error;
      }

      toast({
        title: "Success",
        description: "Usage record deleted",
      });

      await loadData();
    } catch (error) {
      console.error("Error deleting usage:", error);
      toast({
        title: "Error",
        description: "Failed to delete usage record",
        variant: "destructive",
      });
    }
  }

  function handleScopeChange(value: string) {
    const nextMaterials = value === "none" ? bomMaterials : bomMaterials.filter((material) => material.scope_id === value);
    const selectedMaterial = nextMaterials.find((material) => material.material_name === formData.item_name);

    setFormData((prev) => ({
      ...prev,
      bom_scope_id: value,
      item_name: selectedMaterial ? prev.item_name : "",
      unit: selectedMaterial ? selectedMaterial.unit || prev.unit : "",
    }));
  }

  function handleMaterialChange(value: string) {
    const selectedMaterial = filteredMaterials.find((material) => material.material_name === value);

    setFormData((prev) => ({
      ...prev,
      item_name: value,
      unit: selectedMaterial?.unit || "",
    }));
  }

  function clearFilters() {
    setFilters({
      scopeId: "all",
      material: "",
      unit: "all",
      dateFrom: "",
      dateTo: "",
    });
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
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
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Log Material Usage</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="bom_scope_id">Scope of Works</Label>
                <Select value={formData.bom_scope_id} onValueChange={handleScopeChange}>
                  <SelectTrigger id="bom_scope_id">
                    <SelectValue placeholder="Select scope of works" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No scope selected</SelectItem>
                    {bomScopes.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>
                        {scope.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="item_name">Material Name</Label>
                <Select value={formData.item_name} onValueChange={handleMaterialChange} disabled={filteredMaterials.length === 0}>
                  <SelectTrigger id="item_name">
                    <SelectValue
                      placeholder={
                        formData.bom_scope_id === "none"
                          ? "Select scope to narrow materials"
                          : filteredMaterials.length === 0
                            ? "No materials for this scope"
                            : "Select material"
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredMaterials.map((item) => (
                      <SelectItem key={item.id} value={item.material_name}>
                        {item.material_name}
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

              <div>
                <Label htmlFor="date_used">Usage Date</Label>
                <Input
                  id="date_used"
                  type="date"
                  value={formData.date_used}
                  onChange={(event) => setFormData((prev) => ({ ...prev, date_used: event.target.value }))}
                  required
                />
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(event) => setFormData((prev) => ({ ...prev, notes: event.target.value }))}
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
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Usage History</p>
                  <p className="text-xs text-muted-foreground">
                    Review saved usage records by scope, material, unit, and date range.
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
                    <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                      Clear filters
                    </Button>
                  ) : null}
                </div>
              </div>

              {filtersOpen ? (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                  <div className="space-y-1">
                    <Label htmlFor="usage-history-material" className="text-[11px]">
                      Material
                    </Label>
                    <Input
                      id="usage-history-material"
                      className="h-8 text-xs"
                      value={filters.material}
                      onChange={(event) => setFilters((current) => ({ ...current, material: event.target.value }))}
                      placeholder="Search material"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="usage-history-scope" className="text-[11px]">
                      Scope
                    </Label>
                    <Select
                      value={filters.scopeId}
                      onValueChange={(value) => setFilters((current) => ({ ...current, scopeId: value }))}
                    >
                      <SelectTrigger id="usage-history-scope" className="h-8 text-xs">
                        <SelectValue placeholder="All scopes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All scopes</SelectItem>
                        {hasUnscopedRecords ? <SelectItem value="unscoped">Unscoped</SelectItem> : null}
                        {bomScopes.map((scope) => (
                          <SelectItem key={scope.id} value={scope.id}>
                            {scope.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="usage-history-unit" className="text-[11px]">
                      Unit
                    </Label>
                    <Select value={filters.unit} onValueChange={(value) => setFilters((current) => ({ ...current, unit: value }))}>
                      <SelectTrigger id="usage-history-unit" className="h-8 text-xs">
                        <SelectValue placeholder="All units" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All units</SelectItem>
                        {unitOptions.map((unit) => (
                          <SelectItem key={unit} value={unit}>
                            {unit}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="usage-history-date-from" className="text-[11px]">
                      Date From
                    </Label>
                    <Input
                      id="usage-history-date-from"
                      type="date"
                      className="h-8 text-xs"
                      value={filters.dateFrom}
                      onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="usage-history-date-to" className="text-[11px]">
                      Date To
                    </Label>
                    <Input
                      id="usage-history-date-to"
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
                <span>{historySummary.scopeCount} scopes</span>
                <span>Total quantity used: {historySummary.totalQuantity}</span>
              </div>
            </div>

            {filteredUsageRecords.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No usage records match the current filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usage Date</TableHead>
                    <TableHead>Scope of Works</TableHead>
                    <TableHead>Material Name</TableHead>
                    <TableHead>Quantity Used</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsageRecords.map((record) => (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.date_used).toLocaleDateString()}</TableCell>
                      <TableCell>{getScopeLabel(record)}</TableCell>
                      <TableCell className="font-medium">{record.item_name}</TableCell>
                      <TableCell>{record.quantity}</TableCell>
                      <TableCell>{record.unit}</TableCell>
                      <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">{record.notes || "—"}</TableCell>
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}