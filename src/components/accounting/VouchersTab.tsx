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
import { Plus, ReceiptText } from "lucide-react";

export function VouchersTab() {
  const { formatCurrency } = useSettings();
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
    setVouchers(vData.data || []);
    setProjects(pData.data || []);
    setLoading(false);
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
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate">{v.particulars}</div>
                    </TableCell>
                    <TableCell>
                      {v.project_id ? "Project Assigned" : "Office"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">{v.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(v.amount)}
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