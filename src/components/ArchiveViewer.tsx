import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { RotateCcw, Trash2, ArchiveRestore } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

export function ArchiveViewer({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState({
    projects: [],
    personnel: [],
    visas: [],
    inventory: [],
    purchases: [],
    requests: [],
    cash_advances: [],
    leave_requests: [],
    deliveries: [],
    consumptions: []
  });

  useEffect(() => {
    if (open) loadData();
  }, [open]);

  const loadData = async () => {
    setLoading(true);
    const [
      { data: prData },
      { data: pData },
      { data: vData },
      { data: iData },
      { data: puData },
      { data: reqData },
      { data: caData },
      { data: lrData },
      { data: delData },
      { data: consData }
    ] = await Promise.all([
      supabase.from('projects').select('*').eq('is_archived', true),
      supabase.from('personnel').select('*').eq('is_archived', true),
      supabase.from('personnel_visas').select('*, personnel(name)').eq('is_archived', true),
      supabase.from('inventory').select('*').eq('is_archived', true),
      supabase.from('purchases').select('*').eq('is_archived', true),
      supabase.from('site_requests').select('*').eq('is_archived', true),
      supabase.from('cash_advance_requests').select('*, personnel(name)').eq('is_archived', true),
      supabase.from('leave_requests').select('*, personnel(name)').eq('is_archived', true),
      supabase.from('deliveries').select('*').eq('is_archived', true),
      supabase.from('material_consumption').select('*').eq('is_archived', true)
    ]);

    setData({
      projects: prData || [],
      personnel: pData || [],
      visas: vData || [],
      inventory: iData || [],
      purchases: puData || [],
      requests: reqData || [],
      cash_advances: caData || [],
      leave_requests: lrData || [],
      deliveries: delData || [],
      consumptions: consData || []
    });
    setLoading(false);
  };

  const handleRestore = async (table: string, id: string) => {
    if (!confirm("Are you sure you want to restore this record to the active system?")) return;
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

  const renderTable = (table: string, items: any[], columns: { key: string, label: string, format?: (item: any) => any }[]) => (
    <div className="overflow-y-auto max-h-[500px] border rounded-md relative mt-4">
      <Table>
        <TableHeader className="sticky top-0 bg-background z-10">
          <TableRow>
            {columns.map(c => <TableHead key={c.key}>{c.label}</TableHead>)}
            <TableHead className="text-right w-[150px]">Vault Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.length === 0 ? (
            <TableRow><TableCell colSpan={columns.length + 1} className="text-center py-8 text-muted-foreground">No archived records found in this category.</TableCell></TableRow>
          ) : (
            items.map(item => (
              <TableRow key={item.id}>
                {columns.map(c => <TableCell key={c.key}>{c.format ? c.format(item) : item[c.key] || '-'}</TableCell>)}
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button size="sm" variant="outline" className="h-8 border-green-200 text-green-700 hover:bg-green-50" onClick={() => handleRestore(table, item.id)} title="Restore to Active">
                      <RotateCcw className="h-3.5 w-3.5 mr-1" /> Restore
                    </Button>
                    <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50" onClick={() => handlePermanentDelete(table, item.id)} title="Permanently Delete">
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete
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
      <DialogContent className="max-w-[90vw] w-full max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <ArchiveRestore className="h-6 w-6 text-orange-600" />
            GM Vault: Archived Records
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            View all archived files across the company. You have exclusive rights to restore them or permanently erase them.
          </p>
        </DialogHeader>
        
        <Tabs defaultValue="projects" className="mt-4 flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b pb-3">
            <TabsList className="grid h-auto w-full grid-cols-2 gap-1 bg-muted/60 p-1 sm:grid-cols-3 lg:grid-cols-5">
              <TabsTrigger value="projects" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Projects
              </TabsTrigger>
              <TabsTrigger value="personnel" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Personnel
              </TabsTrigger>
              <TabsTrigger value="visas" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Visas & Passports
              </TabsTrigger>
              <TabsTrigger value="requests" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Site Requests
              </TabsTrigger>
              <TabsTrigger value="cash_advances" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Cash Advances
              </TabsTrigger>
              <TabsTrigger value="leave_requests" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Leave Requests
              </TabsTrigger>
              <TabsTrigger value="inventory" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Warehouse
              </TabsTrigger>
              <TabsTrigger value="purchases" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Purchasing
              </TabsTrigger>
              <TabsTrigger value="deliveries" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Deliveries
              </TabsTrigger>
              <TabsTrigger value="consumptions" className="h-auto px-2 py-2 text-[11px] leading-tight sm:text-xs">
                Material Consumption
              </TabsTrigger>
            </TabsList>
          </div>

          <div className="flex-1 overflow-hidden">
            <TabsContent value="projects" className="h-full mt-0">
              {renderTable('projects', data.projects, [{ key: 'name', label: 'Project Name' }, { key: 'status', label: 'Status' }, { key: 'location', label: 'Location' }])}
            </TabsContent>
            <TabsContent value="personnel" className="h-full mt-0">
              {renderTable('personnel', data.personnel, [{ key: 'name', label: 'Name' }, { key: 'role', label: 'Position' }, { key: 'status', label: 'Status' }])}
            </TabsContent>
            <TabsContent value="visas" className="h-full mt-0">
              {renderTable('personnel_visas', data.visas, [{ key: 'personnel', label: 'Name', format: (i) => i.personnel?.name }, { key: 'country', label: 'Country' }, { key: 'visa_number', label: 'Visa No.' }])}
            </TabsContent>
            <TabsContent value="requests" className="h-full mt-0">
              {renderTable('site_requests', data.requests, [{ key: 'form_number', label: 'Form No.' }, { key: 'request_type', label: 'Type' }, { key: 'item_name', label: 'Item' }, { key: 'requested_by', label: 'Requested By' }])}
            </TabsContent>
            <TabsContent value="cash_advances" className="h-full mt-0">
              {renderTable('cash_advance_requests', data.cash_advances, [{ key: 'form_number', label: 'Form No.' }, { key: 'personnel', label: 'Name', format: (i) => i.personnel?.name }, { key: 'amount', label: 'Amount', format: (i) => i.amount?.toLocaleString() }])}
            </TabsContent>
            <TabsContent value="leave_requests" className="h-full mt-0">
              {renderTable('leave_requests', data.leave_requests, [{ key: 'personnel', label: 'Name', format: (i) => i.personnel?.name }, { key: 'leave_type', label: 'Type' }, { key: 'start_date', label: 'Start Date' }])}
            </TabsContent>
            <TabsContent value="inventory" className="h-full mt-0">
              {renderTable('inventory', data.inventory, [{ key: 'name', label: 'Item Name' }, { key: 'quantity', label: 'Quantity' }, { key: 'category', label: 'Category' }])}
            </TabsContent>
            <TabsContent value="purchases" className="h-full mt-0">
              {renderTable('purchases', data.purchases, [{ key: 'order_number', label: 'PO Number' }, { key: 'item_name', label: 'Item' }, { key: 'supplier', label: 'Supplier' }])}
            </TabsContent>
            <TabsContent value="deliveries" className="h-full mt-0">
              {renderTable('deliveries', data.deliveries, [{ key: 'delivery_date', label: 'Date' }, { key: 'item_name', label: 'Item' }, { key: 'quantity', label: 'Qty' }, { key: 'received_by', label: 'Received By' }])}
            </TabsContent>
            <TabsContent value="consumptions" className="h-full mt-0">
              {renderTable('material_consumption', data.consumptions, [{ key: 'date_used', label: 'Date' }, { key: 'recorded_by', label: 'Recorded By' }, { key: 'notes', label: 'Notes' }])}
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}