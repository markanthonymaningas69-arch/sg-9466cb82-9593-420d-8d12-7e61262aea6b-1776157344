import { useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { manpowerRateCatalogService, type ManpowerRateCatalogItem } from "@/services/manpowerRateCatalogService";
import { useSettings } from "@/contexts/SettingsProvider";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface RateFormState {
  positionName: string;
  dailyRate: string;
  overtimeRate: string;
}

const emptyForm: RateFormState = {
  positionName: "",
  dailyRate: "",
  overtimeRate: "",
};

export function ManpowerRateCatalogTab() {
  const { currency, isLocked } = useSettings();
  const { toast } = useToast();
  const [items, setItems] = useState<ManpowerRateCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ManpowerRateCatalogItem | null>(null);
  const [form, setForm] = useState<RateFormState>(emptyForm);
  const [canManage, setCanManage] = useState(false);

  const canEdit = useMemo(() => canManage && !isLocked, [canManage, isLocked]);

  useEffect(() => {
    void loadData();
  }, []);

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
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      if (editingItem) {
        await manpowerRateCatalogService.update(editingItem.id, {
          positionName: form.positionName,
          dailyRate: Number(form.dailyRate || 0),
          overtimeRate: Number(form.overtimeRate || 0),
        });
      } else {
        await manpowerRateCatalogService.create({
          positionName: form.positionName,
          dailyRate: Number(form.dailyRate || 0),
          overtimeRate: Number(form.overtimeRate || 0),
        });
      }

      setDialogOpen(false);
      resetForm();
      await loadData();
      toast({
        title: "Success",
        description: `Manpower rate ${editingItem ? "updated" : "created"} successfully.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to save manpower rate.",
        variant: "destructive",
      });
    }
  };

  const handleEdit = (item: ManpowerRateCatalogItem) => {
    setEditingItem(item);
    setForm({
      positionName: item.positionName,
      dailyRate: String(item.dailyRate),
      overtimeRate: String(item.overtimeRate),
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
      await loadData();
      toast({
        title: "Success",
        description: "Manpower rate deleted successfully.",
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
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle>Manpower Rate Catalog</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Master labor rates used by Project Manager for task-level labor costing.
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
              <Button
                onClick={resetForm}
                disabled={!canEdit}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Rate
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingItem ? "Edit Manpower Rate" : "Add Manpower Rate"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="positionName">Position Name</Label>
                  <Input
                    id="positionName"
                    value={form.positionName}
                    onChange={(event) => setForm((current) => ({ ...current, positionName: event.target.value }))}
                    placeholder="e.g. Mason"
                    required
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="dailyRate">Daily Rate ({currency})</Label>
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
                    <Label htmlFor="overtimeRate">Overtime Rate ({currency})</Label>
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
                <TableHead>Daily Rate</TableHead>
                <TableHead>Overtime Rate</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                    No manpower rates added yet.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.positionName}</TableCell>
                    <TableCell>
                      {currency} {item.dailyRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {currency} {item.overtimeRate.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell>
                      {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={!canEdit}
                          onClick={() => handleEdit(item)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          disabled={!canEdit}
                          onClick={() => void handleDelete(item.id)}
                        >
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