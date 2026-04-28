import { useEffect, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  projectManpowerCatalogService,
  type ProjectManpowerCatalogItem,
  type ProjectManpowerUnit,
} from "@/services/projectManpowerCatalogService";

interface ProjectManpowerCatalogTabProps {
  projectId: string;
  onCatalogChanged?: (items: ProjectManpowerCatalogItem[]) => void;
}

interface CatalogFormState {
  positionName: string;
  standardRate: string;
  unit: ProjectManpowerUnit;
  description: string;
}

const EMPTY_FORM: CatalogFormState = {
  positionName: "",
  standardRate: "",
  unit: "day",
  description: "",
};

export function ProjectManpowerCatalogTab({
  projectId,
  onCatalogChanged,
}: ProjectManpowerCatalogTabProps) {
  const [items, setItems] = useState<ProjectManpowerCatalogItem[]>([]);
  const [form, setForm] = useState<CatalogFormState>(EMPTY_FORM);
  const [editingId, setEditingId] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadData() {
    if (!projectId) {
      setItems([]);
      onCatalogChanged?.([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const data = await projectManpowerCatalogService.listByProject(projectId);
      setItems(data);
      onCatalogChanged?.(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [projectId]);

  function resetForm() {
    setForm(EMPTY_FORM);
    setEditingId("");
  }

  async function handleSubmit() {
    if (!projectId || !form.positionName.trim() || Number(form.standardRate || 0) <= 0) {
      return;
    }

    try {
      setSaving(true);
      const payload = {
        projectId,
        positionName: form.positionName,
        standardRate: Number(form.standardRate || 0),
        unit: form.unit,
        description: form.description,
      };

      if (editingId) {
        await projectManpowerCatalogService.update(editingId, payload);
      } else {
        await projectManpowerCatalogService.create(payload);
      }

      resetForm();
      await loadData();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await projectManpowerCatalogService.remove(id);
    await loadData();
    if (editingId === id) {
      resetForm();
    }
  }

  function handleEdit(item: ProjectManpowerCatalogItem) {
    setEditingId(item.id);
    setForm({
      positionName: item.positionName,
      standardRate: String(item.standardRate),
      unit: item.unit,
      description: item.description,
    });
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">
            {editingId ? "Edit Position" : "Add Position"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Project-level manpower catalog used only by Project Manager. No HR dependency.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-xs">Position Name</Label>
            <Input
              value={form.positionName}
              onChange={(event) => setForm((current) => ({ ...current, positionName: event.target.value }))}
              placeholder="e.g. Mason"
              className="h-9"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2">
              <Label className="text-xs">Standard Rate</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.standardRate}
                onChange={(event) => setForm((current) => ({ ...current, standardRate: event.target.value }))}
                placeholder="0.00"
                className="h-9"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Unit</Label>
              <Select
                value={form.unit}
                onValueChange={(value) => setForm((current) => ({ ...current, unit: value as ProjectManpowerUnit }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Day</SelectItem>
                  <SelectItem value="hour">Hour</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              placeholder="Optional notes about this position"
              className="min-h-[100px]"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" onClick={() => void handleSubmit()} disabled={saving}>
              <Plus className="mr-2 h-4 w-4" />
              {editingId ? "Update Position" : "Add Position"}
            </Button>
            {editingId ? (
              <Button type="button" size="sm" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-1">
          <CardTitle className="text-base">Catalog Positions</CardTitle>
          <p className="text-sm text-muted-foreground">
            These positions feed the Team Composition dropdown and default rates.
          </p>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading manpower catalog...</p>
          ) : items.length === 0 ? (
            <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
              No positions yet. Add your first manpower item to start building teams.
            </div>
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 rounded-md border p-4 lg:flex-row lg:items-start lg:justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold text-foreground">{item.positionName}</p>
                      <Badge variant="outline">
                        AED {item.standardRate.toFixed(2)}/{item.unit === "hour" ? "hr" : "day"}
                      </Badge>
                    </div>
                    {item.description ? (
                      <p className="text-sm text-muted-foreground">{item.description}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">No description provided.</p>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <Button type="button" variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                      <Pencil className="h-4 w-4 text-primary" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void handleDelete(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}