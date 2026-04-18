import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useSettings } from "@/contexts/SettingsProvider";
import { accountingService } from "@/services/accountingService";
import { projectService } from "@/services/projectService";
import { Calendar, Download, Filter, FileText, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function PayrollTab() {
  const { formatCurrency } = useSettings();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [payrollData, setPayrollData] = useState<any[]>([]);
  
  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
  const todayStr = today.toISOString().split("T")[0];

  const [filters, setFilters] = useState({
    startDate: firstDayOfMonth,
    endDate: todayStr,
    projectId: "all"
  });

  useEffect(() => {
    loadProjects();
    loadPayroll();
  }, []);

  const loadProjects = async () => {
    const { data } = await projectService.getAll();
    if (data) setProjects(data);
  };

  const loadPayroll = async () => {
    setLoading(true);
    const { data } = await accountingService.getPayrollData(filters.startDate, filters.endDate, filters.projectId);
    
    // Group attendance by personnel
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
          days_present: 0
        };
      }
      
      grouped[p.id].total_reg_hours += Number(record.hours_worked || 0);
      grouped[p.id].total_ot_hours += Number(record.overtime_hours || 0);
      grouped[p.id].days_present += 1;
    });

    const processedData = Object.values(grouped).map(emp => {
      // Assuming daily_rate is for 8 hours
      const hourlyRate = emp.daily_rate / 8;
      const regPay = emp.total_reg_hours * hourlyRate;
      const otPay = emp.total_ot_hours * emp.overtime_rate;
      
      return {
        ...emp,
        regPay,
        otPay,
        totalPay: regPay + otPay
      };
    });

    // Sort alphabetically by name
    processedData.sort((a, b) => a.name.localeCompare(b.name));
    
    setPayrollData(processedData);
    setLoading(false);
  };

  const handleSendToVoucher = async () => {
    if (payrollData.length === 0) return;
    setIsSending(true);
    
    // First, fetch existing vouchers to calculate the next voucher_number
    const { data: existingVouchers } = await supabase.from('vouchers').select('id').eq('type', 'payment');
    const nextNum = (existingVouchers?.length || 0) + 1;
    const vNumber = `PV-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

    const projName = filters.projectId === "all" 
      ? "General / Multiple Projects" 
      : projects.find(p => p.id === filters.projectId)?.name || "Unknown Project";

    const voucherPayload = {
      voucher_number: vNumber,
      type: "payment",
      date: new Date().toISOString().split("T")[0],
      payee: `Payroll: ${projName}`,
      description: `Automated Payroll Generation: ${filters.startDate} to ${filters.endDate} for ${projName}`,
      amount: totalPayrollCost,
      status: "pending",
      project_id: filters.projectId === "all" ? null : filters.projectId
    };

    const { error } = await accountingService.createVoucher(voucherPayload);

    setIsSending(false);

    if (error) {
      toast({ title: "Failed to create voucher", description: error.message, variant: "destructive" });
    } else {
      toast({ 
        title: "Voucher Created!", 
        description: `A pending payment voucher for ${formatCurrency(totalPayrollCost)} has been sent to Accounting.`,
        className: "bg-emerald-600 text-white border-emerald-700" 
      });
    }
  };

  const totalPayrollCost = payrollData.reduce((sum, emp) => sum + emp.totalPay, 0);

  return (
    <div className="space-y-4 mt-4">
      <Card className="shadow-sm">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4 items-end">
            <div className="space-y-2 flex-1">
              <Label>Start Date</Label>
              <Input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} />
            </div>
            <div className="space-y-2 flex-1">
              <Label>End Date</Label>
              <Input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} />
            </div>
            <div className="space-y-2 flex-1">
              <Label>Project Filter</Label>
              <Select value={filters.projectId} onValueChange={val => setFilters({...filters, projectId: val})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button onClick={loadPayroll} disabled={loading}>
                {loading ? "Calculating..." : "Apply Filter"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-t-0 rounded-t-none shadow-none mt-0">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div>
            <CardTitle>Payroll Generation</CardTitle>
            <CardDescription>Computed securely from Site Attendance records</CardDescription>
          </div>
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Total Payroll Cost</div>
            <div className="text-2xl font-bold text-primary">{formatCurrency(totalPayrollCost)}</div>
            {payrollData.length > 0 && (
              <Button 
                onClick={handleSendToVoucher} 
                disabled={isSending}
                size="sm" 
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                {isSending ? (
                  "Sending..."
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Send to Vouchers
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-md overflow-hidden">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead>Employee Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead className="text-center">Days Present</TableHead>
                  <TableHead className="text-center">Reg. Hrs</TableHead>
                  <TableHead className="text-center">OT Hrs</TableHead>
                  <TableHead className="text-right">Reg. Pay</TableHead>
                  <TableHead className="text-right">OT Pay</TableHead>
                  <TableHead className="text-right font-bold">Total Salary</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      No attendance records found for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  payrollData.map((emp) => (
                    <TableRow key={emp.id}>
                      <TableCell className="font-medium">{emp.name}</TableCell>
                      <TableCell>{emp.role || "-"}</TableCell>
                      <TableCell className="text-center">{emp.days_present}</TableCell>
                      <TableCell className="text-center">{emp.total_reg_hours}</TableCell>
                      <TableCell className="text-center text-orange-600">{emp.total_ot_hours}</TableCell>
                      <TableCell className="text-right">{formatCurrency(emp.regPay)}</TableCell>
                      <TableCell className="text-right text-orange-600">{formatCurrency(emp.otPay)}</TableCell>
                      <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(emp.totalPay)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}