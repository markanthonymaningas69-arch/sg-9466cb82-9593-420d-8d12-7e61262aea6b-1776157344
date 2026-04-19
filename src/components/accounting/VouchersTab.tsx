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
import { Plus, ReceiptText, Printer, CheckCircle, Archive, Filter, FilterX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export function VouchersTab() {
  const { formatCurrency, company, currency, isLocked } = useSettings();
  const { toast } = useToast();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");

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
    // Sort vouchers: approved first, then by date descending
    const sortedVouchers = (vData.data || []).sort((a, b) => {
      if (a.status === 'approved' && b.status !== 'approved') return -1;
      if (a.status !== 'approved' && b.status === 'approved') return 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
    setVouchers(sortedVouchers);
    setProjects(pData.data || []);
    setLoading(false);
  };

  const handleIssueVoucher = async (v: any) => {
    const { error } = await supabase.from('vouchers').update({ status: 'issued' }).eq('id', v.id);
    if (!error) {
      if (v.type === 'payment') {
        const poMatch = v.description?.match(/PO (PR-\d+|PO-\d+)/);
        if (poMatch && poMatch[1]) {
          await supabase.from('purchases').update({ voucher_number: v.voucher_number }).eq('order_number', poMatch[1]);
          
          // Fetch the PO items to automatically generate pending deliveries for the site personnel
          const { data: poItems } = await supabase.from('purchases').select('*').eq('order_number', poMatch[1]);
          if (poItems && poItems.length > 0) {
            const deliveryInserts = poItems.map(po => ({
              project_id: po.project_id || null,
              delivery_date: new Date().toISOString().split('T')[0],
              item_name: po.item_name,
              quantity: po.quantity,
              unit: po.unit,
              supplier: po.supplier,
              status: 'pending',
              notes: `From PO: ${po.order_number}`
            }));
            await supabase.from('deliveries').insert(deliveryInserts);
            toast({ title: "Voucher Issued", description: "Voucher issued. Delivery automatically queued for Site Personnel." });
          } else {
            toast({ title: "Voucher Issued", description: "Voucher issued and Purchase Order updated with Voucher Number." });
          }
        } else {
          toast({ title: "Voucher Issued", description: "The voucher has been officially marked as issued." });
        }
      } else {
        toast({ title: "Voucher Issued", description: "The voucher has been officially marked as issued." });
      }
      loadData();
    } else {
      toast({ title: "Error", description: "Failed to issue voucher", variant: "destructive" });
    }
  };

  const handleApproveVoucher = async (v: any) => {
    const { error } = await supabase.from('vouchers').update({ status: 'approved' }).eq('id', v.id);
    if (!error) {
      toast({ title: "Voucher Approved", description: "Voucher has been approved and is ready to be issued." });
      loadData();
    } else {
      toast({ title: "Error", description: "Failed to approve voucher", variant: "destructive" });
    }
  };

  const handleArchive = async (v: any) => {
    if (confirm(`Are you sure you want to archive voucher ${v.voucher_number}?`)) {
      const { error } = await accountingService.archiveVoucher(v.id);
      if (!error) {
        toast({ title: "Archived", description: "Voucher archived successfully." });
        loadData();
      } else {
        toast({ title: "Error", description: "Failed to archive voucher", variant: "destructive" });
      }
    }
  };

  const handlePrint = (v: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const projectName = v.project_id ? projects.find(p => p.id === v.project_id)?.name || 'Unknown Project' : 'Head Office';
    const logoUrl = company?.logo_url || '';
    const absoluteLogoUrl = logoUrl ? (logoUrl.startsWith('/') ? window.location.origin + logoUrl : logoUrl) : '';

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Voucher ${v.voucher_number}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #222; max-width: 800px; margin: 0 auto; line-height: 1.5; }
            .header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .company-info { display: flex; align-items: center; gap: 15px; }
            .company-logo { max-width: 80px; max-height: 80px; object-fit: contain; }
            .company-text h3 { margin: 0; font-size: 18px; color: #111; text-transform: uppercase; font-weight: bold; }
            .company-text p { margin: 3px 0 0 0; font-size: 12px; color: #555; }
            .voucher-title { text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px; text-transform: uppercase; background: #eee; padding: 10px 20px; border: 1px solid #ccc; display: inline-block; margin: 20px auto 40px auto; width: 100%; box-sizing: border-box; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 30px; }
            .info-row { display: flex; margin-bottom: 12px; }
            .label { font-weight: bold; width: 120px; color: #333; }
            .value { flex: 1; border-bottom: 1px solid #999; padding-bottom: 2px; font-family: monospace; font-size: 14px; }
            .particulars-box { border: 1px solid #000; padding: 20px; min-height: 150px; margin-bottom: 30px; }
            .particulars-title { font-weight: bold; margin-bottom: 15px; color: #000; text-decoration: underline; text-transform: uppercase; font-size: 14px; }
            .particulars-content { white-space: pre-wrap; font-size: 14px; }
            .amount-box { text-align: right; font-size: 22px; font-weight: bold; margin-bottom: 60px; padding: 15px 20px; background: #f9f9f9; border: 1px solid #000; display: inline-block; float: right; min-width: 250px; }
            .clearfix::after { content: ""; clear: both; display: table; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; }
            .sig-line { border-top: 1px solid #000; text-align: center; padding-top: 10px; font-size: 12px; font-weight: bold; color: #333; text-transform: uppercase; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="company-info">
              ${absoluteLogoUrl ? `<img src="${absoluteLogoUrl}" class="company-logo" alt="Logo" />` : `<div style="width: 50px; height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; font-size: 10px; color: #999;">LOGO</div>`}
              <div class="company-text">
                <h3>${company?.name || 'Company Name'}</h3>
                <p>${company?.address || 'Company Address line 1<br/>City, Country, ZIP'}</p>
              </div>
            </div>
          </div>
          
          <div class="voucher-title">
            ${v.type === 'payment' ? 'PAYMENT' : v.type === 'receipt' ? 'RECEIPT' : 'JOURNAL'} VOUCHER
          </div>
          
          <div class="info-grid">
            <div>
              <div class="info-row"><div class="label">Voucher No:</div><div class="value">${v.voucher_number}</div></div>
              <div class="info-row"><div class="label">Date:</div><div class="value">${new Date(v.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
            </div>
            <div>
              <div class="info-row"><div class="label">Payee / To:</div><div class="value">${v.payee || '-'}</div></div>
              <div class="info-row"><div class="label">Project:</div><div class="value">${projectName}</div></div>
            </div>
          </div>

          <div class="particulars-box">
            <div class="particulars-title">Particulars:</div>
            <div class="particulars-content">${v.description || v.particulars || 'No details provided.'}</div>
          </div>

          <div class="clearfix">
            <div class="amount-box">
              ${currency || 'AED'} ${v.amount.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
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

  const filteredVouchers = vouchers.filter(v => {
    if (filterType !== "all" && v.type !== filterType) return false;
    if (filterStatus !== "all" && v.status !== filterStatus) return false;
    if (filterProject !== "all") {
      if (filterProject === "office" && v.project_id) return false;
      if (filterProject !== "office" && v.project_id !== filterProject) return false;
    }
    return true;
  });

  return (
    <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Voucher Management</CardTitle>
          <CardDescription>Issue and track Payment, Receipt, and Journal vouchers</CardDescription>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button disabled={isLocked}>
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
        <div className="flex justify-end mb-4 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="h-9">
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? "Hide Filters" : "Filters"}
            {(filterType !== "all" || filterStatus !== "all" || filterProject !== "all") && (
              <span className="ml-2 flex h-2 w-2 rounded-full bg-primary shadow-[0_0_4px_rgba(var(--primary),0.5)]"></span>
            )}
          </Button>
        </div>

        {showFilters && (
          <div className="bg-muted/30 p-3 mb-4 border rounded-lg flex flex-wrap gap-4 shrink-0">
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-[150px] h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="payment">Payment</SelectItem>
                  <SelectItem value="receipt">Receipt</SelectItem>
                  <SelectItem value="journal">Journal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Status</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[150px] h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="approved">Approved</SelectItem>
                  <SelectItem value="issued">Issued</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Project/Allocation</Label>
              <Select value={filterProject} onValueChange={setFilterProject}>
                <SelectTrigger className="w-[180px] h-8 text-xs bg-background"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Allocations</SelectItem>
                  <SelectItem value="office" className="font-bold text-primary">🏢 Office / Overhead</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>🏗️ {p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(filterType !== "all" || filterStatus !== "all" || filterProject !== "all") && (
              <div className="space-y-1 flex items-end pb-0.5">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 text-muted-foreground"
                  onClick={() => {
                    setFilterType("all");
                    setFilterStatus("all");
                    setFilterProject("all");
                  }}
                >
                  <FilterX className="h-4 w-4 mr-2" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        )}

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
                  <TableCell colSpan={8} className="text-center py-8">Loading...</TableCell>
                </TableRow>
              ) : filteredVouchers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    {vouchers.length === 0 ? "No vouchers issued yet." : "No vouchers match your filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredVouchers.map(v => (
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
                        variant={v.status === 'approved' ? 'outline' : v.status === 'pending' ? 'secondary' : 'default'} 
                        className={
                          v.status === 'approved' ? 'bg-blue-50 text-blue-700 border-blue-200 capitalize' : 
                          v.status === 'pending' ? 'bg-orange-50 text-orange-700 hover:bg-orange-50 border-transparent capitalize' : 
                          'bg-emerald-500 text-white capitalize'
                        }
                      >
                        {v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(v.amount)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {v.status === 'pending' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-orange-600 hover:text-orange-700 hover:bg-orange-50" onClick={() => handleApproveVoucher(v)} title="Approve Voucher (GM Only)" disabled={isLocked}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {v.status === 'approved' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleIssueVoucher(v)} title="Mark as Issued" disabled={isLocked}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50" onClick={() => handlePrint(v)} title="Print to PDF">
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-500 hover:text-slate-700 hover:bg-slate-100" onClick={() => handleArchive(v)} title="Archive Voucher" disabled={isLocked}>
                          <Archive className="h-4 w-4" />
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