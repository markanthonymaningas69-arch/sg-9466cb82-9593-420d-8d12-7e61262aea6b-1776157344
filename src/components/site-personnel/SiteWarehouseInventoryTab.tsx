import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ClipboardCheck, PackageSearch, Save, Warehouse as WarehouseIcon } from "lucide-react";
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

interface SiteWarehouseInventoryTabProps {
  projectId: string;
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
  const [filters, setFilters] = useState({
    material: "",
    scope: "all",
    status: "all",
    countState: "all",
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

  const scopeOptions = useMemo(() => {
    return Array.from(new Set(items.flatMap((item) => item.scopeNames))).sort((left, right) => left.localeCompare(right));
  }, [items]);

  const filteredItems = useMemo(() => {
    const materialQuery = filters.material.trim().toLowerCase();

    return items.filter((item) => {
      if (materialQuery && !item.name.toLowerCase().includes(materialQuery)) {
        return false;
      }

      if (filters.scope !== "all" && !item.scopeNames.includes(filters.scope)) {
        return false;
      }

      if (filters.status !== "all" && item.varianceStatus !== filters.status) {
        return false;
      }

      if (filters.countState === "counted" && item.recordedRemaining === null) {
        return false;
      }

      if (filters.countState === "uncounted" && item.recordedRemaining !== null) {
        return false;
      }

      return true;
    });
  }, [filters, items]);

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
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-2">
          <CardTitle className="flex items-center gap-2">
            <WarehouseIcon className="h-5 w-5" />
            Site Warehouse
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Linked from Site Purchase & Deliveries and Usage. Enter the actual remaining materials to see missing or excess quantities.
          </p>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading site warehouse balances...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-muted-foreground">
              <PackageSearch className="h-9 w-9" />
              <div>
                <p className="font-medium text-foreground">No linked material activity yet.</p>
                <p className="text-sm">Add Site Purchase records or Usage records to populate the warehouse ledger.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Warehouse History</p>
                    <p className="text-xs text-muted-foreground">
                      Filter the material ledger by material, scope, balance status, or counted state.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={clearFilters}
                  >
                    Clear filters
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="space-y-1">
                    <Label htmlFor="warehouse-history-material" className="text-[11px]">
                      Material
                    </Label>
                    <Input
                      id="warehouse-history-material"
                      className="h-8 text-xs"
                      value={filters.material}
                      onChange={(event) => setFilters((current) => ({ ...current, material: event.target.value }))}
                      placeholder="Search material"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="warehouse-history-scope" className="text-[11px]">
                      Scope
                    </Label>
                    <Select
                      value={filters.scope}
                      onValueChange={(value) => setFilters((current) => ({ ...current, scope: value }))}
                    >
                      <SelectTrigger id="warehouse-history-scope" className="h-8 text-xs">
                        <SelectValue placeholder="All scopes" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All scopes</SelectItem>
                        {scopeOptions.map((scopeName) => (
                          <SelectItem key={scopeName} value={scopeName}>
                            {scopeName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="warehouse-history-status" className="text-[11px]">
                      Balance Status
                    </Label>
                    <Select
                      value={filters.status}
                      onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
                    >
                      <SelectTrigger id="warehouse-history-status" className="h-8 text-xs">
                        <SelectValue placeholder="All statuses" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All statuses</SelectItem>
                        <SelectItem value="balanced">Balanced</SelectItem>
                        <SelectItem value="missing">Missing</SelectItem>
                        <SelectItem value="excess">Excess</SelectItem>
                        <SelectItem value="uncounted">Needs Count</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="warehouse-history-count-state" className="text-[11px]">
                      Count State
                    </Label>
                    <Select
                      value={filters.countState}
                      onValueChange={(value) => setFilters((current) => ({ ...current, countState: value }))}
                    >
                      <SelectTrigger id="warehouse-history-count-state" className="h-8 text-xs">
                        <SelectValue placeholder="All count states" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All count states</SelectItem>
                        <SelectItem value="counted">Counted</SelectItem>
                        <SelectItem value="uncounted">Uncounted</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{filteredSummary.materialCount} visible materials</span>
                  <span>{filteredSummary.counted} counted</span>
                  <span>{filteredSummary.issues} with variance</span>
                </div>
              </div>

              {filteredItems.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No warehouse materials match the current filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Material</TableHead>
                      <TableHead>Scope</TableHead>
                      <TableHead>Total Restock</TableHead>
                      <TableHead>Total Usage</TableHead>
                      <TableHead>Expected Remaining</TableHead>
                      <TableHead>Remaining Materials</TableHead>
                      <TableHead>Missing / Excess</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const badge = getStatusBadge(item.varianceStatus);

                      return (
                        <TableRow key={item.key}>
                          <TableCell className="font-medium">
                            <div className="space-y-1">
                              <div>{item.name}</div>
                              <div className="text-xs text-muted-foreground">{item.unit || "No unit"}</div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {item.scopeNames.length > 0 ? item.scopeNames.join(", ") : "—"}
                          </TableCell>
                          <TableCell>
                            {formatQuantity(item.totalRestock)} {item.unit}
                          </TableCell>
                          <TableCell>
                            {formatQuantity(item.totalUsage)} {item.unit}
                          </TableCell>
                          <TableCell>
                            {formatQuantity(item.expectedRemaining)} {item.unit}
                          </TableCell>
                          <TableCell>
                            <div className="flex min-w-[180px] items-center gap-2">
                              <Input
                                className="h-8 text-xs"
                                type="number"
                                min="0"
                                step="0.01"
                                value={remainingInputs[item.key] ?? ""}
                                onChange={(event) =>
                                  setRemainingInputs((current) => ({
                                    ...current,
                                    [item.key]: event.target.value,
                                  }))
                                }
                                placeholder="Enter remaining"
                              />
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs"
                                onClick={() => void handleSaveRemaining(item)}
                                disabled={savingKey === item.key}
                              >
                                <Save className="mr-1 h-3.5 w-3.5" />
                                Save
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            {item.missingExcess === null ? (
                              <span className="text-xs text-muted-foreground">Awaiting remaining input</span>
                            ) : item.missingExcess === 0 ? (
                              <span className="inline-flex items-center gap-1 text-emerald-700">
                                <ClipboardCheck className="h-3.5 w-3.5" />
                                0 {item.unit}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5" />
                                {formatQuantity(item.missingExcess)} {item.unit}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={badge.className}>
                              {badge.label}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}