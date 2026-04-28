import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { siteService, type SitePersonnelRecycleBinItem } from "@/services/siteService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface SitePersonnelRecycleBinProps {
  projectId: string;
  onChange?: () => void;
}

export function SitePersonnelRecycleBin({ projectId, onChange }: SitePersonnelRecycleBinProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<SitePersonnelRecycleBinItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [workingId, setWorkingId] = useState<string | null>(null);

  useEffect(() => {
    void loadItems();
  }, [projectId]);

  async function loadItems() {
    try {
      setLoading(true);
      const { data, error } = await siteService.getRecycleBinItems(projectId);

      if (error) {
        throw error;
      }

      setItems(data || []);
    } catch (error) {
      console.error("Error loading recycle bin items:", error);
      toast({
        title: "Error",
        description: "Failed to load recycle bin items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  const filteredItems = useMemo(() => {
    if (sourceFilter === "all") {
      return items;
    }

    return items.filter((item) => item.sourceTable === sourceFilter);
  }, [items, sourceFilter]);

  async function handleRestore(item: SitePersonnelRecycleBinItem) {
    try {
      setWorkingId(item.id);
      const { error } = await siteService.restoreRecycleBinItem(item);

      if (error) {
        throw error;
      }

      toast({
        title: "Restored",
        description: `${item.recordType} restored to ${item.sourceTab}`,
      });
      await loadItems();
      onChange?.();
    } catch (error) {
      console.error("Error restoring recycle bin item:", error);
      toast({
        title: "Error",
        description: "Failed to restore record",
        variant: "destructive",
      });
    } finally {
      setWorkingId(null);
    }
  }

  async function handlePermanentDelete(item: SitePersonnelRecycleBinItem) {
    if (!confirm(`Permanently delete this ${item.recordType.toLowerCase()}? This cannot be undone.`)) {
      return;
    }

    try {
      setWorkingId(item.id);
      const { error } = await siteService.permanentlyDeleteRecycleBinItem(item);

      if (error) {
        throw error;
      }

      toast({
        title: "Deleted",
        description: `${item.recordType} permanently deleted`,
      });
      await loadItems();
      onChange?.();
    } catch (error) {
      console.error("Error permanently deleting recycle bin item:", error);
      toast({
        title: "Error",
        description: "Failed to permanently delete record",
        variant: "destructive",
      });
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 px-4 py-3">
        <div>
          <CardTitle className="text-sm sm:text-base">Recycle Bin</CardTitle>
          <p className="mt-1 text-xs text-muted-foreground">
            Restore archived Site Personnel records or permanently remove them.
          </p>
        </div>

        <div className="w-full max-w-[220px]">
          <Select value={sourceFilter} onValueChange={setSourceFilter}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Filter by tab" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tabs</SelectItem>
              <SelectItem value="deliveries">Deliveries</SelectItem>
              <SelectItem value="material_consumption">Usage</SelectItem>
              <SelectItem value="site_attendance">Attendance</SelectItem>
              <SelectItem value="bom_progress_updates">Accomplishments</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 pt-0">
        {loading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Loading recycle bin...</div>
        ) : filteredItems.length === 0 ? (
          <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
            No deleted records found for this project.
          </div>
        ) : (
          <div className="overflow-auto rounded-md border">
            <Table className="min-w-[980px] table-fixed text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[140px]">Source Tab</TableHead>
                  <TableHead className="w-[160px]">Record Type</TableHead>
                  <TableHead className="w-[240px]">Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-[170px]">Deleted At</TableHead>
                  <TableHead className="w-[160px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => {
                  const isWorking = workingId === item.id;

                  return (
                    <TableRow key={`${item.sourceTable}-${item.id}`}>
                      <TableCell>
                        <Badge variant="outline">{item.sourceTab}</Badge>
                      </TableCell>
                      <TableCell>{item.recordType}</TableCell>
                      <TableCell className="font-medium text-foreground">{item.title}</TableCell>
                      <TableCell className="text-muted-foreground">{item.description}</TableCell>
                      <TableCell>{item.deletedAt ? new Date(item.deletedAt).toLocaleString() : "—"}</TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={isWorking}
                            onClick={() => void handleRestore(item)}
                          >
                            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                            Restore
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            className="h-8 text-xs"
                            disabled={isWorking}
                            onClick={() => void handlePermanentDelete(item)}
                          >
                            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}