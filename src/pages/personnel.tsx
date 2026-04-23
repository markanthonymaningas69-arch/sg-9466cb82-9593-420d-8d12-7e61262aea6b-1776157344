import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { personnelService } from "@/services/personnelService";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2, Archive, UserCheck, Calendar, DollarSign, Clock, FileText as PassportIcon, AlertCircle, Check } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useSettings } from "@/contexts/SettingsProvider";
import { supabase } from "@/integrations/supabase/client";
import { ManpowerRateCatalogTab } from "@/components/personnel/ManpowerRateCatalogTab";
import { PositionRateSelector } from "@/components/personnel/PositionRateSelector";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: "full_time", label: "Full-time" },
  { value: "contract", label: "Contract" },
  { value: "daily", label: "Daily" },
] as const;

function readRateSnapshot(person: any) {
  if (!person?.rate_snapshot || typeof person.rate_snapshot !== "object" || Array.isArray(person.rate_snapshot)) {
    return null;
  }

  const snapshot = person.rate_snapshot as Record<string, unknown>;

  return {
    category: snapshot.category === "office" ? "office" : "construction",
    dailyRate: Number(snapshot.daily_rate || 0),
    hourlyRate: Number(snapshot.hourly_rate || 0),
    overtimeRate: Number(snapshot.overtime_rate || 0),
    currency: typeof snapshot.currency === "string" ? snapshot.currency : "",
  };
}

