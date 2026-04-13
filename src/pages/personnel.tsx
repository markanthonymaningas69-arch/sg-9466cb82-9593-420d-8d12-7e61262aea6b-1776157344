import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { personnelService } from "@/services/personnelService";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2, UserCheck, Calendar, DollarSign, Clock, FileText as PassportIcon } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";
import { useSettings } from "@/contexts/SettingsProvider";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function Personnel() {
  const { currency } = useSettings();
  const [workerFilter, setWorkerFilter] = useState<"office" | "construction">("construction");

  const [personnel, setPersonnel] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [visas, setVisas] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [visaDialogOpen, setVisaDialogOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    project_id: "",
    phone: "",
    email: "",
    hourly_rate: "",
    daily_rate: "",
    overtime_rate: "",
    status: "active" as const,
    worker_type: "construction" as "construction" | "office",
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

  const [payrollForm, setPayrollForm] = useState({
    personnel_id: "",
    pay_period_start: new Date().toISOString().substring(0, 8) + "01",
    pay_period_end: new Date().toISOString().split("T")[0],
    regular_hours: "160",
    overtime_hours: "0",
    deductions: "0",
    status: "pending" as const
  });

  const [visaForm, setVisaForm] = useState({
    personnel_id: "",
    visa_number: "",
    country: "",
    issue_date: new Date().toISOString().split("T")[0],
    expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0]
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [personnelData, projectsData, attendanceData, leaveData, payrollData, visaData] = await Promise.all([
      personnelService.getAll(),
      projectService.getAll(),
      personnelService.getAttendance(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        new Date().toISOString().split("T")[0]
      ),
      personnelService.getLeaveRequests(),
      personnelService.getPayroll(new Date().toISOString().substring(0, 8) + "01"),
      personnelService.getVisas()
    ]);
    
    setPersonnel(personnelData.data || []);
    setProjects(projectsData.data || []);
    setAttendance(attendanceData.data || []);
    setLeaveRequests(leaveData.data || []);
    setPayroll(payrollData.data || []);
    setVisas(visaData.data || []);
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

  const handlePayrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const person = personnel.find(p => p.id === payrollForm.personnel_id);
    const regularHours = parseFloat(payrollForm.regular_hours);
    const overtimeHours = parseFloat(payrollForm.overtime_hours);
    const hourlyRate = person?.hourly_rate || 0;
    const grossPay = (regularHours * hourlyRate) + (overtimeHours * hourlyRate * 1.5);
    const deductions = parseFloat(payrollForm.deductions);
    const netPay = grossPay - deductions;

    await personnelService.generatePayroll({
      personnel_id: payrollForm.personnel_id,
      pay_period_start: payrollForm.pay_period_start,
      pay_period_end: payrollForm.pay_period_end,
      regular_hours: regularHours,
      overtime_hours: overtimeHours,
      hourly_rate: hourlyRate,
      gross_pay: grossPay,
      deductions,
      net_pay: netPay,
      status: payrollForm.status
    });
    setPayrollDialogOpen(false);
    resetPayrollForm();
    loadData();
  };

  const handleVisaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await personnelService.addVisa(visaForm);
    setVisaDialogOpen(false);
    resetVisaForm();
    loadData();
  };

  const handleEdit = (person: Personnel) => {
    setEditingPersonnel(person);
    setFormData({
      name: person.name,
      role: person.role,
      project_id: person.project_id || "",
      phone: person.phone || "",
      email: person.email || "",
      hourly_rate: person.hourly_rate?.toString() || "",
      daily_rate: person.daily_rate?.toString() || "",
      overtime_rate: person.overtime_rate?.toString() || "",
      status: person.status as any,
      worker_type: (person.worker_type as any) || "construction",
      hire_date: person.hire_date || new Date().toISOString().split("T")[0]
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this personnel?")) {
      await personnelService.delete(id);
      loadData();
    }
  };

  const handleLeaveApproval = async (id: string, status: string) => {
    await personnelService.updateLeaveStatus(id, status);
    loadData();
  };

  const handlePayrollApproval = async (id: string, status: string) => {
    await personnelService.updatePayrollStatus(id, status);
    loadData();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      role: "",
      project_id: "",
      phone: "",
      email: "",
      hourly_rate: "",
      daily_rate: "",
      overtime_rate: "",
      status: "active",
      worker_type: "construction",
      hire_date: new Date().toISOString().split("T")[0]
    });
    setIsManualRole(false);
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

  const resetPayrollForm = () => {
    setPayrollForm({
      personnel_id: "",
      pay_period_start: new Date().toISOString().substring(0, 8) + "01",
      pay_period_end: new Date().toISOString().split("T")[0],
      regular_hours: "160",
      overtime_hours: "0",
      deductions: "0",
      status: "pending"
    });
  };

  const resetVisaForm = () => {
    setVisaForm({
      personnel_id: "",
      visa_number: "",
      country: "",
      issue_date: new Date().toISOString().split("T")[0],
      expiry_date: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().split("T")[0]
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
  const filteredPayroll = payroll.filter(p => (p.personnel?.worker_type || 'construction') === workerFilter);
  const filteredVisas = visas.filter(v => (v.personnel?.worker_type || 'construction') === workerFilter);

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
            <h1 className="text-3xl font-heading font-bold">Human Resources</h1>
            <p className="text-muted-foreground mt-1">Manage personnel, attendance, and payroll</p>
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

        <Tabs defaultValue="personnel" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
            <TabsTrigger value="personnel" className="py-2.5">
              <UserCheck className="h-4 w-4 mr-2" />
              Personnel
            </TabsTrigger>
            <TabsTrigger value="attendance" className="py-2.5">
              <Clock className="h-4 w-4 mr-2" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="leave" className="py-2.5">
              <Calendar className="h-4 w-4 mr-2" />
              Leave
            </TabsTrigger>
            <TabsTrigger value="payroll" className="py-2.5">
              <DollarSign className="h-4 w-4 mr-2" />
              Payroll
            </TabsTrigger>
            {currency !== "PHP" && (
              <TabsTrigger value="visa" className="py-2.5">
                <PassportIcon className="h-4 w-4 mr-2" />
                Visa
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="personnel" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetForm}>
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
                            <Button size="icon" variant="ghost" onClick={() => handleEdit(person)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button size="icon" variant="ghost" onClick={() => handleDelete(person.id)}>
                              <Trash2 className="h-4 w-4" />
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

          <TabsContent value="attendance" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetAttendanceForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Mark Attendance
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Mark Attendance</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleAttendanceSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="att_personnel">Personnel *</Label>
                      <Select value={attendanceForm.personnel_id} onValueChange={(value) => setAttendanceForm({ ...attendanceForm, personnel_id: value })}>
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
                      <Label htmlFor="att_date">Date *</Label>
                      <Input
                        id="att_date"
                        type="date"
                        value={attendanceForm.date}
                        onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="att_status">Status *</Label>
                      <Select value={attendanceForm.status} onValueChange={(value: any) => setAttendanceForm({ ...attendanceForm, status: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="half_day">Half Day</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="hours_worked">Regular Hours</Label>
                        <Input
                          id="hours_worked"
                          type="number"
                          step="0.5"
                          value={attendanceForm.hours_worked}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, hours_worked: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="overtime_hours">Overtime Hours</Label>
                        <Input
                          id="overtime_hours"
                          type="number"
                          step="0.5"
                          value={attendanceForm.overtime_hours}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, overtime_hours: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="att_notes">Notes</Label>
                      <Textarea
                        id="att_notes"
                        value={attendanceForm.notes}
                        onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setAttendanceDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Mark</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Attendance Records</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Personnel</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Regular Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                        <TableCell className="font-medium">{record.personnel?.name}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[record.status]}>
                            {record.status.replace("_", " ")}
                          </Badge>
                        </TableCell>
                        <TableCell>{record.hours_worked}h</TableCell>
                        <TableCell>{record.overtime_hours}h</TableCell>
                        <TableCell className="max-w-xs truncate">{record.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {filteredAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                          No attendance records found.
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
                  <Button onClick={resetLeaveForm}>
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
                          {leave.status === "pending" && (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleLeaveApproval(leave.id, "approved")}>
                                Approve
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleLeaveApproval(leave.id, "rejected")}>
                                Reject
                              </Button>
                            </div>
                          )}
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

          <TabsContent value="payroll" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={payrollDialogOpen} onOpenChange={setPayrollDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetPayrollForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Generate Payroll
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Generate Payroll</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handlePayrollSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="pay_personnel">Personnel *</Label>
                      <Select value={payrollForm.personnel_id} onValueChange={(value) => setPayrollForm({ ...payrollForm, personnel_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select personnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredPersonnel.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name} - {currency} {person.hourly_rate}/hr
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="pay_period_start">Period Start *</Label>
                        <Input
                          id="pay_period_start"
                          type="date"
                          value={payrollForm.pay_period_start}
                          onChange={(e) => setPayrollForm({ ...payrollForm, pay_period_start: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pay_period_end">Period End *</Label>
                        <Input
                          id="pay_period_end"
                          type="date"
                          value={payrollForm.pay_period_end}
                          onChange={(e) => setPayrollForm({ ...payrollForm, pay_period_end: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="regular_hours">Regular Hours</Label>
                        <Input
                          id="regular_hours"
                          type="number"
                          step="0.5"
                          value={payrollForm.regular_hours}
                          onChange={(e) => setPayrollForm({ ...payrollForm, regular_hours: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="pay_overtime">Overtime Hours</Label>
                        <Input
                          id="pay_overtime"
                          type="number"
                          step="0.5"
                          value={payrollForm.overtime_hours}
                          onChange={(e) => setPayrollForm({ ...payrollForm, overtime_hours: e.target.value })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="deductions">Deductions ({currency})</Label>
                        <Input
                          id="deductions"
                          type="number"
                          step="0.01"
                          value={payrollForm.deductions}
                          onChange={(e) => setPayrollForm({ ...payrollForm, deductions: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setPayrollDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Generate</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Payroll Records</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personnel</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Regular Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Gross Pay</TableHead>
                      <TableHead>Deductions</TableHead>
                      <TableHead>Net Pay</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPayroll.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.personnel?.name}</TableCell>
                        <TableCell>
                          {new Date(record.pay_period_start).toLocaleDateString()} - {new Date(record.pay_period_end).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{record.regular_hours}h</TableCell>
                        <TableCell>{record.overtime_hours}h</TableCell>
                        <TableCell>{currency} {record.gross_pay.toLocaleString()}</TableCell>
                        <TableCell>{currency} {record.deductions.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">{currency} {record.net_pay.toLocaleString()}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[record.status]}>
                            {record.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {record.status === "pending" && (
                            <Button size="sm" onClick={() => handlePayrollApproval(record.id, "paid")}>
                              Mark Paid
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredPayroll.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-6 text-muted-foreground">
                          No payroll records found.
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
                    <Button onClick={resetVisaForm}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Visa Record
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add Visa Record</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={handleVisaSubmit} className="space-y-4">
                      <div className="space-y-2">
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
                      <div className="space-y-2">
                        <Label htmlFor="visa_number">Visa/Passport Number *</Label>
                        <Input
                          id="visa_number"
                          value={visaForm.visa_number}
                          onChange={(e) => setVisaForm({ ...visaForm, visa_number: e.target.value })}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="country">Country of Issue *</Label>
                        <Input
                          id="country"
                          value={visaForm.country}
                          onChange={(e) => setVisaForm({ ...visaForm, country: e.target.value })}
                          placeholder="e.g. UAE, Qatar, USA"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="issue_date">Issue Date *</Label>
                          <Input
                            id="issue_date"
                            type="date"
                            value={visaForm.issue_date}
                            onChange={(e) => setVisaForm({ ...visaForm, issue_date: e.target.value })}
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="expiry_date">Expiry Date *</Label>
                          <Input
                            id="expiry_date"
                            type="date"
                            value={visaForm.expiry_date}
                            onChange={(e) => setVisaForm({ ...visaForm, expiry_date: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div className="flex justify-end gap-2 pt-4">
                        <Button type="button" variant="outline" onClick={() => setVisaDialogOpen(false)}>
                          Cancel
                        </Button>
                        <Button type="submit">Save</Button>
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
                        <TableHead>Visa / Passport No.</TableHead>
                        <TableHead>Country</TableHead>
                        <TableHead>Issue Date</TableHead>
                        <TableHead>Expiry Date</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredVisas.map((record) => {
                        const daysToExpiry = Math.ceil((new Date(record.expiry_date).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                        let statusColor = "bg-green-100 text-green-800";
                        let statusText = "Active";
                        
                        if (daysToExpiry < 0) {
                          statusColor = "bg-red-100 text-red-800";
                          statusText = "Expired";
                        } else if (daysToExpiry < 30) {
                          statusColor = "bg-orange-100 text-orange-800";
                          statusText = "Expiring Soon";
                        }

                        return (
                          <TableRow key={record.id}>
                            <TableCell className="font-medium">{record.personnel?.name}</TableCell>
                            <TableCell className="font-mono">{record.visa_number}</TableCell>
                            <TableCell>{record.country}</TableCell>
                            <TableCell>{new Date(record.issue_date).toLocaleDateString()}</TableCell>
                            <TableCell className={daysToExpiry < 30 ? "text-red-600 font-medium" : ""}>
                              {new Date(record.expiry_date).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColor}>{statusText}</Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                      {filteredVisas.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-6 text-muted-foreground">
                            No visa records found.
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