import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useSettings } from "@/contexts/SettingsProvider";
import { accountingService } from "@/services/accountingService";
import { projectService } from "@/services/projectService";
import { Plus, ReceiptText, Printer, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function VouchersTab() {
  const { formatCurrency, company, currency } = useSettings();
  const { toast } = useToast();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState({
    type: "payment",
    voucher_number: `PV-${Math.floor(Math.random() * 10000)}`,
    date: new Date().toISOString().split("T")[0],
    amount: "",
    payee: "",
    particulars: "",
    project_id: "office"
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [vData, pData] = await Promise.all([
      accountingService.getVouchers(),
      projectService.getAll()
    ]);
    // Sort vouchers: drafts first, then by date descending
    const sortedVouchers = (vData.data || []).sort((a, b) => {
      if (a.status === 'draft' && b.status !== 'draft') return -1;
      if (a.status !== 'draft' && b.status === 'draft') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    setVouchers(sortedVouchers);
    setProjects(pData.data || []);
    setLoading(false);
  };

  const handleApproveDraft = async (id: string) => {
    const { error } = await supabase.from('vouchers').update({ status: 'issued' }).eq('id', id);
    if (!error) {
      toast({ title: "Voucher Issued", description: "The draft voucher has been officially issued." });
      loadData();
    } else {
      toast({ title: "Error", description: "Failed to issue voucher", variant: "destructive" });
    }
  };

  const handlePrint = (v: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${v.voucher_number}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 2px solid #222; }
            h1 { margin: 0 0 10px 0; font-size: 24px; color: #111; letter-spacing: 1px; }
            h3 { margin: 0; color: #555; font-weight: normal; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px; }
            .info-row { display: flex; margin-bottom: 10px; }
            .label { font-weight: bold; width: 120px; color: #555; }
            .value { flex: 1; border-bottom: 1px solid #ccc; padding-bottom: 2px; }
            .particulars-box { border: 1px solid #ddd; padding: 20px; min-height: 100px; margin-bottom: 30px; border-radius: 4px; }
            .particulars-title { font-weight: bold; margin-bottom: 10px; color: #555; }
            .amount-box { text-align: right; font-size: 20px; font-weight: bold; margin-bottom: 60px; padding: 10px; background: #f9f9f9; border: 1px solid #eee; border-radius: 4px; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 80px; }
            .sig-line { border-top: 1px solid #000; text-align: center; padding-top: 10px; font-size: 14px; font-weight: bold; color: #444; }
            .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; background: #eee; text-transform: uppercase; float: right; }
          </style>
        </head>
        <body>
          <div class="header">
            <span class="badge">${v.type} VOUCHER</span>
            <h1>${v.type === 'payment' ? 'PAYMENT' : v.type === 'receipt' ? 'RECEIPT' : 'JOURNAL'} VOUCHER</h1>
            <h3>${company?.name || 'Company Name'}</h3>
            <p style="margin: 5px 0 0 0; font-size: 12px; color: #777;">${company?.address || ''}</p>
          </div>
          
          <div class="info-grid">
            <div>
              <div class="info-row"><div class="label">Voucher No:</div><div class="value">${v.voucher_number}</div></div>
              <div class="info-row"><div class="label">Date:</div><div class="value">${new Date(v.date).toLocaleDateString()}</div></div>
            </div>
            <div>
              <div class="info-row"><div class="label">Payee / To:</div><div class="value">${v.payee || '-'}</div></div>
              <div class="info-row"><div class="label">Project:</div><div class="value">${v.project_id ? 'Assigned to Project' : 'Head Office'}</div></div>
            </div>
          </div>

          <div class="particulars-box">
            <div class="particulars-title">Particulars:</div>
            <div>${v.description || v.particulars || 'No details provided.'}</div>
          </div>

          <div class="amount-box">
            Total Amount: ${currency || '$'} ${v.amount.toLocaleString(undefined, {minimumFractionDigits: 2})}
          </div>

          <div class="signatures">
            <div class="sig-line">Prepared By</div>
            <div class="sig-line">Approved By</div>
            <div class="sig-line">Received By</div>
          </div>
          
          <script>
            window.onload = function() { window.print(); }
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await accountingService.createVoucher({
      type: form.type,
      voucher_number: form.voucher_number,
      date: form.date,
      amount: parseFloat(form.amount) || 0,
      payee: form.payee,
      description: form.particulars, // Mapped to correct DB column
      project_id: form.project_id === "office" ? null : form.project_id
    });
    
    setDialogOpen(false);
    setForm({
      type: "payment",
      voucher_number: `PV-${Math.floor(Math.random() * 10000)}`,
      date: new Date().toISOString().split("T")[0],
      amount: "",
      payee: "",
      particulars: "",
      project_id: "office"
    });
    loadData();
  };

  const getVoucherPrefix = (type: string) => {
    if (type === "payment") return "PV";
    if (type === "receipt") return "RV";
    return "JV";
  };

  return (
    <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Voucher Management</CardTitle>
          <CardDescription>Issue and track Payment, Receipt, and Journal vouchers</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Issue Voucher
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Issue New Voucher</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Voucher Type</Label>
                  <Select 
                    value={form.type} 
                    onValueChange={val => setForm({
                      ...form, 
                      type: val,
                      voucher_number: `${getVoucherPrefix(val)}-${Math.floor(Math.random() * 10000)}`
                    })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="payment">Payment Voucher (PV)</SelectItem>
                      <SelectItem value="receipt">Receipt Voucher (RV)</SelectItem>
                      <SelectItem value="journal">Journal Voucher (JV)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Voucher No.</Label>
                  <Input value={form.voucher_number} onChange={e => setForm({...form, voucher_number: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Amount</Label>
                  <Input type="number" step="0.01" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Payee / Received From</Label>
                  <Input value={form.payee} onChange={e => setForm({...form, payee: e.target.value})} required />
                </div>
                <div className="space-y-2">
                  <Label>Allocation / Project</Label>
                  <Select value={form.project_id} onValueChange={val => setForm({...form, project_id: val})}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="office" className="font-bold text-primary">🏢 Office / Overhead</SelectItem>
                      {projects.map(p => <SelectItem key={p.id} value={p.id}>🏗️ {p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2 col-span-2">
                  <Label>Particulars / Details</Label>
                  <Textarea rows={3} value={form.particulars} onChange={e => setForm({...form, particulars: e.target.value})} required />
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button type="submit">Generate Voucher</Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="border rounded-md">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Voucher No.</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Payee / Details</TableHead>
                <TableHead>Allocation</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : vouchers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No vouchers issued yet.
                  </TableCell>
                </TableRow>
              ) : (
                vouchers.map(v => (
                  <TableRow key={v.id}>
                    <TableCell className="whitespace-nowrap">{v.date}</TableCell>
                    <TableCell className="font-mono font-medium">{v.voucher_number}</TableCell>
                    <TableCell>
                      <Badge variant={v.type === "payment" ? "destructive" : v.type === "receipt" ? "default" : "outline"}>
                        {v.type.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{v.payee}</div>
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate">{v.description || v.particulars}</div>
                    </TableCell>
                    <TableCell>
                      {v.project_id ? "Project Assigned" : "Office"}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={v.status === 'draft' ? 'outline' : 'secondary'} 
                        className={v.status === 'draft' ? 'bg-orange-50 text-orange-700 border-orange-200 capitalize' : 'capitalize'}
                      >
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(v.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {v.status === 'draft' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleApproveDraft(v.id)} title="Issue Voucher">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handlePrint(v)} title="Print to PDF">
                          <Printer className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}