export default function Personnel() {
  const { currency, isLocked } = useSettings();
  const [workerFilter, setWorkerFilter] = useState<"office" | "construction">("construction");
  const [activeTab, setActiveTab] = useState("personnel");

  const [personnel, setPersonnel] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [visas, setVisas] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [visaDialogOpen, setVisaDialogOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);

  // Attendance Date Filters
  const [attStartDate, setAttStartDate] = useState(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [attEndDate, setAttEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [minDaysWorked, setMinDaysWorked] = useState<string>("");
  const [minDaysAbsent, setMinDaysAbsent] = useState<string>("");
  
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    position_id: "",
    project_id: "",
    phone: "",
    email: "",
    hourly_rate: "",
    daily_rate: "",
    overtime_rate: "",
    rate_currency: currency,
    status: "active" as const,
    worker_type: "construction" as "construction" | "office",
    employment_type: "full_time" as "full_time" | "contract" | "daily",
    hire_date: new Date().toISOString().split("T")[0]
  });

  const [otFactor, setOtFactor] = useState<number>(1.25);
  const [isManualRole, setIsManualRole] = useState(false);
  const STANDARD_ROLES = ["Admin", "Carpenter", "Electrician", "Helper", "Mason", "Plumber", "Skilled", "Steelman", "Tile Mason", "Welder"];

  const [attendanceForm, setAttendanceForm] = useState({
    personnel_id: "",
    date: new Date().toISOString().split("T")[0],
    status: "present" as const,
    hours_worked: "8",
    overtime_hours: "0",
    notes: ""
  });

  const [leaveForm, setLeaveForm] = useState({
    personnel_id: "",
    leave_type: "vacation" as const,
    start_date: new Date().toISOString().split("T")[0],
    end_date: new Date().toISOString().split("T")[0],
    reason: "",
    status: "pending" as const
  });

  const [visaForm, setVisaForm] = useState({
    personnel_id: "",
    visa_number: "",
    visa_issue_date: "",
    visa_expiry_date: "",
    passport_number: "",
    passport_issue_date: "",
    passport_expiry_date: "",
    country: "",
  });

  const pendingLeaveIds = leaveRequests.filter(l => l.status === 'pending').map(l => l.id).sort().join(',');
  const [seenLeaveIds, setSeenLeaveIds] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('seenLeaveIds') || "" : "");

  useEffect(() => {
    if (activeTab === 'leave') {
      setSeenLeaveIds(pendingLeaveIds);
      if (typeof window !== 'undefined') localStorage.setItem('seenLeaveIds', pendingLeaveIds);
    }
  }, [activeTab, pendingLeaveIds]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [personnelData, projectsData, attendanceData, leaveData, visaData, catalogItems] = await Promise.all([
      personnelService.getAll(),
      projectService.getAll(),
      personnelService.getAttendance(attStartDate, attEndDate),
      personnelService.getLeaveRequests(),
      personnelService.getVisas(),
      manpowerRateCatalogService.getAll().catch(() => []),
    ]);
    
    setPersonnel(personnelData.data || []);
    setProjects(projectsData.data || []);
    setAttendance(attendanceData.data || []);
    setLeaveRequests(leaveData.data || []);
    setVisas(visaData.data || []);
    setRateCatalogItems(catalogItems);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const personnelData = {
      name: formData.name,
      role: formData.role,
      project_id: formData.project_id || null,
      phone: formData.phone,
      email: formData.email,
      status: formData.status,
      worker_type: formData.worker_type,
      hire_date: formData.hire_date,
      hourly_rate: parseFloat(formData.hourly_rate) || 0,
      daily_rate: parseFloat(formData.daily_rate) || 0,
      overtime_rate: parseFloat(formData.overtime_rate) || 0,
    };

    if (formData.worker_type === "construction") {
      personnelData.hourly_rate = (parseFloat(formData.daily_rate) || 0) / 8;
    } else {
      personnelData.daily_rate = (parseFloat(formData.hourly_rate) || 0) * 8;
    }

    if (editingPersonnel) {
      await personnelService.update(editingPersonnel.id, personnelData);
    } else {
      await personnelService.create(personnelData);
    }
    setDialogOpen(false);
    resetForm();
    loadData();
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await personnelService.markAttendance({
      ...attendanceForm,
      hours_worked: parseFloat(attendanceForm.hours_worked),
      overtime_hours: parseFloat(attendanceForm.overtime_hours)
    });
    setAttendanceDialogOpen(false);
    resetAttendanceForm();
    loadData();
  };

  const handleLeaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const start = new Date(leaveForm.start_date);
    const end = new Date(leaveForm.end_date);
    const days_requested = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1);

    await personnelService.createLeaveRequest({ 
      ...leaveForm, 
      days_requested 
    });
    setLeaveDialogOpen(false);
    resetLeaveForm();
    loadData();
  };

  const handleVisaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await personnelService.addVisa({
      ...visaForm,
      issue_date: visaForm.visa_issue_date || visaForm.passport_issue_date || new Date().toISOString(),
      expiry_date: visaForm.visa_expiry_date || visaForm.passport_expiry_date || new Date().toISOString()
    });
    setVisaDialogOpen(false);
    resetVisaForm();
    loadData();
  };

  const handleEdit = (person: any) => {
    const rateSnapshot = readRateSnapshot(person);
    const rateCurrency = rateSnapshot?.currency || currency;

    setEditingPersonnel(person);
    setFormData({
      name: person.name,
      role: person.role,
      position_id: person.position_id || "",
      project_id: person.project_id || "",
      phone: person.phone || "",
      email: person.email || "",
      hourly_rate: String(rateSnapshot?.hourlyRate ?? person.hourly_rate ?? ""),
      daily_rate: String(rateSnapshot?.dailyRate ?? person.daily_rate ?? ""),
      overtime_rate: String(rateSnapshot?.overtimeRate ?? person.overtime_rate ?? ""),
      rate_currency: rateCurrency,
      status: (person.status === "on_leave" ? "on-leave" : person.status) as any,
      worker_type: (rateSnapshot?.category || person.worker_type || "construction") as any,
      employment_type: (person.employment_type || "full_time") as any,
      hire_date: person.hire_date || new Date().toISOString().split("T")[0]
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to archive this personnel?")) {
      await personnelService.delete(id);
      loadData();
    }
  };

  const handleDeleteLeave = async (id: string) => {
    if (confirm("Are you sure you want to archive this leave request?")) {
      await personnelService.deleteLeaveRequest(id);
      loadData();
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      role: "",
      position_id: "",
      project_id: "",
      phone: "",
      email: "",
      hourly_rate: "",
      daily_rate: "",
      overtime_rate: "",
      rate_currency: currency,
      status: "active",
      worker_type: "construction",
      employment_type: "full_time",
      hire_date: new Date().toISOString().split("T")[0]
    });
    setEditingPersonnel(null);
  };

  const resetAttendanceForm = () => {
    setAttendanceForm({
      personnel_id: "",
      date: new Date().toISOString().split("T")[0],
      status: "present",
      hours_worked: "8",
      overtime_hours: "0",
      notes: ""
    });
  };

  const resetLeaveForm = () => {
    setLeaveForm({
      personnel_id: "",
      leave_type: "vacation",
      start_date: new Date().toISOString().split("T")[0],
      end_date: new Date().toISOString().split("T")[0],
      reason: "",
      status: "pending"
    });
  };

  const resetVisaForm = () => {
    setVisaForm({
      personnel_id: "",
      visa_number: "",
      visa_issue_date: "",
      visa_expiry_date: "",
      passport_number: "",
      passport_issue_date: "",
      passport_expiry_date: "",
      country: "",
    });
  };

  const statusColors: Record<string, string> = {
    active: "bg-green-100 text-green-800",
    on_leave: "bg-yellow-100 text-yellow-800",
    inactive: "bg-gray-100 text-gray-800",
    present: "bg-green-100 text-green-800",
    absent: "bg-red-100 text-red-800",
    late: "bg-yellow-100 text-yellow-800",
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    paid: "bg-green-100 text-green-800"
  };

  // Filter Data Arrays by Worker Type
  const filteredPersonnel = personnel.filter(p => (p.worker_type || 'construction') === workerFilter);
  const filteredAttendance = attendance.filter(a => (a.personnel?.worker_type || 'construction') === workerFilter);
  const filteredLeaveRequests = leaveRequests.filter(l => (l.personnel?.worker_type || 'construction') === workerFilter);
  const filteredVisas = visas.filter(v => (v.personnel?.worker_type || 'construction') === workerFilter);

  const expiringDocuments = visas.filter(record => {
    if (record.status === 'noted') return false;
    const daysToPassportExpiry = record.passport_expiry_date ? Math.ceil((new Date(record.passport_expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : Infinity;
    const daysToVisaExpiry = record.visa_expiry_date ? Math.ceil((new Date(record.visa_expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : Infinity;
    return daysToPassportExpiry <= 30 || daysToVisaExpiry <= 30;
  });

  const handleCheckVisa = async (id: string) => {
    await supabase.from('personnel_visas').update({ status: 'noted' }).eq('id', id);
    loadData();
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold">Personnel Management</h1>
            <p className="text-muted-foreground mt-1">Manage construction workforce</p>
          </div>
          
          <div className="bg-muted p-1 rounded-lg flex">
            <button
              onClick={() => setWorkerFilter("office")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                workerFilter === "office" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Office Staff
            </button>
            <button
              onClick={() => setWorkerFilter("construction")}
              className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                workerFilter === "construction" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Construction Workers
            </button>
          </div>
        </div>

        {currency !== "PHP" && expiringDocuments.length > 0 && (
          <Alert variant="destructive" className="bg-red-50 text-red-900 border-red-200">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800 font-bold">Document Expiry Warning</AlertTitle>
            <AlertDescription className="text-red-700">
              <strong>{expiringDocuments.length}</strong> employee(s) have passports or visas that are expired or expiring within 30 days. Please review the Visa & Passport tab immediately.
            </AlertDescription>
          </Alert>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="shrink-0 flex flex-wrap w-full gap-1 h-auto bg-transparent p-0">
            <TabsTrigger value="personnel" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100">
              <UserCheck className="h-3 w-3 mr-1.5 hidden sm:inline" />
              Staff
            </TabsTrigger>
            <TabsTrigger value="rates" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-violet-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-violet-700 bg-violet-50 text-violet-700 hover:bg-violet-100">
              <DollarSign className="h-3 w-3 mr-1.5 hidden sm:inline" />
              Rates
            </TabsTrigger>
            <TabsTrigger value="attendance" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-indigo-700 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
              <Clock className="h-3 w-3 mr-1.5 hidden sm:inline" />
              Time
            </TabsTrigger>
            <TabsTrigger value="leave" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-emerald-700 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 relative">
              <Calendar className="h-3 w-3 mr-1.5 hidden sm:inline" />
              Leave
              {(() => {
                const hasNewLeaves = pendingLeaveIds !== seenLeaveIds && activeTab !== 'leave';
                const pendingCount = leaveRequests.filter(l => l.status === 'pending').length;
                if (hasNewLeaves && pendingCount > 0) {
                  return (
                    <Badge variant="destructive" className="ml-1 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[9px] absolute -top-1 -right-1">
                      New
                    </Badge>
                  );
                }
                return null;
              })()}
            </TabsTrigger>
            {currency !== "PHP" && (
              <TabsTrigger value="visa" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-amber-700 bg-amber-50 text-amber-700 hover:bg-amber-100">
                <PassportIcon className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Visa
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="personnel" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm} disabled={isLocked} className="w-full sm:w-auto">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Personnel
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingPersonnel ? "Edit Personnel" : "Add New Personnel"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name *</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="worker_type">Worker Type *</Label>
                        <Select value={formData.worker_type} onValueChange={(value: any) => setFormData({ ...formData, worker_type: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="office">Office Staff</SelectItem>
                            <SelectItem value="construction">Construction Worker</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="role">Position / Role *</Label>
                        {formData.worker_type === "construction" && !isManualRole ? (
                          <Select
                            value={formData.role}
                            onValueChange={(val) => {
                              if (val === "others") {
                                setIsManualRole(true);
                                setFormData({ ...formData, role: "" });
                              } else {
                                setFormData({ ...formData, role: val });
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select position" />
                            </SelectTrigger>
                            <SelectContent>
                              {STANDARD_ROLES.map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                              <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="flex gap-2">
                            <Input
                              id="role"
                              value={formData.role}
                              onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                              placeholder={formData.worker_type === "office" ? "e.g., Site Engineer" : "Custom position"}
                              required
                            />
                            {formData.worker_type === "construction" && isManualRole && (
                              <Button type="button" variant="outline" className="px-2" onClick={() => {
                                setIsManualRole(false);
                                setFormData({ ...formData, role: "" });
                              }}>
                                List
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="project_id">Assigned Project</Label>
                        <Select value={formData.project_id} onValueChange={(value) => setFormData({ ...formData, project_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select project" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="">Unassigned</SelectItem>
                            {projects.map((project) => (
                              <SelectItem key={project.id} value={project.id}>
                                {project.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="status">Status</Label>
                        <Select value={formData.status} onValueChange={(value: any) => setFormData({ ...formData, status: value })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Active</SelectItem>
                            <SelectItem value="on_leave">On Leave</SelectItem>
                            <SelectItem value="inactive">Inactive</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="hire_date">Hire Date *</Label>
                        <Input
                          id="hire_date"
                          type="date"
                          value={formData.hire_date}
                          onChange={(e) => setFormData({ ...formData, hire_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Contact Number</Label>
                        <Input
                          id="phone"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        />
                      </div>
                    </div>
                    
                    {formData.worker_type === "office" ? (
                      <div className="space-y-2 w-1/2 pr-2">
                        <Label htmlFor="hourly_rate">Hourly Rate ({currency})</Label>
                        <Input
                          id="hourly_rate"
                          type="number"
                          step="0.01"
                          value={formData.hourly_rate}
                          onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-4 border-t pt-4">
                        <div className="space-y-2">
                          <Label>Daily Rate ({currency})</Label>
                          <Input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.daily_rate}
                            onChange={(e) => {
                              const rate = parseFloat(e.target.value) || 0;
                              setFormData({ 
                                ...formData, 
                                daily_rate: e.target.value,
                                overtime_rate: ((rate / 8) * otFactor).toFixed(2)
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>OT Factor</Label>
                          <Select value={otFactor.toString()} onValueChange={(val) => {
                            const factor = parseFloat(val);
                            setOtFactor(factor);
                            const rate = parseFloat(formData.daily_rate) || 0;
                            setFormData(prev => ({
                              ...prev,
                              overtime_rate: ((rate / 8) * factor).toFixed(2)
                            }));
                          }}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">1.0x (Regular)</SelectItem>
                              <SelectItem value="1.25">1.25x (Standard OT)</SelectItem>
                              <SelectItem value="1.3">1.3x (Special/Rest)</SelectItem>
                              <SelectItem value="1.5">1.5x (Night Shift)</SelectItem>
                              <SelectItem value="2">2.0x (Double Pay)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Overtime Rate ({currency}/hr)</Label>
                          <Input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={formData.overtime_rate}
                            onChange={(e) => setFormData({ ...formData, overtime_rate: e.target.value })}
                          />
                        </div>
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingPersonnel ? "Update" : "Add"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>{workerFilter === 'office' ? 'Office Staff' : 'Construction Workers'}</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPersonnel.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell>{person.role}</TableCell>
                        <TableCell>{person.projects?.name || "Unassigned"}</TableCell>
                        <TableCell>{person.phone || "-"}</TableCell>
                        <TableCell>
                          {workerFilter === 'office' 
                            ? `${currency} ${person.hourly_rate?.toLocaleString() || 0}/hr`
                            : `${currency} ${person.daily_rate?.toLocaleString() || 0}/day`
                          }
                        </TableCell>
                        <TableCell>
                          <Badge className={statusColors[person.status] || "bg-gray-100 text-gray-800"}>
                            {person.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] bg-muted/50">
                            {person.updated_source || person.created_source || 'Human Resources'}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(person)} disabled={isLocked}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(person.id)} title="Archive" disabled={isLocked}>
                              <Archive className="h-4 w-4 text-orange-600" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPersonnel.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-6 text-muted-foreground">
                          No {workerFilter === 'office' ? 'office staff' : 'construction workers'} found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rates" className="space-y-4">
            <ManpowerRateCatalogTab />
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 bg-muted/50 p-1 rounded-md">
                <div className="flex items-center gap-2">
                  <Input
                    type="date"
                    value={attStartDate}
                    onChange={(e) => setAttStartDate(e.target.value)}
                    className="h-9 w-36"
                  />
                  <span className="text-muted-foreground text-sm px-1">to</span>
                  <Input
                    type="date"
                    value={attEndDate}
                    onChange={(e) => setAttEndDate(e.target.value)}
                    className="h-9 w-36"
                  />
                </div>
                <div className="h-6 w-px bg-border mx-2 hidden sm:block"></div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Min. Worked:</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Days"
                    value={minDaysWorked}
                    onChange={(e) => setMinDaysWorked(e.target.value)}
                    className="h-9 w-20"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">Min. Absent:</Label>
                  <Input
                    type="number"
                    min="0"
                    placeholder="Days"
                    value={minDaysAbsent}
                    onChange={(e) => setMinDaysAbsent(e.target.value)}
                    className="h-9 w-20"
                  />
                </div>
                {(attStartDate || attEndDate || minDaysWorked || minDaysAbsent) && (
                  <Button variant="ghost" size="sm" onClick={() => {
                    setAttStartDate(""); setAttEndDate(""); setMinDaysWorked(""); setMinDaysAbsent("");
                  }} className="text-muted-foreground h-9 ml-1">
                    Clear Filters
                  </Button>
                )}
                <Button variant="secondary" onClick={loadData} className="h-9 ml-auto">Refresh</Button>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personnel</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Days Worked</TableHead>
                      <TableHead>Days Absent</TableHead>
                      <TableHead>Total Regular Hours</TableHead>
                      <TableHead>Total Overtime</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPersonnel.map((person) => {
                      const records = filteredAttendance.filter(a => a.personnel_id === person.id);
                      const daysWorked = records.filter(a => ['present', 'half_day', 'late'].includes(a.status)).length;
                      const daysAbsent = records.filter(a => a.status === 'absent').length;
                      const totalHours = records.reduce((sum, a) => sum + (Number(a.hours_worked) || 0), 0);
                      const totalOvertime = records.reduce((sum, a) => sum + (Number(a.overtime_hours) || 0), 0);

                      if (daysWorked === 0 && daysAbsent === 0) return null;
                      
                      if (minDaysWorked && daysWorked < parseInt(minDaysWorked)) return null;
                      if (minDaysAbsent && daysAbsent < parseInt(minDaysAbsent)) return null;

                      return (
                        <TableRow key={person.id}>
                          <TableCell className="font-medium">{person.name}</TableCell>
                          <TableCell>{person.role}</TableCell>
                          <TableCell className="font-semibold text-green-600">{daysWorked}</TableCell>
                          <TableCell className="font-semibold text-red-600">{daysAbsent}</TableCell>
                          <TableCell>{totalHours}h</TableCell>
                          <TableCell>{totalOvertime}h</TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No attendance records found for this period.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="leave" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={leaveDialogOpen} onOpenChange={setLeaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetLeaveForm} disabled={isLocked}>
                    <Plus className="h-4 w-4 mr-2" />
                    New Leave Request
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>New Leave Request</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleLeaveSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="leave_personnel">Personnel *</Label>
                      <Select value={leaveForm.personnel_id} onValueChange={(value) => setLeaveForm({ ...leaveForm, personnel_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select personnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredPersonnel.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name} - {person.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="leave_type">Leave Type *</Label>
                      <Select value={leaveForm.leave_type} onValueChange={(value: any) => setLeaveForm({ ...leaveForm, leave_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vacation">Vacation</SelectItem>
                          <SelectItem value="sick">Sick Leave</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                          <SelectItem value="unpaid">Unpaid</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="start_date">Start Date *</Label>
                        <Input
                          id="start_date"
                          type="date"
                          value={leaveForm.start_date}
                          onChange={(e) => setLeaveForm({ ...leaveForm, start_date: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="end_date">End Date *</Label>
                        <Input
                          id="end_date"
                          type="date"
                          value={leaveForm.end_date}
                          onChange={(e) => setLeaveForm({ ...leaveForm, end_date: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="reason">Reason *</Label>
                      <Textarea
                        id="reason"
                        value={leaveForm.reason}
                        onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                        required
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setLeaveDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Submit</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Leave Requests</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personnel</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Start Date</TableHead>
                      <TableHead>End Date</TableHead>
                      <TableHead>Days</TableHead>
                      <TableHead>Reason</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeaveRequests.map((leave) => (
                      <TableRow key={leave.id}>
                        <TableCell className="font-medium">{leave.personnel?.name}</TableCell>
                        <TableCell className="capitalize">{leave.leave_type}</TableCell>
                        <TableCell>{new Date(leave.start_date).toLocaleDateString()}</TableCell>
                        <TableCell>{new Date(leave.end_date).toLocaleDateString()}</TableCell>
                        <TableCell>{leave.days_requested}</TableCell>
                        <TableCell className="max-w-xs truncate">{leave.reason}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[leave.status]}>
                            {leave.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button size="icon" variant="ghost" onClick={() => handleDeleteLeave(leave.id)} title="Archive" disabled={isLocked}>
                            <Archive className="h-4 w-4 text-orange-600" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLeaveRequests.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                          No leave requests found.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {currency !== "PHP" && (
            <TabsContent value="visa" className="space-y-4">
              <div className="flex justify-end">
                <Dialog open={visaDialogOpen} onOpenChange={setVisaDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={resetVisaForm} disabled={isLocked}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Document Record
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-2xl">
                    <DialogHeader>
                      <DialogTitle>Add Visa & Passport Record</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleVisaSubmit} className="space-y-4">
                      <div className="space-y-2 md:w-1/2 pr-4">
                        <Label htmlFor="visa_personnel">Personnel *</Label>
                        <Select value={visaForm.personnel_id} onValueChange={(value) => setVisaForm({ ...visaForm, personnel_id: value })}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select personnel" />
                          </SelectTrigger>
                          <SelectContent>
                            {filteredPersonnel.map((person) => (
                              <SelectItem key={person.id} value={person.id}>
                                {person.name} - {person.role}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="grid grid-cols-2 gap-8 border-t pt-4 mt-2">
                        {/* Passport Details */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-sm text-primary">Passport Details</h4>
                          <div className="space-y-2">
                            <Label htmlFor="passport_number">Passport Number</Label>
                            <Input
                              id="passport_number"
                              value={visaForm.passport_number}
                              onChange={(e) => setVisaForm({ ...visaForm, passport_number: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="passport_issue_date">Issue Date</Label>
                            <Input
                              id="passport_issue_date"
                              type="date"
                              value={visaForm.passport_issue_date}
                              onChange={(e) => setVisaForm({ ...visaForm, passport_issue_date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="passport_expiry_date">Expiry Date</Label>
                            <Input
                              id="passport_expiry_date"
                              type="date"
                              value={visaForm.passport_expiry_date}
                              onChange={(e) => setVisaForm({ ...visaForm, passport_expiry_date: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* Visa Details */}
                        <div className="space-y-4">
                          <h4 className="font-semibold text-sm text-primary">Visa Details</h4>
                          <div className="space-y-2">
                            <Label htmlFor="visa_number">Visa Number</Label>
                            <Input
                              id="visa_number"
                              value={visaForm.visa_number}
                              onChange={(e) => setVisaForm({ ...visaForm, visa_number: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="visa_issue_date">Issue Date</Label>
                            <Input
                              id="visa_issue_date"
                              type="date"
                              value={visaForm.visa_issue_date}
                              onChange={(e) => setVisaForm({ ...visaForm, visa_issue_date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="visa_expiry_date">Expiry Date</Label>
                            <Input
                              id="visa_expiry_date"
                              type="date"
                              value={visaForm.visa_expiry_date}
                              onChange={(e) => setVisaForm({ ...visaForm, visa_expiry_date: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-2 pt-4 border-t">
                        <Button type="button" variant="outline" onClick={() => setVisaDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Save Record</Button>
                      </div>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Visa & Passport Tracking</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Personnel</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Passport No.</TableHead>
                        <TableHead>Passport Expiry</TableHead>
                        <TableHead>Visa No.</TableHead>
                        <TableHead>Visa Expiry</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisas.map((record) => {
                        const daysToPassportExpiry = record.passport_expiry_date ? Math.ceil((new Date(record.passport_expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : Infinity;
                        const daysToVisaExpiry = record.visa_expiry_date ? Math.ceil((new Date(record.visa_expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24)) : Infinity;
                        
                        const minDays = Math.min(daysToPassportExpiry, daysToVisaExpiry);
                        
                        let statusColor = "bg-green-100 text-green-800";
                        let statusText = "Active";
                        
                        if (minDays < 0) {
                          if (record.status === 'noted') {
                            statusColor = "bg-gray-100 text-gray-800";
                            statusText = "Expired / Noted";
                          } else {
                            statusColor = "bg-red-100 text-red-800";
                            statusText = "Expired";
                          }
                        } else if (minDays <= 30) {
                          if (record.status === 'noted') {
                            statusColor = "bg-gray-100 text-gray-800";
                            statusText = "Expiring Soon / Noted";
                          } else {
                            statusColor = "bg-orange-100 text-orange-800";
                            statusText = "Expiring Soon";
                          }
                        }

                        return (
                          <TableRow key={record.id} className={minDays <= 30 && record.status !== 'noted' ? "bg-red-50/50" : ""}>
                            <TableCell className="font-medium">{record.personnel?.name}</TableCell>
                            <TableCell>{record.country}</TableCell>
                            <TableCell className="font-mono text-sm">{record.passport_number || "-"}</TableCell>
                            <TableCell className={daysToPassportExpiry <= 30 && record.status !== 'noted' ? "text-red-700 font-bold bg-red-100/50" : ""}>
                              {record.passport_expiry_date ? new Date(record.passport_expiry_date).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell className="font-mono text-sm">{record.visa_number || "-"}</TableCell>
                            <TableCell className={daysToVisaExpiry <= 30 && record.status !== 'noted' ? "text-red-700 font-bold bg-red-100/50" : ""}>
                              {record.visa_expiry_date ? new Date(record.visa_expiry_date).toLocaleDateString() : "-"}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColor}>{statusText}</Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              {minDays <= 30 && record.status !== 'noted' && (
                                <Button size="sm" variant="outline" className="h-7 border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100" onClick={() => handleCheckVisa(record.id)} disabled={isLocked}>
                                  <Check className="h-3 w-3 mr-1" /> Check
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredVisas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">
                            No documents found.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          )}

        </Tabs>
      </div>
    </Layout>
  );
}