import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cashAdvancesService, CashAdvance, CashAdvanceWithDeductions } from "@/services/cashAdvancesService";
import { personnelService } from "@/services/personnelService";
import { projectService } from "@/services/projectService";
import { supabase } from "@/integrations/supabase/client";
import { Plus, MinusCircle, Wallet, Users, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { useSettings } from "@/contexts/SettingsProvider";

export function CashAdvancesTab() {
  const { toast } = useToast();
  const { currency } = useSettings();
  const [advances, setAdvances] = useState<CashAdvance[]>([]);
  const [selectedPersonnel, setSelectedPersonnel] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [personnelAdvances, setPersonnelAdvances] = useState<CashAdvanceWithDeductions[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalActive: 0, totalOutstanding: 0, personnelWithAdvances: 0 });

  // Edit advance state
  const [editAdvanceOpen, setEditAdvanceOpen] = useState(false);
  const [editingAdvance, setEditingAdvance] = useState<CashAdvance | null>(null);
  const [editForm, setEditForm] = useState({
    amount: "",
    date: "",
    purpose: "",
    notes: "",
    project_id: "",
  });

  // Delete confirmation state
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [advanceToDelete, setAdvanceToDelete] = useState<string | null>(null);

  // New advance form state
  const [newAdvanceOpen, setNewAdvanceOpen] = useState(false);
  const [newAdvanceForm, setNewAdvanceForm] = useState({
    personnel_id: "",
    project_id: "",
    amount: "",
    date: format(new Date(), "yyyy-MM-dd"),
    purpose: "",
    notes: "",
  });

  // Handler for personnel selection - auto-fills project from HR assignment
  const handlePersonnelSelect = (personnelId: string) => {
    const selectedPerson = personnel.find((p) => p.id === personnelId);
    
    if (selectedPerson?.project_id) {
      setNewAdvanceForm({ 
        ...newAdvanceForm, 
        personnel_id: personnelId,
        project_id: selectedPerson.project_id 
      });
      
      const projectName = projects.find((p) => p.id === selectedPerson.project_id)?.name;
      if (projectName) {
        toast({
          title: "Project auto-filled",
          description: `Assigned to: ${projectName}`,
        });
      }
    } else {
      setNewAdvanceForm({ 
        ...newAdvanceForm, 
        personnel_id: personnelId,
        project_id: "" 
      });
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedPersonnel) {
      loadPersonnelAdvances(selectedPersonnel);
    }
  }, [selectedPersonnel]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [advancesData, personnelResponse, projectsResponse, statsData] = await Promise.all([
        cashAdvancesService.getAllCashAdvances(),
        personnelService.getAll(),
        projectService.getAll(),
        cashAdvancesService.getSummaryStats(),
      ]);

      console.log("Cash Advances - Personnel loaded:", personnelResponse.data?.length || 0);
      console.log("Cash Advances - Projects loaded:", projectsResponse.data?.length || 0);

      setAdvances(advancesData);
      setPersonnel(personnelResponse.data || []);
      setProjects(projectsResponse.data || []);
      setStats(statsData);
    } catch (error: any) {
      toast({
        title: "Error loading data",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const loadPersonnelAdvances = async (personnelId: string) => {
    try {
      console.log("CashAdvancesTab - Loading advances for personnel:", personnelId);
      const data = await cashAdvancesService.getCashAdvancesByPersonnel(personnelId);
      console.log("CashAdvancesTab - Advances loaded:", data);
      console.log("CashAdvancesTab - Deductions count:", data.map(a => ({ id: a.id, deductions: a.deductions.length })));
      setPersonnelAdvances(data);
    } catch (error: any) {
      console.error("CashAdvancesTab - Error loading personnel advances:", error);
      toast({
        title: "Error loading personnel advances",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleCreateAdvance = async () => {
    try {
      if (!newAdvanceForm.personnel_id || !newAdvanceForm.amount) {
        toast({
          title: "Missing fields",
          description: "Please fill in personnel and amount",
          variant: "destructive",
        });
        return;
      }

      const personnelName = personnel.find((p) => p.id === newAdvanceForm.personnel_id)?.name || "User";

      await cashAdvancesService.createCashAdvance({
        personnel_id: newAdvanceForm.personnel_id,
        project_id: newAdvanceForm.project_id || null,
        amount: parseFloat(newAdvanceForm.amount),
        date: newAdvanceForm.date,
        purpose: newAdvanceForm.purpose || undefined,
        notes: newAdvanceForm.notes || undefined,
        issued_by: personnelName,
      });

      toast({
        title: "Success",
        description: "Cash advance recorded successfully",
      });

      setNewAdvanceOpen(false);
      setNewAdvanceForm({
        personnel_id: "",
        project_id: "",
        amount: "",
        date: format(new Date(), "yyyy-MM-dd"),
        purpose: "",
        notes: "",
      });
      loadData();
      if (selectedPersonnel) {
        loadPersonnelAdvances(selectedPersonnel);
      }
    } catch (error: any) {
      toast({
        title: "Error creating advance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditAdvance = (advance: CashAdvance) => {
    setEditingAdvance(advance);
    setEditForm({
      amount: advance.amount.toString(),
      date: advance.date,
      purpose: advance.purpose || "",
      notes: advance.notes || "",
      project_id: advance.project_id || "",
    });
    setEditAdvanceOpen(true);
  };

  const handleUpdateAdvance = async () => {
    if (!editingAdvance) return;

    try {
      await cashAdvancesService.updateCashAdvance(editingAdvance.id, {
        amount: parseFloat(editForm.amount),
        date: editForm.date,
        purpose: editForm.purpose || undefined,
        notes: editForm.notes || undefined,
        project_id: editForm.project_id || null,
      });

      toast({
        title: "Success",
        description: "Cash advance updated successfully",
      });

      setEditAdvanceOpen(false);
      setEditingAdvance(null);
      loadData();
      if (selectedPersonnel) {
        loadPersonnelAdvances(selectedPersonnel);
      }
    } catch (error: any) {
      toast({
        title: "Error updating advance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeleteAdvance = async () => {
    if (!advanceToDelete) return;

    try {
      await cashAdvancesService.deleteCashAdvance(advanceToDelete);

      toast({
        title: "Success",
        description: "Cash advance deleted successfully",
      });

      setDeleteConfirmOpen(false);
      setAdvanceToDelete(null);
      loadData();
      if (selectedPersonnel) {
        loadPersonnelAdvances(selectedPersonnel);
      }
    } catch (error: any) {
      toast({
        title: "Error deleting advance",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handlePrintPersonnelReport = () => {
    if (!selectedPersonnel) return;

    const personnelData = personnel.find(p => p.id === selectedPersonnel);
    if (!personnelData) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const totalAdvances = personnelAdvances.reduce((sum, a) => sum + a.amount, 0);
    const totalDeductions = personnelAdvances.reduce((sum, a) => 
      sum + a.deductions.reduce((dSum, d) => dSum + d.amount, 0), 0);
    const totalOutstanding = personnelAdvances.reduce((sum, a) => sum + a.balance, 0);

    const advanceRows = personnelAdvances.map(advance => {
      const deductionsList = advance.deductions.map(d => 
        `<tr style="background: #f9fafb;">
          <td style="padding: 8px; border: 1px solid #ddd; padding-left: 40px;">${format(new Date(d.deduction_date), "MMM dd, yyyy")}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right; color: #dc2626;">-${formatCurrency(d.amount)}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${d.deduction_source}</td>
          <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px; color: #6b7280;">${d.notes || '-'}</td>
        </tr>`
      ).join('');

      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">${format(new Date(advance.date), "MMM dd, yyyy")}</td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">${formatCurrency(advance.amount)}</td>
          <td style="padding: 8px; border: 1px solid #ddd;"><span class="badge ${advance.status === 'active' ? 'bg-blue' : advance.status === 'fully_paid' ? 'bg-green' : 'bg-gray'}">${advance.status}</span></td>
          <td style="padding: 8px; border: 1px solid #ddd; font-size: 12px;">${advance.purpose || '-'}</td>
        </tr>
        ${deductionsList}
        <tr style="background: #e0f2fe;">
          <td colspan="2" style="padding: 8px; border: 1px solid #ddd; text-align: right; font-weight: bold;">Balance:</td>
          <td colspan="2" style="padding: 8px; border: 1px solid #ddd; font-weight: bold; color: ${advance.balance > 0 ? '#dc2626' : '#059669'};">${formatCurrency(advance.balance)}</td>
        </tr>
        <tr style="height: 10px;"><td colspan="4" style="border: none;"></td></tr>
      `;
    }).join('');

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cash Advance Report - ${personnelData.name}</title>
          <style>
            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 40px; color: #222; margin: 0; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #000; padding-bottom: 15px; }
            .header h1 { margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 1px; }
            .header p { margin: 5px 0 0 0; font-size: 14px; color: #555; }
            .info-section { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 20px 0; }
            .info-item { display: flex; }
            .label { font-weight: bold; width: 120px; }
            .value { flex: 1; }
            table { width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }
            th { background: #111; color: white; padding: 10px 8px; text-align: left; border: 1px solid #000; font-size: 11px; text-transform: uppercase; }
            .summary-box { margin-top: 30px; display: flex; justify-content: flex-end; gap: 40px; padding: 20px; background: #f9fafb; border: 1px solid #ddd; }
            .summary-item { text-align: right; }
            .summary-label { font-size: 12px; color: #6b7280; margin-bottom: 5px; }
            .summary-value { font-size: 20px; font-weight: bold; }
            .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; text-transform: uppercase; font-weight: bold; }
            .bg-blue { background: #3b82f6; color: white; }
            .bg-green { background: #10b981; color: white; }
            .bg-gray { background: #6b7280; color: white; }
            @media print {
              body { padding: 20px; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>CASH ADVANCE REPORT</h1>
            <p>Complete History of Advances and Deductions</p>
          </div>
          
          <div class="info-section">
            <div class="info-item"><div class="label">Employee:</div><div class="value">${personnelData.name}</div></div>
            <div class="info-item"><div class="label">Position:</div><div class="value">${personnelData.role || '-'}</div></div>
            <div class="info-item"><div class="label">Report Date:</div><div class="value">${format(new Date(), "MMMM dd, yyyy")}</div></div>
            <div class="info-item"><div class="label">Total Advances:</div><div class="value">${personnelAdvances.length}</div></div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th style="text-align: right;">Amount</th>
                <th>Status</th>
                <th>Purpose</th>
              </tr>
            </thead>
            <tbody>
              ${advanceRows}
            </tbody>
          </table>

          <div class="summary-box">
            <div class="summary-item">
              <div class="summary-label">Total Advances</div>
              <div class="summary-value">${formatCurrency(totalAdvances)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Deductions</div>
              <div class="summary-value" style="color: #059669;">-${formatCurrency(totalDeductions)}</div>
            </div>
            <div class="summary-item">
              <div class="summary-label">Total Outstanding</div>
              <div class="summary-value" style="color: ${totalOutstanding > 0 ? '#dc2626' : '#059669'};">${formatCurrency(totalOutstanding)}</div>
            </div>
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

  const formatCurrency = (amount: number) => {
    return `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-blue-500";
      case "fully_paid":
        return "bg-green-500";
      case "cancelled":
        return "bg-gray-500";
      default:
        return "bg-gray-500";
    }
  };

  if (loading) {
    return <div className="p-4">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Advances</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalActive}</div>
            <p className="text-xs text-muted-foreground">Currently outstanding</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Outstanding</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.totalOutstanding)}</div>
            <p className="text-xs text-muted-foreground">Across all personnel</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Personnel with Advances</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.personnelWithAdvances}</div>
            <p className="text-xs text-muted-foreground">Active borrowers</p>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 w-full lg:w-auto">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Personnel:</Label>
              <Select value={selectedPersonnel || "all"} onValueChange={(val) => setSelectedPersonnel(val === "all" ? null : val)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All personnel" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All personnel</SelectItem>
                  {personnel.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} - {p.role}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Label className="whitespace-nowrap">Project:</Label>
              <Select value={selectedProject || "all"} onValueChange={(val) => setSelectedProject(val === "all" ? null : val)}>
                <SelectTrigger className="w-full sm:w-[200px]">
                  <SelectValue placeholder="All projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All projects</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => {
              loadData();
              if (selectedPersonnel) {
                loadPersonnelAdvances(selectedPersonnel);
              }
            }}
            disabled={loading}
            className="w-full sm:w-auto"
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Dialog open={newAdvanceOpen} onOpenChange={setNewAdvanceOpen}>
          <DialogTrigger asChild>
            <Button className="w-full lg:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              New Cash Advance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Record Cash Advance</DialogTitle>
              <DialogDescription>Record a new cash advance given to a worker or staff member</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Personnel *</Label>
                <Select
                  value={newAdvanceForm.personnel_id}
                  onValueChange={handlePersonnelSelect}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={personnel.length === 0 ? "No personnel available - Add in HR first" : "Select personnel"} />
                  </SelectTrigger>
                  <SelectContent>
                    {personnel.length === 0 ? (
                      <div className="p-2 text-sm text-muted-foreground text-center">
                        No personnel found. Please add workers in the Human Resources tab first.
                      </div>
                    ) : (
                      personnel.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} - {p.role}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {personnel.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    ⚠️ You need to add personnel in the Human Resources tab before recording cash advances
                  </p>
                )}
              </div>

              <div>
                <Label>Project {newAdvanceForm.project_id && "(Auto-filled from HR)"}</Label>
                <Select
                  value={newAdvanceForm.project_id || "none"}
                  onValueChange={(val) => setNewAdvanceForm({ ...newAdvanceForm, project_id: val === "none" ? "" : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select project (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {newAdvanceForm.project_id && (
                  <p className="text-xs text-muted-foreground mt-1">
                    You can change this if needed
                  </p>
                )}
              </div>

              <div>
                <Label>Amount *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newAdvanceForm.amount}
                  onChange={(e) => setNewAdvanceForm({ ...newAdvanceForm, amount: e.target.value })}
                  placeholder="0.00"
                />
              </div>

              <div>
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={newAdvanceForm.date}
                  onChange={(e) => setNewAdvanceForm({ ...newAdvanceForm, date: e.target.value })}
                />
              </div>

              <div>
                <Label>Purpose</Label>
                <Input
                  value={newAdvanceForm.purpose}
                  onChange={(e) => setNewAdvanceForm({ ...newAdvanceForm, purpose: e.target.value })}
                  placeholder="e.g., Emergency, Travel, etc."
                />
              </div>

              <div>
                <Label>Notes</Label>
                <Textarea
                  value={newAdvanceForm.notes}
                  onChange={(e) => setNewAdvanceForm({ ...newAdvanceForm, notes: e.target.value })}
                  placeholder="Additional notes..."
                  rows={3}
                />
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNewAdvanceOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateAdvance}>Record Advance</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Edit Advance Dialog */}
      <Dialog open={editAdvanceOpen} onOpenChange={setEditAdvanceOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Cash Advance</DialogTitle>
            <DialogDescription>Update cash advance details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Amount *</Label>
              <Input
                type="number"
                step="0.01"
                value={editForm.amount}
                onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div>
              <Label>Date *</Label>
              <Input
                type="date"
                value={editForm.date}
                onChange={(e) => setEditForm({ ...editForm, date: e.target.value })}
              />
            </div>

            <div>
              <Label>Project</Label>
              <Select
                value={editForm.project_id || "none"}
                onValueChange={(val) => setEditForm({ ...editForm, project_id: val === "none" ? "" : val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select project (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Purpose</Label>
              <Input
                value={editForm.purpose}
                onChange={(e) => setEditForm({ ...editForm, purpose: e.target.value })}
                placeholder="e.g., Emergency, Travel, etc."
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                value={editForm.notes}
                onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                placeholder="Additional notes..."
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditAdvanceOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleUpdateAdvance}>Save Changes</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Cash Advance</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this cash advance? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteAdvance}>
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content */}
      {selectedPersonnel ? (
        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <div>
                <CardTitle>
                  Cash Advance History - {personnel.find((p) => p.id === selectedPersonnel)?.name}
                </CardTitle>
                <CardDescription>Complete history of advances and deductions</CardDescription>
              </div>
              <Button onClick={handlePrintPersonnelReport} variant="outline">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
                  <polyline points="6 9 6 2 18 2 18 9"/>
                  <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
                  <rect width="12" height="8" x="6" y="14"/>
                </svg>
                Print Report
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {personnelAdvances.map((advance) => (
                <div key={advance.id} className="border rounded-lg p-4">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-sm sm:text-base">
                          {formatCurrency(advance.amount)} - {format(new Date(advance.date), "MMM dd, yyyy")}
                        </h3>
                        <Badge className={getStatusColor(advance.status)}>{advance.status}</Badge>
                      </div>
                      {advance.purpose && <p className="text-sm text-muted-foreground mt-1">{advance.purpose}</p>}
                      {advance.project && (
                        <p className="text-sm text-muted-foreground">Project: {advance.project.name}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-2">
                      <div className="text-right">
                        <div className="text-xs sm:text-sm text-muted-foreground">Outstanding:</div>
                        <div className="text-base sm:text-lg font-bold">{formatCurrency(advance.balance)}</div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => handleEditAdvance(advance)}
                          title="Edit"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                            <path d="m15 5 4 4"/>
                          </svg>
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => {
                            setAdvanceToDelete(advance.id);
                            setDeleteConfirmOpen(true);
                          }}
                          title="Delete"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18"/>
                            <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                            <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                          </svg>
                        </Button>
                      </div>
                    </div>
                  </div>

                  {advance.deductions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Deduction History:</h4>
                      <div className="overflow-x-auto -mx-4 px-4">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Date</TableHead>
                              <TableHead>Amount</TableHead>
                              <TableHead>Source</TableHead>
                              <TableHead>Notes</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {advance.deductions.map((deduction) => (
                              <TableRow key={deduction.id}>
                                <TableCell>{format(new Date(deduction.deduction_date), "MMM dd, yyyy")}</TableCell>
                                <TableCell>{formatCurrency(deduction.amount)}</TableCell>
                                <TableCell className="capitalize">{deduction.deduction_source}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{deduction.notes || "-"}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {personnelAdvances.length === 0 && (
                <div className="text-center text-muted-foreground py-8">No cash advances found for this personnel</div>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>All Cash Advances</CardTitle>
            <CardDescription>
              {selectedProject 
                ? `Cash advances for ${projects.find(p => p.id === selectedProject)?.name || "selected project"}`
                : "Recent cash advances across all personnel"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto -mx-4 sm:mx-0">
              <div className="inline-block min-w-full align-middle">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap">Date</TableHead>
                      <TableHead className="whitespace-nowrap">Personnel</TableHead>
                      <TableHead className="whitespace-nowrap">Project</TableHead>
                      <TableHead className="whitespace-nowrap">Amount</TableHead>
                      <TableHead className="whitespace-nowrap">Balance</TableHead>
                      <TableHead className="whitespace-nowrap">Status</TableHead>
                      <TableHead className="whitespace-nowrap">Purpose</TableHead>
                      <TableHead className="text-center whitespace-nowrap">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {advances
                      .filter((advance) => !selectedProject || advance.project_id === selectedProject)
                      .map((advance) => (
                      <TableRow key={advance.id}>
                        <TableCell className="whitespace-nowrap">{format(new Date(advance.date), "MMM dd, yyyy")}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <div>
                            <div className="font-medium">{advance.personnel?.name}</div>
                            <div className="text-sm text-muted-foreground">{advance.personnel?.role}</div>
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{advance.project?.name || "-"}</TableCell>
                        <TableCell className="whitespace-nowrap">{formatCurrency(advance.amount)}</TableCell>
                        <TableCell className="font-semibold whitespace-nowrap">{formatCurrency(advance.balance)}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          <Badge className={getStatusColor(advance.status)}>{advance.status}</Badge>
                        </TableCell>
                        <TableCell className="text-sm max-w-[200px] truncate">{advance.purpose || "-"}</TableCell>
                        <TableCell>
                          <div className="flex justify-center gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              onClick={() => handleEditAdvance(advance)}
                              title="Edit"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                <path d="m15 5 4 4"/>
                              </svg>
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => {
                                setAdvanceToDelete(advance.id);
                                setDeleteConfirmOpen(true);
                              }}
                              title="Delete"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18"/>
                                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/>
                                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                              </svg>
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {advances.length === 0 && (
              <div className="text-center text-muted-foreground py-8">No cash advances recorded yet</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}