import { useState, useEffect } from "react";
import { Trash2, RotateCcw, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsProvider";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface DeletedPurchase {
  id: string;
  order_number: string;
  order_date: string;
  supplier: string;
  item_name: string;
  quantity: number;
  unit: string;
  total_cost: number;
  deleted_at: string;
}

interface PurchasingRecycleBinProps {
  onChange?: () => void;
}

export function PurchasingRecycleBin({ onChange }: PurchasingRecycleBinProps) {
  const { toast } = useToast();
  const { formatCurrency } = useSettings();
  const [items, setItems] = useState<DeletedPurchase[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [emptyingBin, setEmptyingBin] = useState(false);

  useEffect(() => {
    if (open) {
      void loadItems();
    }
  }, [open]);

  async function loadItems() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select("*")
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false });

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

  async function handleRestore(id: string) {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("purchases")
        .update({ is_deleted: false, deleted_at: null })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Purchase Restored",
        description: "Purchase order has been restored successfully",
      });

      await loadItems();
      onChange?.();
    } catch (error) {
      console.error("Error restoring purchase:", error);
      toast({
        title: "Error",
        description: "Failed to restore purchase order",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm("Permanently delete this purchase order? This action cannot be undone.")) {
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from("purchases")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Purchase Deleted",
        description: "Purchase order has been permanently deleted",
      });

      await loadItems();
      onChange?.();
    } catch (error) {
      console.error("Error deleting purchase:", error);
      toast({
        title: "Error",
        description: "Failed to delete purchase order permanently",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleEmptyRecycleBin() {
    try {
      setEmptyingBin(true);
      
      const { error } = await supabase
        .from("purchases")
        .delete()
        .eq("is_deleted", true);

      if (error) throw error;

      toast({
        title: "Recycle Bin Emptied",
        description: `${items.length} purchase orders permanently deleted`,
      });

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
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle>Purchasing Recycle Bin</DialogTitle>
                <DialogDescription>
                  Restore or permanently delete purchase orders
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
                  <TableHead>Order #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                  <TableHead>Deleted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.order_number}</TableCell>
                    <TableCell>{formatDate(item.order_date)}</TableCell>
                    <TableCell>{item.supplier}</TableCell>
                    <TableCell className="max-w-xs truncate">{item.item_name}</TableCell>
                    <TableCell className="text-right">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(item.total_cost)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(item.deleted_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleRestore(item.id)}
                          disabled={loading}
                        >
                          <RotateCcw className="mr-1 h-3.5 w-3.5" />
                          Restore
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => void handlePermanentDelete(item.id)}
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
              This action will permanently delete all {items.length} purchase orders in the recycle bin and cannot be undone.
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