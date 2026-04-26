import { useState, useEffect } from "react";
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
import { TrendingUp, Plus, Trash2 } from "lucide-react";

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

export function ProgressTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [bomScopes, setBomScopes] = useState<BOMScope[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bomId, setBomId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    bom_scope_id: "",
    update_date: new Date().toISOString().split("T")[0],
    percentage_completed: "",
    updated_by: "",
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
        updated_by: formData.updated_by,
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
        updated_by: "",
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
      {/* Summary Cards */}
      {Object.keys(latestProgressByScope).length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Object.entries(latestProgressByScope).map(([scopeName, update]) => (
            <Card key={update.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">{scopeName}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold">{update.percentage_completed}%</span>
                  </div>
                  <Progress value={update.percentage_completed} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    Updated {new Date(update.update_date).toLocaleDateString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Progress Updates Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Progress Updates History
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="update_date">Update Date</Label>
                    <Input
                      id="update_date"
                      type="date"
                      value={formData.update_date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, update_date: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="updated_by">Updated By</Label>
                    <Input
                      id="updated_by"
                      value={formData.updated_by}
                      onChange={(e) => setFormData((prev) => ({ ...prev, updated_by: e.target.value }))}
                      required
                    />
                  </div>
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
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading progress updates...</div>
          ) : progressUpdates.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No progress updates recorded yet</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Updated By</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {progressUpdates.map((update) => (
                  <TableRow key={update.id}>
                    <TableCell>{new Date(update.update_date).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium">{update.bom_scope_of_work?.name || "Unknown Scope"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-24">
                          <Progress value={update.percentage_completed} className="h-2" />
                        </div>
                        <span className="text-sm font-medium">{update.percentage_completed}%</span>
                      </div>
                    </TableCell>
                    <TableCell>{update.updated_by}</TableCell>
                    <TableCell className="max-w-[250px] truncate text-sm text-muted-foreground">{update.notes || "-"}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => void handleDelete(update.id)}>
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
    </div>
  );
}