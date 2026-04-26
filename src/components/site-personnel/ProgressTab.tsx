import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { TrendingUp, Plus, Trash2, Filter } from "lucide-react";
import { CompactText } from "@/components/site-personnel/CompactText";

interface ProgressUpdate {
  id: string;
  bom_scope_id: string;
  update_date: string;
  percentage_completed: number;
  updated_by: string;
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

function getScopeName(update: ProgressUpdate) {
  return update.bom_scope_of_work?.name || "Unknown Scope";
}

function matchesCompletionFilter(percentage: number, filter: string) {
  if (filter === "all") {
    return true;
  }

  if (filter === "0-24") {
    return percentage >= 0 && percentage <= 24.99;
  }

  if (filter === "25-49") {
    return percentage >= 25 && percentage <= 49.99;
  }

  if (filter === "50-74") {
    return percentage >= 50 && percentage <= 74.99;
  }

  if (filter === "75-99") {
    return percentage >= 75 && percentage <= 99.99;
  }

  if (filter === "100") {
    return percentage === 100;
  }

  return true;
}

export function ProgressTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [bomScopes, setBomScopes] = useState<BOMScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bomId, setBomId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    scopeId: "all",
    completion: "all",
    dateFrom: "",
    dateTo: "",
  });

  const filteredProgressUpdates = useMemo(() => {
    return progressUpdates.filter((update) => {
      if (filters.scopeId !== "all" && update.bom_scope_id !== filters.scopeId) {
        return false;
      }

      if (!matchesCompletionFilter(update.percentage_completed, filters.completion)) {
        return false;
      }

      if (filters.dateFrom && update.update_date < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && update.update_date > filters.dateTo) {
        return false;
      }

      return true;
    });
  }, [filters, progressUpdates]);

  function clearFilters() {
    setFilters({
      scopeId: "all",
      completion: "all",
      dateFrom: "",
      dateTo: "",
    });
  }

  // Form state
  const [formData, setFormData] = useState({
    bom_scope_id: "",
    update_date: new Date().toISOString().split("T")[0],
    percentage_completed: "",
    notes: "",
  });

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      // Get BOM for project
      const { data: bomData } = await supabase
        .from("bill_of_materials")
        .select("id")
        .eq("project_id", projectId)
        .single();

      if (!bomData) {
        setLoading(false);
        return;
      }
      
      setBomId(bomData.id);

      // Load BOM scopes
      const { data: scopesData, error: scopesError } = await supabase
        .from("bom_scope_of_work")
        .select("id, name")
        .eq("bom_id", bomData.id)
        .order("order_number");

      if (scopesError) throw scopesError;
      setBomScopes(scopesData || []);

      if (scopesData && scopesData.length > 0) {
        const scopeIds = scopesData.map(s => s.id);
        
        // Load progress updates
        const { data: progressData, error: progressError } = await supabase
          .from("bom_progress_updates")
          .select(`
            *,
            bom_scope_of_work (name)
          `)
          .in("bom_scope_id", scopeIds)
          .order("update_date", { ascending: false });

        if (progressError) throw progressError;
        setProgressUpdates((progressData as any) || []);
      }

    } catch (error) {
      console.error("Error loading progress data:", error);
      toast({
        title: "Error",
        description: "Failed to load progress updates",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.bom_scope_id) {
      toast({ title: "Required", description: "Please select a scope", variant: "destructive" });
      return;
    }

    const percentage = Number(formData.percentage_completed);
    if (percentage < 0 || percentage > 100) {
      toast({
        title: "Invalid Input",
        description: "Progress percentage must be between 0 and 100",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase.from("bom_progress_updates").insert({
        bom_scope_id: formData.bom_scope_id,
        update_date: formData.update_date,
        percentage_completed: percentage,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Progress update recorded",
      });

      setDialogOpen(false);
      setFormData({
        bom_scope_id: "",
        update_date: new Date().toISOString().split("T")[0],
        percentage_completed: "",
        notes: "",
      });
      void loadData();
    } catch (error) {
      console.error("Error creating progress update:", error);
      toast({
        title: "Error",
        description: "Failed to record progress update",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this progress update?")) return;

    try {
      const { error } = await supabase.from("bom_progress_updates").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Progress update deleted",
      });
      void loadData();
    } catch (error) {
      console.error("Error deleting progress update:", error);
      toast({
        title: "Error",
        description: "Failed to delete progress update",
        variant: "destructive",
      });
    }
  }

  // Calculate latest progress per scope
  const latestProgressByScope = progressUpdates.reduce((acc, update) => {
    const scopeName = update.bom_scope_of_work?.name || update.bom_scope_id;
    const existing = acc[scopeName];
    if (!existing || new Date(update.update_date) > new Date(existing.update_date)) {
      acc[scopeName] = update;
    }
    return acc;
  }, {} as Record<string, ProgressUpdate>);

  return (
    <div className="space-y-6">
      {/* Progress Updates Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 py-3">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <TrendingUp className="h-4 w-4" />
            Accomplishments
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 px-2 text-xs">
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Update Progress
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Progress Update</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="bom_scope_id">Scope</Label>
                  <Select value={formData.bom_scope_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, bom_scope_id: value }))}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      {bomScopes.map((scope) => (
                        <SelectItem key={scope.id} value={scope.id}>
                          {scope.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="percentage_completed">Progress (%)</Label>
                  <Input
                    id="percentage_completed"
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={formData.percentage_completed}
                    onChange={(e) => setFormData((prev) => ({ ...prev, percentage_completed: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="update_date" className="text-[11px]">
                    Update Date
                  </Label>
                  <Input
                    id="update_date"
                    type="date"
                    className="h-8 text-xs"
                    value={formData.update_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, update_date: e.target.value }))}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    placeholder="Progress description, milestones, or observations..."
                    rows={3}
                  />
                </div>

                <Button type="submit" className="w-full">
                  Record Progress
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4 pt-0">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading progress updates...</div>
          ) : progressUpdates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No progress updates recorded yet</div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border bg-muted/20 p-2.5">
                <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">Progress History</p>
                    <p className="text-xs text-muted-foreground">
                      Review updates by scope, completion range, and date range.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 px-2 text-[11px]"
                      onClick={() => setFiltersOpen((current) => !current)}
                    >
                      <Filter className="mr-1.5 h-3.5 w-3.5" />
                      {filtersOpen ? "Hide filters" : "Filter"}
                    </Button>
                    {filtersOpen ? (
                      <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={clearFilters}>
                        Clear
                      </Button>
                    ) : null}
                  </div>
                </div>

                {filtersOpen ? (
                  <div className="mt-2.5 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label htmlFor="progress-history-scope" className="text-[11px]">
                        Scope
                      </Label>
                      <Select
                        value={filters.scopeId}
                        onValueChange={(value) => setFilters((current) => ({ ...current, scopeId: value }))}
                      >
                        <SelectTrigger id="progress-history-scope" className="h-8 text-xs">
                          <SelectValue placeholder="All scopes" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All scopes</SelectItem>
                          {bomScopes.map((scope) => (
                            <SelectItem key={scope.id} value={scope.id}>
                              {scope.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="progress-history-completion" className="text-[11px]">
                        Completion
                      </Label>
                      <Select
                        value={filters.completion}
                        onValueChange={(value) => setFilters((current) => ({ ...current, completion: value }))}
                      >
                        <SelectTrigger id="progress-history-completion" className="h-8 text-xs">
                          <SelectValue placeholder="All completion bands" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All completion bands</SelectItem>
                          <SelectItem value="0-24">0–24%</SelectItem>
                          <SelectItem value="25-49">25–49%</SelectItem>
                          <SelectItem value="50-74">50–74%</SelectItem>
                          <SelectItem value="75-99">75–99%</SelectItem>
                          <SelectItem value="100">100%</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="progress-history-date-from" className="text-[11px]">
                        Date From
                      </Label>
                      <Input
                        id="progress-history-date-from"
                        type="date"
                        className="h-8 text-xs"
                        value={filters.dateFrom}
                        onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="progress-history-date-to" className="text-[11px]">
                        Date To
                      </Label>
                      <Input
                        id="progress-history-date-to"
                        type="date"
                        className="h-8 text-xs"
                        value={filters.dateTo}
                        onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              {filteredProgressUpdates.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No progress updates match the current filters.
                </div>
              ) : (
                <div className="overflow-auto rounded-md border">
                  <Table className="min-w-[930px] table-fixed text-xs">
                    <TableHeader className="sticky top-0 z-10 bg-background">
                      <TableRow>
                        <TableHead className="h-8 w-[110px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Date</TableHead>
                        <TableHead className="h-8 w-[260px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Scope</TableHead>
                        <TableHead className="h-8 w-[180px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Progress</TableHead>
                        <TableHead className="h-8 w-[140px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Updated By</TableHead>
                        <TableHead className="h-8 w-[220px] whitespace-nowrap px-2 text-[11px] uppercase tracking-wide">Notes</TableHead>
                        <TableHead className="h-8 w-[80px] whitespace-nowrap px-2 text-right text-[11px] uppercase tracking-wide">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredProgressUpdates.map((update) => (
                        <TableRow key={update.id} className="border-b last:border-b-0">
                          <TableCell className="px-2 py-1.5 align-middle whitespace-nowrap">
                            {new Date(update.update_date).toLocaleDateString()}
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle">
                            <CompactText value={getScopeName(update)} className="max-w-[242px] font-medium text-foreground" />
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle">
                            <div className="flex items-center gap-2 whitespace-nowrap">
                              <div className="w-24">
                                <Progress value={update.percentage_completed} className="h-2" />
                              </div>
                              <span className="text-[11px] font-semibold tabular-nums">{update.percentage_completed}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle">
                            <CompactText value={update.updated_by || "—"} className="max-w-[122px]" />
                          </TableCell>
                          <TableCell className="px-2 py-1.5 align-middle text-muted-foreground">
                            <CompactText value={update.notes || "—"} className="max-w-[202px]" />
                          </TableCell>
                          <TableCell className="px-2 py-1.5 text-right align-middle">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => void handleDelete(update.id)}>
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}