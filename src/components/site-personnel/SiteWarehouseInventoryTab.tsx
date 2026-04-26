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

  const totals = useMemo(() => {
    return {
      materialCount: items.length,
      counted: items.filter((item) => item.recordedRemaining !== null).length,
      issues: items.filter((item) => item.varianceStatus === "missing" || item.varianceStatus === "excess").length,
      needsCount: items.filter((item) => item.varianceStatus === "uncounted").length,
    };
  }, [items]);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Tracked Materials</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.materialCount}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Counted Remaining</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.counted}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Missing / Excess</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.issues}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Need Remaining Input</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{totals.needsCount}</CardContent>
        </Card>
      </div>

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
                {items.map((item) => {
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
        </CardContent>
      </Card>
    </div>
  );
}