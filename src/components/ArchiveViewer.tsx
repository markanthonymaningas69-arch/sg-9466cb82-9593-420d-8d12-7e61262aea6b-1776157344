import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2, ArchiveRestore } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function ArchiveViewer({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    personnel: [],
    inventory: [],
    projects: [],
    purchases: [],
    requests: []
  });

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [
      { data: pData },
      { data: iData },
      { data: prData },
      { data: puData },
      { data: reqData }
    ] = await Promise.all([
      supabase.from('personnel').select('*').eq('is_archived', true),
      supabase.from('inventory').select('*').eq('is_archived', true),
      supabase.from('projects').select('*').eq('is_archived', true),
      supabase.from('purchases').select('*').eq('is_archived', true),
      supabase.from('site_requests').select('*').eq('is_archived', true)
    ]);

    setData({
      personnel: pData || [],
      inventory: iData || [],
      projects: prData || [],
      purchases: puData || [],
      requests: reqData || []
    });
    setLoading(false);
  };

  const handleRestore = async (table: string, id: string) => {
    const { error } = await supabase.from(table as any).update({ is_archived: false }).eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Restored", description: "Record has been successfully restored to the active system." });
      loadData();
    }
  };

  const handlePermanentDelete = async (table: string, id: string) => {
    if (!confirm("WARNING: This will permanently delete the record from the database and it cannot be recovered. Are you absolutely sure?")) return;
    const { error } = await supabase.from(table as any).delete().eq('id', id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "Record has been permanently erased." });
      loadData();
    }
  };

  const renderTable = (table: string, items: any[], columns: { key: string, label: string, format?: (v: any) => any }[]) => (
    <div className="overflow-y-auto max-h-[500px] border rounded-md relative mt-4">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            {columns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
            <TableHead className="text-right w-32">Actions (GM)</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow><TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">No archived records found.</TableCell></TableRow>
          ) : (
            items.map(item => (
              <TableRow key={item.id}>
                {columns.map(c => <TableCell key={c.key}>{c.format ? c.format(item[c.key]) : item[c.key] || '-'}</TableCell>)}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:bg-green-50" onClick={() => handleRestore(table, item.id)} title="Restore to Active">
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => handlePermanentDelete(table, item.id)} title="Permanently Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ArchiveRestore className="h-6 w-6 text-orange-600" />
            GM Vault: Archived Files
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="projects" className="w-full mt-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="personnel">Personnel</TabsTrigger>
            <TabsTrigger value="inventory">Warehouse</TabsTrigger>
            <TabsTrigger value="purchases">Purchasing</TabsTrigger>
            <TabsTrigger value="requests">Site Requests</TabsTrigger>
          </TabsList>
          
          <TabsContent value="projects">
            {renderTable('projects', data.projects, [{ key: 'name', label: 'Project Name' }, { key: 'status', label: 'Status' }, { key: 'location', label: 'Location' }])}
          </TabsContent>
          <TabsContent value="personnel">
            {renderTable('personnel', data.personnel, [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Position' }, { key: 'status', label: 'Status' }])}
          </TabsContent>
          <TabsContent value="inventory">
            {renderTable('inventory', data.inventory, [{ key: 'name', label: 'Item Name' }, { key: 'quantity', label: 'Quantity' }, { key: 'category', label: 'Category' }])}
          </TabsContent>
          <TabsContent value="purchases">
            {renderTable('purchases', data.purchases, [{ key: 'order_number', label: 'PO Number' }, { key: 'item_name', label: 'Item' }, { key: 'supplier', label: 'Supplier' }])}
          </TabsContent>
          <TabsContent value="requests">
            {renderTable('site_requests', data.requests, [{ key: 'form_number', label: 'Form No.' }, { key: 'request_type', label: 'Type' }, { key: 'item_name', label: 'Item' }, { key: 'requested_by', label: 'Requested By' }])}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}