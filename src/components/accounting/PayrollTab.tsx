import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useSettings } from "@/contexts/SettingsProvider";
import { accountingService } from "@/services/accountingService";
import { projectService } from "@/services/projectService";
import { cashAdvancesService } from "@/services/cashAdvancesService";
import { FileText, MinusCircle, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface Deduction {
  id?: string;
  amount: number;
  type: "cash_advance" | "other";
  date: string;
  notes?: string;
  cash_advance_id?: string;
}

interface PayrollEmployee {
  id: string;
  name: string;
  role: string;
  daily_rate: number;
  overtime_rate: number;
  total_reg_hours: number;
  total_ot_hours: number;
  days_present: number;
  regPay: number;
  otPay: number;
  totalPay: number;
  deductions: Deduction[];
  netPay: number;
  cash_advances?: Array<{
    id: string;
    amount: number;
    balance: number;
    date: string;
  }>;
}

export function PayrollTab() {
  const { formatCurrency, isLocked } = useSettings();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [payrollData, setPayrollData] = useState<PayrollEmployee[]>([]);
  const [deductionDialogOpen, setDeductionDialogOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<PayrollEmployee | null>(null);
  const [newDeduction, setNewDeduction] = useState<Deduction>({
    amount: 0,
    type: "other",
    date: new Date().toISOString().split("T")[0],
    notes: ""
  });
  
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

    const personnelIds = Object.keys(grouped);
    const cashAdvancesPromises = personnelIds.map(async (id) => {
      const advances = await cashAdvancesService.getCashAdvancesByPersonnel(id);
      return { id, advances: advances.filter(a => a.balance > 0) };
    });

    const cashAdvancesData = await Promise.all(cashAdvancesPromises);
    const cashAdvancesMap = new Map(cashAdvancesData.map(d => [d.id, d.advances]));

    const processedData = Object.values(grouped).map(emp => {
      const hourlyRate = emp.daily_rate / 8;
      const regPay = emp.total_reg_hours * hourlyRate;
      const otPay = emp.total_ot_hours * emp.overtime_rate;
      const totalPay = regPay + otPay;
      
      const totalDeductions = emp.deductions.reduce((sum: number, d: Deduction) => sum + d.amount, 0);
      
      return {
        ...emp,
        regPay,
        otPay,
        totalPay,
        netPay: totalPay - totalDeductions,
        cash_advances: cashAdvancesMap.get(emp.id)?.map(a => ({
          id: a.id,
          amount: a.amount,
          balance: a.balance,
          date: a.date
        })) || []
      };
    });

    processedData.sort((a, b) => a.name.localeCompare(b.name));
    
    setPayrollData(processedData);
    setLoading(false);
  };

  const handleAddDeduction = (employee: PayrollEmployee) => {
    setSelectedEmployee(employee);
    setNewDeduction({
      amount: 0,
      type: "other",
      date: new Date().toISOString().split("T")[0],
      notes: ""
    });
    setDeductionDialogOpen(true);
  };

  const handleSaveDeduction = () => {
    if (!selectedEmployee || newDeduction.amount <= 0) {
      toast({
        title: "Invalid deduction",
        description: "Amount must be greater than 0",
        variant: "destructive"
      });
      return;
    }

    const updatedPayroll = payrollData.map(emp => {
      if (emp.id === selectedEmployee.id) {
        const updatedDeductions = [...emp.deductions, { ...newDeduction, id: crypto.randomUUID() }];
        const totalDeductions = updatedDeductions.reduce((sum, d) => sum + d.amount, 0);
        return {
          ...emp,
          deductions: updatedDeductions,
          netPay: emp.totalPay - totalDeductions
        };
      }
      return emp;
    });

    setPayrollData(updatedPayroll);
    setDeductionDialogOpen(false);
    toast({
      title: "Deduction added",
      description: `${formatCurrency(newDeduction.amount)} deduction added for ${selectedEmployee.name}`,
    });
  };

  const handleRemoveDeduction = (employeeId: string, deductionId: string) => {
    const updatedPayroll = payrollData.map(emp => {
      if (emp.id === employeeId) {
        const updatedDeductions = emp.deductions.filter(d => d.id !== deductionId);
        const totalDeductions = updatedDeductions.reduce((sum, d) => sum + d.amount, 0);
        return {
          ...emp,
          deductions: updatedDeductions,
          netPay: emp.totalPay - totalDeductions
        };
      }
      return emp;
    });

    setPayrollData(updatedPayroll);
  };

  const handleSendToVoucher = async () => {
    console.log("PayrollTab - Send to Voucher clicked");
    console.log("PayrollTab - Payroll data count:", payrollData.length);
    console.log("PayrollTab - Total net pay:", totalNetPay);
    console.log("PayrollTab - Is sending:", isSending);
    console.log("PayrollTab - Is locked:", isLocked);
    
    if (payrollData.length === 0) {
      console.log("PayrollTab - No payroll data, returning");
      toast({
        title: "No payroll data",
        description: "Generate payroll first by clicking 'Apply Filter'",
        variant: "destructive"
      });
      return;
    }
    
    setIsSending(true);
    
    try {
      console.log("PayrollTab - Starting voucher creation...");
      
      // Get next voucher number
      const { data: existingVouchers } = await supabase.from('vouchers').select('id').eq('type', 'payment');
      const nextNum = (existingVouchers?.length || 0) + 1;
      const vNumber = `PV-${new Date().getFullYear()}-${String(nextNum).padStart(3, '0')}`;

      const projName = filters.projectId === "all" 
        ? "General / Multiple Projects" 
        : projects.find(p => p.id === filters.projectId)?.name || "Unknown Project";

      const voucherPayload = {
        voucher_number: vNumber,
        type: "payment" as const,
        date: new Date().toISOString().split("T")[0],
        payee: `Payroll: ${projName}`,
        description: `Automated Payroll Generation: ${filters.startDate} to ${filters.endDate} for ${projName}`,
        amount: totalNetPay,
        project_id: filters.projectId === "all" ? null : filters.projectId
      };

      console.log("PayrollTab - Voucher payload:", voucherPayload);

      // Use the accounting service to create voucher (handles approval center)
      const { data: createdVoucher, error: voucherError } = await accountingService.createVoucher(voucherPayload);

      if (voucherError) {
        console.error("PayrollTab - Voucher creation error:", voucherError);
        throw voucherError;
      }

      if (!createdVoucher) {
        throw new Error("Voucher was not created");
      }

      console.log("PayrollTab - Voucher created:", createdVoucher);

      // Save payroll deductions to database
      const payrollDeductionRecords = payrollData.flatMap(emp => 
        emp.deductions.map(d => ({
          voucher_id: createdVoucher.id,
          personnel_id: emp.id,
          deduction_type: d.type,
          amount: d.amount,
          deduction_date: d.date,
          notes: d.notes || null,
          cash_advance_id: d.cash_advance_id || null
        }))
      );

      if (payrollDeductionRecords.length > 0) {
        console.log("PayrollTab - Saving deduction records:", payrollDeductionRecords);
        const { error: deductionsError } = await supabase
          .from('payroll_voucher_deductions')
          .insert(payrollDeductionRecords);

        if (deductionsError) {
          console.error("PayrollTab - Error saving deductions:", deductionsError);
          throw deductionsError;
        }
        
        console.log("PayrollTab - Deductions saved successfully");
      }

      // Get all cash advance deductions to process
      const cashAdvanceDeductions = payrollData.flatMap(emp => 
        emp.deductions
          .filter(d => d.type === "cash_advance" && d.cash_advance_id)
          .map(d => ({
            employee_name: emp.name,
            cash_advance_id: d.cash_advance_id!,
            amount: d.amount,
            deduction_date: d.date,
            deduction_source: "payroll",
            notes: d.notes || `Payroll deduction: ${filters.startDate} to ${filters.endDate}`
          }))
      );

      console.log("PayrollTab - Cash Advance Deductions to create:", cashAdvanceDeductions);

      if (cashAdvanceDeductions.length > 0) {
        // Create deduction promises
        const deductionPromises = cashAdvanceDeductions.map(d => 
          cashAdvancesService.createCashAdvanceDeduction({
            cash_advance_id: d.cash_advance_id,
            amount: d.amount,
            deduction_date: d.deduction_date,
            deduction_source: d.deduction_source,
            notes: d.notes
          })
        );

        try {
          const deductionResults = await Promise.all(deductionPromises);
          console.log("PayrollTab - Cash advance deductions created successfully:", deductionResults);
        } catch (caError) {
          console.error("PayrollTab - Error creating cash advance deductions:", caError);
          // Don't throw - voucher is already created
        }
      }

      toast({ 
        title: "Payroll Processed!", 
        description: `Voucher ${vNumber} created for ${formatCurrency(totalNetPay)}${cashAdvanceDeductions.length > 0 ? ` with ${cashAdvanceDeductions.length} cash advance deductions` : ''}.`,
        className: "bg-emerald-600 text-white border-emerald-700" 
      });

      // Clear payroll data after successful submission
      setPayrollData([]);
      loadPayroll();
    } catch (error: any) {
      console.error("PayrollTab - Error processing payroll:", error);
      console.error("PayrollTab - Error details:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      toast({ 
        title: "Failed to process payroll", 
        description: error.message || "Unknown error occurred. Check browser console for details.", 
        variant: "destructive" 
      });
    } finally {
      setIsSending(false);
    }
  };

  const totalPayrollCost = payrollData.reduce((sum, emp) => sum + emp.totalPay, 0);
  const totalDeductions = payrollData.reduce((sum, emp) => 
    sum + emp.deductions.reduce((dSum, d) => dSum + d.amount, 0), 0
  );
  const totalNetPay = totalPayrollCost - totalDeductions;

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
          <div className="text-right space-y-2">
            <div>
              <div className="text-sm text-muted-foreground">Gross Payroll</div>
              <div className="text-xl font-bold">{formatCurrency(totalPayrollCost)}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Total Deductions</div>
              <div className="text-xl font-bold text-red-600">-{formatCurrency(totalDeductions)}</div>
            </div>
            <div className="border-t pt-2">
              <div className="text-sm text-muted-foreground">Net Payroll</div>
              <div className="text-2xl font-bold text-emerald-600">{formatCurrency(totalNetPay)}</div>
            </div>
            {payrollData.length > 0 && (
              <Button 
                onClick={handleSendToVoucher} 
                disabled={isSending || isLocked}
                size="sm" 
                className="mt-2 w-full bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
              >
                {isSending ? "Sending..." : <><FileText className="h-4 w-4 mr-2" />Send to Vouchers</>}
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
                  <TableHead className="text-center">Days</TableHead>
                  <TableHead className="text-center">Reg. Hrs</TableHead>
                  <TableHead className="text-center">OT Hrs</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Deductions</TableHead>
                  <TableHead className="text-right font-bold">Net Pay</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payrollData.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      No attendance records found for this period.
                    </TableCell>
                  </TableRow>
                ) : (
                  payrollData.map((emp) => (
                    <>
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">
                          {emp.name}
                          {emp.cash_advances && emp.cash_advances.length > 0 && (
                            <Badge variant="outline" className="ml-2 text-xs bg-amber-50 text-amber-700 border-amber-300">
                              {emp.cash_advances.length} CA
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{emp.role || "-"}</TableCell>
                        <TableCell className="text-center">{emp.days_present}</TableCell>
                        <TableCell className="text-center">{emp.total_reg_hours}</TableCell>
                        <TableCell className="text-center text-orange-600">{emp.total_ot_hours}</TableCell>
                        <TableCell className="text-right">{formatCurrency(emp.totalPay)}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {emp.deductions.length > 0 ? `-${formatCurrency(emp.deductions.reduce((s, d) => s + d.amount, 0))}` : "-"}
                        </TableCell>
                        <TableCell className="text-right font-bold text-emerald-600">{formatCurrency(emp.netPay)}</TableCell>
                        <TableCell className="text-center">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => handleAddDeduction(emp)}
                            className="h-7 text-xs"
                          >
                            <Plus className="h-3 w-3 mr-1" />
                            Add Deduction
                          </Button>
                        </TableCell>
                      </TableRow>
                      {emp.deductions.length > 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30 p-0">
                            <div className="px-4 py-2">
                              <div className="text-xs font-medium text-muted-foreground mb-2">Deductions:</div>
                              <div className="space-y-1">
                                {emp.deductions.map((deduction) => (
                                  <div key={deduction.id} className="flex items-center justify-between text-sm bg-background rounded px-3 py-2 border">
                                    <div className="flex items-center gap-3">
                                      <Badge variant={deduction.type === "cash_advance" ? "default" : "secondary"} className="text-xs">
                                        {deduction.type === "cash_advance" ? "Cash Advance" : "Other"}
                                      </Badge>
                                      <span className="font-medium text-red-600">{formatCurrency(deduction.amount)}</span>
                                      <span className="text-muted-foreground">{deduction.date}</span>
                                      {deduction.notes && <span className="text-sm text-muted-foreground">- {deduction.notes}</span>}
                                    </div>
                                    <Button 
                                      size="sm" 
                                      variant="ghost" 
                                      onClick={() => handleRemoveDeduction(emp.id, deduction.id!)}
                                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                    >
                                      <MinusCircle className="h-4 w-4" />
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={deductionDialogOpen} onOpenChange={setDeductionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Deduction for {selectedEmployee?.name}</DialogTitle>
            <DialogDescription>
              Record a deduction to be applied to this employee's payroll
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Deduction Type *</Label>
              <Select
                value={newDeduction.type}
                onValueChange={(val: "cash_advance" | "other") => {
                  setNewDeduction({ ...newDeduction, type: val, cash_advance_id: undefined });
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cash_advance">Cash Advance Repayment</SelectItem>
                  <SelectItem value="other">Other Deduction</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {newDeduction.type === "cash_advance" && selectedEmployee && (
              <div>
                <Label>Select Cash Advance</Label>
                <Select
                  value={newDeduction.cash_advance_id || "none"}
                  onValueChange={(val) => {
                    if (val !== "none") {
                      const advance = selectedEmployee.cash_advances?.find(a => a.id === val);
                      setNewDeduction({ 
                        ...newDeduction, 
                        cash_advance_id: val,
                        amount: advance?.balance || 0
                      });
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select cash advance" />
                  </SelectTrigger>
                  <SelectContent>
                    {selectedEmployee.cash_advances && selectedEmployee.cash_advances.length > 0 ? (
                      selectedEmployee.cash_advances.map((ca) => (
                        <SelectItem key={ca.id} value={ca.id}>
                          {ca.date} - Balance: {formatCurrency(ca.balance)}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="none" disabled>No outstanding cash advances</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label>Deduction Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={newDeduction.amount || ""}
                onChange={(e) => setNewDeduction({ ...newDeduction, amount: parseFloat(e.target.value) || 0 })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Deduction Date *</Label>
              <Input
                type="date"
                value={newDeduction.date}
                onChange={(e) => setNewDeduction({ ...newDeduction, date: e.target.value })}
              />
            </div>

            <div>
              <Label>Notes (Optional)</Label>
              <Input
                value={newDeduction.notes || ""}
                onChange={(e) => setNewDeduction({ ...newDeduction, notes: e.target.value })}
                placeholder="Additional notes..."
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setDeductionDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveDeduction}>
                Add Deduction
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}