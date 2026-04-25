import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import {
  manpowerRateCatalogService,
  type ManpowerRateCatalogItem,
  type ManpowerRateCategory,
  type ManpowerRateStatus,
} from "@/services/manpowerRateCatalogService";
import { useSettings } from "@/contexts/SettingsProvider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RateFormState {
  positionName: string;
  category: ManpowerRateCategory;
  dailyRate: string;
  overtimeRate: string;
  currency: string;
  effectiveDate: string;
  status: ManpowerRateStatus;
}

interface ManpowerRateCatalogTabProps {
  defaultCategory?: ManpowerRateCategory;
}

const today = new Date().toISOString().split("T")[0];

const categoryLabels: Record<ManpowerRateCategory, string> = {
  office: "Admin Staff",
  construction: "Construction Workers",
};

const emptyForm = (currency: string, category: ManpowerRateCategory = "construction"): RateFormState => ({
  positionName: "",
  category,
  dailyRate: "",
  overtimeRate: "",
  currency,
  effectiveDate: today,
  status: "active",
});

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.toLowerCase().includes("duplicate")) {
    return "Position names must be unique. Use a different position name.";
  }

  return "Failed to save manpower rate.";
}

export function ManpowerRateCatalogTab({ defaultCategory = "construction" }: ManpowerRateCatalogTabProps) {
  const { currency, isLocked } = useSettings();
  const { toast } = useToast();
  const [items, setItems] = useState<ManpowerRateCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ManpowerRateCatalogItem | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<ManpowerRateCategory>(defaultCategory);
  const [form, setForm] = useState<RateFormState>(() => emptyForm(currency, defaultCategory));
  const [canManage, setCanManage] = useState(false);

  const canEdit = useMemo(() => canManage && !isLocked, [canManage, isLocked]);
  const filteredItems = useMemo(
    () => items.filter((item) => item.category === categoryFilter),
    [categoryFilter, items]
  );
  const computedHourlyRate = useMemo(() => {
    const dailyRate = Number(form.dailyRate || 0);
    return Number((dailyRate / 8).toFixed(2));
  }, [form.dailyRate]);

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setCategoryFilter(defaultCategory);
  }, [defaultCategory]);

  useEffect(() => {
    if (!dialogOpen && !editingItem) {
      setForm(emptyForm(currency, categoryFilter));
    }
  }, [categoryFilter, currency, dialogOpen, editingItem]);

  useEffect(() => {
    if (!dialogOpen && !editingItem) {
      setForm(emptyForm(currency));
    }
  }, [currency, dialogOpen, editingItem]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [catalogItems, manageAccess] = await Promise.all([
        manpowerRateCatalogService.getAll(),
        manpowerRateCatalogService.canManage(),
      ]);
      setItems(catalogItems);
      setCanManage(manageAccess);
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to load manpower rate catalog.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingItem(null);
    setForm(emptyForm(currency, categoryFilter));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      const actionLabel = editingItem ? "updated" : "created";

      if (editingItem) {
        await manpowerRateCatalogService.update(editingItem.id, {
          positionName: form.positionName,
          category: form.category,
          dailyRate: Number(form.dailyRate || 0),
          hourlyRate: computedHourlyRate,
          overtimeRate: Number(form.overtimeRate || 0),
          currency: form.currency,
          effectiveDate: form.effectiveDate,
          status: form.status,
        });
      } else {
        await manpowerRateCatalogService.create({
          positionName: form.positionName,
          category: form.category,
          dailyRate: Number(form.dailyRate || 0),
          hourlyRate: computedHourlyRate,
          overtimeRate: Number(form.overtimeRate || 0),
          currency: form.currency,
          effectiveDate: form.effectiveDate,
          status: form.status,
        });
      }

      const refreshResult = await manpowerRateCatalogService.recalculateProjectLaborCostsFromCatalog();

      setDialogOpen(false);
      resetForm();
      await loadData();
      toast({
        title: "Success",
        description: `Manpower rate ${actionLabel} successfully. Refreshed ${refreshResult.updatedTaskCount} task labor baselines across ${refreshResult.recalculatedProjectCount} project(s).`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: getErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: ManpowerRateCatalogItem) => {
    setEditingItem(item);
    setForm({
      positionName: item.positionName,
      category: item.category,
      dailyRate: String(item.dailyRate),
      overtimeRate: String(item.overtimeRate),
      currency: item.currency,
      effectiveDate: item.effectiveDate || today,
      status: item.status,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = window.confirm("Delete this manpower rate?");
    if (!confirmed) {
      return;
    }

    try {
      await manpowerRateCatalogService.remove(id);
      const refreshResult = await manpowerRateCatalogService.recalculateProjectLaborCostsFromCatalog();
      await loadData();
      toast({
        title: "Success",
        description: `Manpower rate deleted successfully. Refreshed ${refreshResult.updatedTaskCount} task labor baselines across ${refreshResult.recalculatedProjectCount} project(s).`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to delete manpower rate.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Manpower Rate Catalog</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Master positions and rates used by Staff, Project Manager, S-Curve, and payroll workflows.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{canEdit ? "Admin editable" : "View only"}</Badge>
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
                <Button onClick={resetForm} disabled={!canEdit}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Rate
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader>
                  <DialogTitle>{editingItem ? "Edit Manpower Rate" : "Add Manpower Rate"}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2">
                      <Label htmlFor="positionName">Position Name</Label>
                      <Input
                        id="positionName"
                        value={form.positionName}
                        onChange={(event) => setForm((current) => ({ ...current, positionName: event.target.value }))}
                        placeholder="e.g. Mason"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="category">Category</Label>
                      <Select
                        value={form.category}
                        onValueChange={(value: ManpowerRateCategory) =>
                          setForm((current) => ({ ...current, category: value }))
                        }
                      >
                        <SelectTrigger id="category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="office">Admin Staff</SelectItem>
                          <SelectItem value="construction">Construction Worker</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select
                        value={form.status}
                        onValueChange={(value: ManpowerRateStatus) =>
                          setForm((current) => ({ ...current, status: value }))
                        }
                      >
                        <SelectTrigger id="status">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="dailyRate">Daily Rate ({form.currency})</Label>
                      <Input
                        id="dailyRate"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.dailyRate}
                        onChange={(event) => setForm((current) => ({ ...current, dailyRate: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="hourlyRate">Hourly Rate ({form.currency})</Label>
                      <Input id="hourlyRate" value={computedHourlyRate.toFixed(2)} readOnly className="bg-muted/40" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="overtimeRate">Overtime Rate ({form.currency})</Label>
                      <Input
                        id="overtimeRate"
                        type="number"
                        min="0"
                        step="0.01"
                        value={form.overtimeRate}
                        onChange={(event) => setForm((current) => ({ ...current, overtimeRate: event.target.value }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="currency">Currency</Label>
                      <Input
                        id="currency"
                        value={form.currency}
                        onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="effectiveDate">Effective Date</Label>
                      <Input
                        id="effectiveDate"
                        type="date"
                        value={form.effectiveDate}
                        onChange={(event) => setForm((current) => ({ ...current, effectiveDate: event.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                    Only active positions appear in the Staff tab. Position names are unique per company.
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                      Cancel
                    </Button>
                    <Button type="submit">{editingItem ? "Update" : "Save"}</Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="inline-flex w-full rounded-lg bg-muted p-1 sm:w-auto">
            <button
              type="button"
              onClick={() => setCategoryFilter("office")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                categoryFilter === "office" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Admin Staff
            </button>
            <button
              type="button"
              onClick={() => setCategoryFilter("construction")}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                categoryFilter === "construction" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Construction Workers
            </button>
          </div>
          <p className="text-sm text-muted-foreground">
            Showing {categoryLabels[categoryFilter]} rates.
          </p>
        </div>
      </CardHeader>
      <CardContent>
        {!canManage ? (
          <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Only the company admin can edit the manpower rate catalog.
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Position</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Daily</TableHead>
                <TableHead>Hourly</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead>Effective</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
                    No manpower rates added yet for {categoryLabels[categoryFilter].toLowerCase()}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div>
                        <p>{item.positionName}</p>
                        <p className="text-xs text-muted-foreground">
                          OT {item.currency} {item.overtimeRate.toFixed(2)}/hr
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.category === "office" ? "Admin Staff" : "Construction Worker"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.currency} {item.dailyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {item.currency} {item.hourlyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>{item.currency}</TableCell>
                    <TableCell>{item.effectiveDate ? new Date(item.effectiveDate).toLocaleDateString() : "-"}</TableCell>
                    <TableCell>
                      <Badge className={item.status === "active" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button type="button" variant="ghost" size="icon" disabled={!canEdit} onClick={() => handleEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" disabled={!canEdit} onClick={() => void handleDelete(item.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}