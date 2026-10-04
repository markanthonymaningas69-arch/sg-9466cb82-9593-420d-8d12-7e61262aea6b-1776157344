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
  const [personnelAdvances, setPersonnelAdvances] = useState<CashAdvanceWithDeductions[]>([]);
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalActive: 0, totalOutstanding: 0, personnelWithAdvances: 0 });

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
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Label>View by Personnel:</Label>
          <Select value={selectedPersonnel || "all"} onValueChange={(val) => setSelectedPersonnel(val === "all" ? null : val)}>
            <SelectTrigger className="w-[300px]">
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
          >
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>

        <Dialog open={newAdvanceOpen} onOpenChange={setNewAdvanceOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Cash Advance
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
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

      {/* Main Content */}
      {selectedPersonnel ? (
        <Card>
          <CardHeader>
            <CardTitle>
              Cash Advance History - {personnel.find((p) => p.id === selectedPersonnel)?.name}
            </CardTitle>
            <CardDescription>Complete history of advances and deductions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {personnelAdvances.map((advance) => (
                <div key={advance.id} className="border rounded-lg p-4">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
                          {formatCurrency(advance.amount)} - {format(new Date(advance.date), "MMM dd, yyyy")}
                        </h3>
                        <Badge className={getStatusColor(advance.status)}>{advance.status}</Badge>
                      </div>
                      {advance.purpose && <p className="text-sm text-muted-foreground mt-1">{advance.purpose}</p>}
                      {advance.project && (
                        <p className="text-sm text-muted-foreground">Project: {advance.project.name}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Outstanding:</div>
                      <div className="text-lg font-bold">{formatCurrency(advance.balance)}</div>
                    </div>
                  </div>

                  {advance.deductions.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-semibold mb-2">Deduction History:</h4>
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
            <CardDescription>Recent cash advances across all personnel</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Personnel</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Purpose</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {advances.map((advance) => (
                  <TableRow key={advance.id}>
                    <TableCell>{format(new Date(advance.date), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{advance.personnel?.name}</div>
                        <div className="text-sm text-muted-foreground">{advance.personnel?.role}</div>
                      </div>
                    </TableCell>
                    <TableCell>{advance.project?.name || "-"}</TableCell>
                    <TableCell>{formatCurrency(advance.amount)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(advance.balance)}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(advance.status)}>{advance.status}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">{advance.purpose || "-"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {advances.length === 0 && (
              <div className="text-center text-muted-foreground py-8">No cash advances recorded yet</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}