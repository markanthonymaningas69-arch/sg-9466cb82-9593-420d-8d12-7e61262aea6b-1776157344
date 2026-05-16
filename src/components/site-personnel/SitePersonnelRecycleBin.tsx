import { useState, useEffect } from "react";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { siteService, type SitePersonnelRecycleBinItem } from "@/services/siteService";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface SitePersonnelRecycleBinProps {
  projectId: string;
  onChange?: () => void;
}

export function SitePersonnelRecycleBin({ projectId, onChange }: SitePersonnelRecycleBinProps) {
  const { toast } = useToast();
  const [items, setItems] = useState<SitePersonnelRecycleBinItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [emptyingBin, setEmptyingBin] = useState(false);

  useEffect(() => {
    if (open) {
      void loadItems();
    }
  }, [open, projectId]);

  async function loadItems() {
    setLoading(true);
    try {
      const { data, error } = await siteService.getRecycleBinItems(projectId);
      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error("Error loading recycle bin:", error);
      toast({
        title: "Error",
        description: "Failed to load recycle bin items",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  function formatDate(dateString: string | null) {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function getSourceLabel(sourceTable: string) {
    const labels: Record<string, string> = {
      site_attendance: "Attendance",
      site_progress: "Progress",
    };
    return labels[sourceTable] || sourceTable;
  }

  async function handleRestore(item: SitePersonnelRecycleBinItem) {
    try {
      setLoading(true);
      const { error } = await siteService.restoreRecycleBinItem(item);
      if (error) throw error;

      toast({
        title: "Item Restored",
        description: "Item has been restored successfully",
      });

      await loadItems();
      onChange?.();
    } catch (error) {
      console.error("Error restoring item:", error);
      toast({
        title: "Error",
        description: "Failed to restore item",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePermanentDelete(item: SitePersonnelRecycleBinItem) {
    if (
      !confirm(
        "Permanently delete this item? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await siteService.permanentlyDeleteRecycleBinItem(item);
      if (error) throw error;

      toast({
        title: "Item Deleted",
        description: "Item has been permanently deleted",
      });

      await loadItems();
      onChange?.();
    } catch (error) {
      console.error("Error deleting item:", error);
      toast({
        title: "Error",
        description: "Failed to delete item permanently",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEmptyRecycleBin() {
    try {
      setEmptyingBin(true);
      
      const deletePromises = items.map((item) =>
        siteService.permanentlyDeleteRecycleBinItem(item)
      );
      
      const results = await Promise.all(deletePromises);
      const errorCount = results.filter((result) => result.error).length;

      if (errorCount > 0) {
        toast({
          title: "Partial Success",
          description: `${items.length - errorCount} items deleted, ${errorCount} failed`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Recycle Bin Emptied",
          description: `${items.length} items permanently deleted`,
        });
      }

      setEmptyDialogOpen(false);
      await loadItems();
      onChange?.();
    } catch (error) {
      console.error("Error emptying recycle bin:", error);
      toast({
        title: "Error",
        description: "Failed to empty recycle bin",
        variant: "destructive",
      });
    } finally {
      setEmptyingBin(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-8"
      >
        <Trash2 className="mr-2 h-4 w-4" />
        Recycle Bin
        {items.length > 0 && (
          <Badge variant="secondary" className="ml-2 h-5 px-1.5">
            {items.length}
          </Badge>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Site Personnel Recycle Bin</DialogTitle>
                <DialogDescription>
                  Restore or permanently delete items
                </DialogDescription>
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setEmptyDialogOpen(true)}
                disabled={items.length === 0 || loading}
                className="h-8"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Empty Recycle Bin
              </Button>
            </div>
          </DialogHeader>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Recycle bin is empty
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Details</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={`${item.sourceTable}-${item.id}`}>
                    <TableCell>
                      <Badge variant="outline">{getSourceLabel(item.sourceTable)}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(item.createdAt)}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      <span className="font-medium">{item.title}</span> &bull; {item.description}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(item.deletedAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRestore(item)}
                          disabled={loading}
                        >
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          Restore
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void handlePermanentDelete(item)}
                          disabled={loading}
                        >
                          <Trash2 className="mr-1 h-3.5 w-3.5" />
                          Delete
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Empty Recycle Bin?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will permanently delete all {items.length} items in the recycle bin and cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={emptyingBin}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void handleEmptyRecycleBin()}
              disabled={emptyingBin}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {emptyingBin ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Confirm Delete
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}