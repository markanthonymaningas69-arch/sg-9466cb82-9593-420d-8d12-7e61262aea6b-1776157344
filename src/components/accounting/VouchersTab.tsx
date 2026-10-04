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
import { useRouter } from "next/router";

export function VouchersTab() {
  const { formatCurrency, company, currency, isLocked } = useSettings();
  const { toast } = useToast();
  const router = useRouter();
  const [vouchers, setVouchers] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showFilters, setShowFilters] = useState(false);
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [payrollDetailsOpen, setPayrollDetailsOpen] = useState(false);
  const [payrollDetails, setPayrollDetails] = useState<any[]>([]);
  const [selectedVoucher, setSelectedVoucher] = useState<any>(null);

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

    const { error } = await accountingService.createVoucher({
      type: form.type,
      voucher_number: form.voucher_number,
      date: form.date,
      amount: parseFloat(form.amount) || 0,
      payee: form.payee,
      description: form.particulars,
      project_id: form.project_id === "office" ? null : form.project_id,
    });

    if (error) {
      toast({
        title: "Unable to create voucher",
        description: error.message || "Approval Center routing failed.",
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Voucher submitted",
      description: "Voucher request created and sent to Approval Center.",
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

  const handlePrintPayrollDetails = async (voucher: any) => {
    // Extract date range from description
    const dateMatch = voucher.description?.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/);
    if (!dateMatch) {
      toast({
        title: "Cannot load payroll details",
        description: "Date range not found in voucher description",
        variant: "destructive"
      });
      return;
    }

    const startDate = dateMatch[1];
    const endDate = dateMatch[2];
    const projectId = voucher.project_id || "all";

    try {
      const { data } = await accountingService.getPayrollData(startDate, endDate, projectId);
      
      // Group by personnel
      const grouped: Record<string, any> = {};
      (data || []).forEach((record: any) => {
        const p = record.personnel;
        if (!p) return;
        
        if (!grouped[p.id]) {
          grouped[p.id] = {
            id: p.id,
            name: p.name,
            role: p.role,
            daily_rate: p.daily_rate || 0,
            overtime_rate: p.overtime_rate || 0,
            total_reg_hours: 0,
            total_ot_hours: 0,
            days_present: 0,
            deductions: []
          };
        }
        
        grouped[p.id].total_reg_hours += Number(record.hours_worked || 0);
        grouped[p.id].total_ot_hours += Number(record.overtime_hours || 0);
        grouped[p.id].days_present += 1;
      });

      const processedData = Object.values(grouped).map(emp => {
        const hourlyRate = emp.daily_rate / 8;
        const regPay = emp.total_reg_hours * hourlyRate;
        const otPay = emp.total_ot_hours * emp.overtime_rate;
        const totalPay = regPay + otPay;
        const totalDeductions = emp.deductions.reduce((sum: number, d: any) => sum + d.amount, 0);
        
        return {
          ...emp,
          regPay,
          otPay,
          totalPay,
          netPay: totalPay - totalDeductions
        };
      });

      processedData.sort((a, b) => a.name.localeCompare(b.name));
      
      setPayrollDetails(processedData);
      setSelectedVoucher(voucher);
      setPayrollDetailsOpen(true);
    } catch (error: any) {
      toast({
        title: "Error loading payroll details",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const handlePrintPayrollReport = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const projectName = selectedVoucher.project_id 
      ? projects.find(p => p.id === selectedVoucher.project_id)?.name || 'Unknown Project' 
      : 'General / Multiple Projects';
    
    const logoUrl = company?.logo_url || '';
    const absoluteLogoUrl = logoUrl ? (logoUrl.startsWith('/') ? window.location.origin + logoUrl : logoUrl) : '';

    const totalGross = payrollDetails.reduce((sum, emp) => sum + emp.totalPay, 0);
    const totalDeductions = payrollDetails.reduce((sum, emp) => 
      sum + emp.deductions.reduce((dSum: number, d: any) => dSum + d.amount, 0), 0
    );
    const totalNet = totalGross - totalDeductions;

    const employeeRows = payrollDetails.map(emp => {
      const deductionAmount = emp.deductions.reduce((sum: number, d: any) => sum + d.amount, 0);
      const deductionsList = emp.deductions.map((d: any) => 
        `${d.type === 'cash_advance' ? 'Cash Advance' : 'Other'}: ${formatCurrency(d.amount)} (${d.date})`
      ).join(', ') || 'None';
      
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">${emp.name}</td>
          <td style="padding: 8px; border: 1px solid #ddd;">${emp.role || '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${emp.days_present}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${emp.total_reg_hours}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center;">${emp.total_ot_hours}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(emp.daily_rate)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right;">${formatCurrency(emp.overtime_rate)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(emp.totalPay)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #dc2626;">${deductionAmount > 0 ? formatCurrency(deductionAmount) : '-'}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold; color: #059669;">${formatCurrency(emp.netPay)}</td>
        </tr>
        ${emp.deductions.length > 0 ? `
          <tr style="background: #f9fafb;">
            <td colspan="10" style="padding: 8px; border: 1px solid #ddd; font-size: 12px; color: #6b7280;">
              <strong>Deductions:</strong> ${deductionsList}
            </td>
          </tr>
        ` : ''}
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Payroll Details - ${selectedVoucher.voucher_number}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #222; margin: 0; }
            .header-container { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .company-info { display: flex; align-items: center; gap: 15px; }
            .company-logo { max-width: 80px; max-height: 80px; object-fit: contain; }
            .company-text h3 { margin: 0; font-size: 18px; color: #111; text-transform: uppercase; font-weight: bold; }
            .company-text p { margin: 3px 0 0 0; font-size: 12px; color: #555; }
            .report-title { text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 1px; text-transform: uppercase; margin: 20px 0; }
            .info-section { margin: 20px 0; }
            .info-row { display: flex; margin-bottom: 8px; }
            .label { font-weight: bold; width: 150px; }
            .value { flex: 1; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
            th { background: #111; color: white; padding: 10px 8px; text-align: left; border: 1px solid #000; font-size: 11px; text-transform: uppercase; }
            .summary-box { margin-top: 30px; display: flex; justify-content: flex-end; gap: 40px; padding: 20px; background: #f9fafb; border: 1px solid #ddd; }
            .summary-item { text-align: right; }
            .summary-label { font-size: 12px; color: #6b7280; margin-bottom: 5px; }
            .summary-value { font-size: 20px; font-weight: bold; }
            .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 40px; margin-top: 60px; }
            .sig-line { border-top: 1px solid #000; text-align: center; padding-top: 10px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
            @media print {
              body { padding: 20px; }
              .no-print { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="company-info">
              ${absoluteLogoUrl ? `<img src="${absoluteLogoUrl}" class="company-logo" alt="Logo" />` : `<div style="width: 50px; height: 50px; background: #eee; display: flex; align-items: center; justify-content: center; border: 1px solid #ccc; font-size: 10px; color: #999;">LOGO</div>`}
              <div class="company-text">
                <h3>${company?.name || 'Company Name'}</h3>
                <p>${company?.address || 'Company Address'}</p>
              </div>
            </div>
          </div>
          
          <div class="report-title">PAYROLL DETAILS REPORT</div>
          
          <div class="info-section">
            <div class="info-row"><div class="label">Voucher Number:</div><div class="value">${selectedVoucher.voucher_number}</div></div>
            <div class="info-row"><div class="label">Project:</div><div class="value">${projectName}</div></div>
            <div class="info-row"><div class="label">Payroll Period:</div><div class="value">${selectedVoucher.description?.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/)?.[0] || 'N/A'}</div></div>
            <div class="info-row"><div class="label">Generated:</div><div class="value">${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Employee Name</th>
                <th>Position</th>
                <th style="text-align: center;">Days</th>
                <th style="text-align: center;">Reg. Hrs</th>
                <th style="text-align: center;">OT Hrs</th>
                <th style="text-align: right;">Daily Rate</th>
                <th style="text-align: right;">OT Rate</th>
                <th style="text-align: right;">Gross Pay</th>
                <th style="text-align: right;">Deductions</th>
                <th style="text-align: right;">Net Pay</th>
              </tr>
            </thead>
            <tbody>
              ${employeeRows}
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-item">
              <div class="summary-label">Total Gross Pay</div>
              <div class="summary-value">${formatCurrency(totalGross)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Deductions</div>
              <div class="summary-value" style="color: #dc2626;">-${formatCurrency(totalDeductions)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Net Pay</div>
              <div class="summary-value" style="color: #059669;">${formatCurrency(totalNet)}</div>
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
      <CardContent className="p-0 sm:p-6">
        <div className="overflow-x-auto">
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

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[100px]">Date</TableHead>
                <TableHead className="min-w-[120px]">Voucher #</TableHead>
                <TableHead className="min-w-[150px]">Payee</TableHead>
                <TableHead className="min-w-[150px]">Description</TableHead>
                <TableHead className="text-right min-w-[100px]">Amount</TableHead>
                <TableHead className="min-w-[100px]">Status</TableHead>
                <TableHead className="text-right min-w-[150px]">Actions</TableHead>
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
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2 text-xs text-orange-700 hover:bg-orange-50"
                            onClick={() => void router.push("/approval-center")}
                            title="Open Approval Center"
                            disabled={isLocked}
                          >
                            Approval Center
                          </Button>
                        )}
                        {v.status === 'approved' && (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-green-600 hover:text-green-700 hover:bg-green-50" onClick={() => handleIssueVoucher(v)} title="Mark as Issued" disabled={isLocked}>
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                        )}
                        {v.payee?.includes('Payroll:') && (
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="h-8 px-2 text-xs text-purple-700 hover:bg-purple-50 border-purple-200"
                            onClick={() => handlePrintPayrollDetails(v)} 
                            title="Print Payroll Details"
                          >
                            <ReceiptText className="h-3 w-3 mr-1" />
                            Details
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

      {/* Payroll Details Dialog */}
      <Dialog open={payrollDetailsOpen} onOpenChange={setPayrollDetailsOpen}>
        <DialogContent className="max-w-[95vw] max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Payroll Details - {selectedVoucher?.voucher_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <div className="text-sm text-muted-foreground">Project</div>
                <div className="font-medium">
                  {selectedVoucher?.project_id 
                    ? projects.find(p => p.id === selectedVoucher.project_id)?.name || 'Unknown' 
                    : 'General / Multiple Projects'}
                </div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">Period</div>
                <div className="font-medium">
                  {selectedVoucher?.description?.match(/(\d{4}-\d{2}-\d{2}) to (\d{4}-\d{2}-\d{2})/)?.[0] || 'N/A'}
                </div>
              </div>
            </div>

            <div className="border rounded-md overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Position</TableHead>
                    <TableHead className="text-center">Days</TableHead>
                    <TableHead className="text-center">Reg. Hrs</TableHead>
                    <TableHead className="text-center">OT Hrs</TableHead>
                    <TableHead className="text-right">Daily Rate</TableHead>
                    <TableHead className="text-right">OT Rate</TableHead>
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right">Deductions</TableHead>
                    <TableHead className="text-right font-bold">Net Pay</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payrollDetails.map((emp) => (
                    <>
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>{emp.role || '-'}</TableCell>
                        <TableCell className="text-center">{emp.days_present}</TableCell>
                        <TableCell className="text-center">{emp.total_reg_hours}</TableCell>
                        <TableCell className="text-center text-orange-600">{emp.total_ot_hours}</TableCell>
                        <TableCell className="text-right">{formatCurrency(emp.daily_rate)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(emp.overtime_rate)}</TableCell>
                        <TableCell className="text-right font-medium">{formatCurrency(emp.totalPay)}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {emp.deductions.length > 0 
                            ? `-${formatCurrency(emp.deductions.reduce((s: number, d: any) => s + d.amount, 0))}` 
                            : '-'}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(emp.netPay)}</TableCell>
                      </TableRow>
                      {emp.deductions.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-muted/30 p-2">
                            <div className="text-xs text-muted-foreground">
                              <strong>Deductions:</strong> {emp.deductions.map((d: any) => 
                                `${d.type === 'cash_advance' ? 'Cash Advance' : 'Other'}: ${formatCurrency(d.amount)} (${d.date})`
                              ).join(', ')}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between items-center p-4 bg-muted/30 rounded-lg">
              <div className="space-y-1">
                <div className="text-sm text-muted-foreground">Total Gross Pay</div>
                <div className="text-xl font-bold">{formatCurrency(payrollDetails.reduce((sum, emp) => sum + emp.totalPay, 0))}</div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-sm text-muted-foreground">Total Deductions</div>
                <div className="text-xl font-bold text-red-600">
                  -{formatCurrency(payrollDetails.reduce((sum, emp) => 
                    sum + emp.deductions.reduce((dSum: number, d: any) => dSum + d.amount, 0), 0
                  ))}
                </div>
              </div>
              <div className="space-y-1 text-right">
                <div className="text-sm text-muted-foreground">Total Net Pay</div>
                <div className="text-2xl font-bold text-emerald-600">
                  {formatCurrency(payrollDetails.reduce((sum, emp) => sum + emp.netPay, 0))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPayrollDetailsOpen(false)}>
                Close
              </Button>
              <Button onClick={handlePrintPayrollReport}>
                <Printer className="h-4 w-4 mr-2" />
                Print Report
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}