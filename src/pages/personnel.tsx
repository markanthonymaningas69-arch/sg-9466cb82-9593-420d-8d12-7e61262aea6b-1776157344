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
import { Plus, Pencil, Trash2, UserCheck, Calendar, DollarSign, GraduationCap, Clock } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];
type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function Personnel() {
  const [personnel, setPersonnel] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<any[]>([]);
  const [payroll, setPayroll] = useState<any[]>([]);
  const [training, setTraining] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [trainingDialogOpen, setTrainingDialogOpen] = useState(false);
  const [editingPersonnel, setEditingPersonnel] = useState<Personnel | null>(null);
  
  const [formData, setFormData] = useState({
    name: "",
    role: "",
    project_id: "",
    phone: "",
    email: "",
    hourly_rate: "",
    status: "active" as const,
    hire_date: new Date().toISOString().split("T")[0]
  });

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

  const [trainingForm, setTrainingForm] = useState({
    personnel_id: "",
    training_title: "",
    training_type: "safety" as const,
    training_date: new Date().toISOString().split("T")[0],
    notes: ""
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [personnelData, projectsData, attendanceData, leaveData, payrollData, trainingData] = await Promise.all([
      personnelService.getAll(),
      projectService.getAll(),
      personnelService.getAttendance(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        new Date().toISOString().split("T")[0]
      ),
      personnelService.getLeaveRequests(),
      personnelService.getPayroll(new Date().toISOString().substring(0, 8) + "01"),
      personnelService.getTrainingRecords()
    ]);
    setPersonnel(personnelData.data || []);
    setProjects(projectsData.data || []);
    setAttendance(attendanceData.data || []);
    setLeaveRequests(leaveData.data || []);
    setPayroll(payrollData.data || []);
    setTraining(trainingData.data || []);
    setLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const personnelData = {
      ...formData,
      hourly_rate: parseFloat(formData.hourly_rate) || 0
    };
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

  const handleTrainingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await personnelService.addTrainingRecord(trainingForm);
    setTrainingDialogOpen(false);
    resetTrainingForm();
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
      status: person.status as any,
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
      status: "active",
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

  const resetTrainingForm = () => {
    setTrainingForm({
      personnel_id: "",
      training_title: "",
      training_type: "safety",
      training_date: new Date().toISOString().split("T")[0],
      notes: ""
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
        <div>
          <h1 className="text-3xl font-heading font-bold">Human Resources</h1>
          <p className="text-muted-foreground mt-1">Comprehensive HR management for construction workforce</p>
        </div>

        <Tabs defaultValue="personnel" className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="personnel">
              <UserCheck className="h-4 w-4 mr-2" />
              Personnel
            </TabsTrigger>
            <TabsTrigger value="attendance">
              <Clock className="h-4 w-4 mr-2" />
              Attendance
            </TabsTrigger>
            <TabsTrigger value="leave">
              <Calendar className="h-4 w-4 mr-2" />
              Leave
            </TabsTrigger>
            <TabsTrigger value="payroll">
              <DollarSign className="h-4 w-4 mr-2" />
              Payroll
            </TabsTrigger>
            <TabsTrigger value="training">
              <GraduationCap className="h-4 w-4 mr-2" />
              Training
            </TabsTrigger>
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
                        <Label htmlFor="role">Role *</Label>
                        <Input
                          id="role"
                          value={formData.role}
                          onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                          placeholder="e.g., Site Engineer, Foreman"
                          required
                        />
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
                      <div className="space-y-2">
                        <Label htmlFor="hourly_rate">Hourly Rate ($)</Label>
                        <Input
                          id="hourly_rate"
                          type="number"
                          step="0.01"
                          value={formData.hourly_rate}
                          onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                        />
                      </div>
                    </div>
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
                <CardTitle>All Personnel</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Hourly Rate</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {personnel.map((person) => (
                      <TableRow key={person.id}>
                        <TableCell className="font-medium">{person.name}</TableCell>
                        <TableCell>{person.role}</TableCell>
                        <TableCell>{person.projects?.name || "Unassigned"}</TableCell>
                        <TableCell>{person.phone || "-"}</TableCell>
                        <TableCell>${person.hourly_rate?.toLocaleString() || 0}/hr</TableCell>
                        <TableCell>
                          <Badge className={statusColors[person.status] || "bg-gray-100 text-gray-800"}>
                            {person.status.replace("_", " ")}
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
                          {personnel.map((person) => (
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
                <CardTitle>Attendance Records (Last 30 Days)</CardTitle>
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
                    {attendance.map((record) => (
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
                          {personnel.map((person) => (
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
                    {leaveRequests.map((leave) => (
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
                          {personnel.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name} - ${person.hourly_rate}/hr
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
                        <Label htmlFor="deductions">Deductions ($)</Label>
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
                    {payroll.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.personnel?.name}</TableCell>
                        <TableCell>
                          {new Date(record.pay_period_start).toLocaleDateString()} - {new Date(record.pay_period_end).toLocaleDateString()}
                        </TableCell>
                        <TableCell>{record.regular_hours}h</TableCell>
                        <TableCell>{record.overtime_hours}h</TableCell>
                        <TableCell>${record.gross_pay.toLocaleString()}</TableCell>
                        <TableCell>${record.deductions.toLocaleString()}</TableCell>
                        <TableCell className="font-semibold">${record.net_pay.toLocaleString()}</TableCell>
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
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="training" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={trainingDialogOpen} onOpenChange={setTrainingDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetTrainingForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Training Record
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Training Record</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleTrainingSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="train_personnel">Personnel *</Label>
                      <Select value={trainingForm.personnel_id} onValueChange={(value) => setTrainingForm({ ...trainingForm, personnel_id: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select personnel" />
                        </SelectTrigger>
                        <SelectContent>
                          {personnel.map((person) => (
                            <SelectItem key={person.id} value={person.id}>
                              {person.name} - {person.role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="training_title">Training Title *</Label>
                      <Input
                        id="training_title"
                        value={trainingForm.training_title}
                        onChange={(e) => setTrainingForm({ ...trainingForm, training_title: e.target.value })}
                        placeholder="e.g., OSHA Safety Training"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="training_type">Training Type *</Label>
                      <Select value={trainingForm.training_type} onValueChange={(value: any) => setTrainingForm({ ...trainingForm, training_type: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="safety">Safety</SelectItem>
                          <SelectItem value="technical">Technical</SelectItem>
                          <SelectItem value="compliance">Compliance</SelectItem>
                          <SelectItem value="certification">Certification</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="training_date">Training Date *</Label>
                      <Input
                        id="training_date"
                        type="date"
                        value={trainingForm.training_date}
                        onChange={(e) => setTrainingForm({ ...trainingForm, training_date: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="train_notes">Notes</Label>
                      <Textarea
                        id="train_notes"
                        value={trainingForm.notes}
                        onChange={(e) => setTrainingForm({ ...trainingForm, notes: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-4">
                      <Button type="button" variant="outline" onClick={() => setTrainingDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Add</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Training Records</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Personnel</TableHead>
                      <TableHead>Training Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Notes</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {training.map((record) => (
                      <TableRow key={record.id}>
                        <TableCell className="font-medium">{record.personnel?.name}</TableCell>
                        <TableCell>{record.training_title}</TableCell>
                        <TableCell className="capitalize">{record.training_type}</TableCell>
                        <TableCell>{new Date(record.training_date).toLocaleDateString()}</TableCell>
                        <TableCell className="max-w-xs truncate">{record.notes || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}