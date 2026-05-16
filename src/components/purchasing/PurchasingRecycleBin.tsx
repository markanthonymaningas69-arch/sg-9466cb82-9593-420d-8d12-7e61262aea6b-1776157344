import { useState, useEffect } from "react";
import { Trash2, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface DeletedPurchaseItem {
  id: string;
  order_number: string;
  item_name: string;
  supplier: string;
  quantity: number;
  unit: string;
  total_cost: number;
  deleted_at: string;
  order_date: string;
}

interface PurchasingRecycleBinProps {
  onChange?: () => void;
}

export function PurchasingRecycleBin({ onChange }: PurchasingRecycleBinProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<DeletedPurchaseItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      void loadDeletedItems();
    }
  }, [open]);

  async function loadDeletedItems() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("purchases")
        .select("id, order_number, item_name, supplier, quantity, unit, total_cost, order_date, deleted_at")
        .eq("is_deleted", true)
        .order("deleted_at", { ascending: false });

      if (error) throw error;

      setItems((data || []) as DeletedPurchaseItem[]);
    } catch (error) {
      console.error("Error loading deleted purchases:", error);
      toast({
        title: "Error",
        description: "Failed to load deleted purchases",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleRestore(item: DeletedPurchaseItem) {
    if (!confirm(`Restore "${item.item_name}" from recycle bin?`)) return;

    try {
      const { error } = await supabase
        .from("purchases")
        .update({ is_deleted: false, deleted_at: null })
        .eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Purchase Restored",
        description: `"${item.item_name}" has been restored successfully.`,
      });

      await loadDeletedItems();
      onChange?.();
    } catch (error) {
      console.error("Error restoring purchase:", error);
      toast({
        title: "Error",
        description: "Failed to restore purchase",
        variant: "destructive",
      });
    }
  }

  async function handlePermanentDelete(item: DeletedPurchaseItem) {
    if (!confirm(`PERMANENTLY DELETE "${item.item_name}"? This cannot be undone.`)) return;

    try {
      await supabase
        .from("approval_requests")
        .delete()
        .eq("source_table", "purchases")
        .eq("source_record_id", item.id);

      const { error } = await supabase.from("purchases").delete().eq("id", item.id);

      if (error) throw error;

      toast({
        title: "Purchase Deleted",
        description: `"${item.item_name}" has been permanently deleted.`,
      });

      await loadDeletedItems();
      onChange?.();
    } catch (error) {
      console.error("Error permanently deleting purchase:", error);
      toast({
        title: "Error",
        description: "Failed to permanently delete purchase",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
          <Trash2 className="h-3.5 w-3.5 mr-1.5" />
          Recycle Bin
          {items.length > 0 && (
            <Badge variant="secondary" className="ml-2 h-4 px-1 text-[10px]">
              {items.length}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 py-4 border-b shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-muted-foreground" />
            Purchasing Recycle Bin
          </DialogTitle>
          <DialogDescription>
            Deleted purchase orders. Items can be restored or permanently deleted.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-auto flex-1 px-6 py-4">
          {loading ? (
            <p className="text-sm text-muted-foreground text-center py-8">Loading deleted purchases...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Recycle bin is empty</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">PO Number</TableHead>
                  <TableHead className="text-xs">Item</TableHead>
                  <TableHead className="text-xs">Supplier</TableHead>
                  <TableHead className="text-xs text-right">Quantity</TableHead>
                  <TableHead className="text-xs text-right">Total Cost</TableHead>
                  <TableHead className="text-xs">Deleted</TableHead>
                  <TableHead className="text-xs text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="text-sm font-medium">{item.order_number}</TableCell>
                    <TableCell className="text-sm">{item.item_name}</TableCell>
                    <TableCell className="text-sm">{item.supplier || "—"}</TableCell>
                    <TableCell className="text-sm text-right">
                      {item.quantity} {item.unit}
                    </TableCell>
                    <TableCell className="text-sm text-right font-medium">
                      AED {(item.total_cost || 0).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(item.deleted_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => void handleRestore(item)}
                          title="Restore"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => void handlePermanentDelete(item)}
                          title="Permanently Delete"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}