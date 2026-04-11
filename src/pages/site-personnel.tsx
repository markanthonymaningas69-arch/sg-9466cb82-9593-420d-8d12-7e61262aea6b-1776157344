import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { siteService } from "@/services/siteService";
import { projectService } from "@/services/projectService";
import { personnelService } from "@/services/personnelService";
import { Plus, Pencil, Trash2, Users, Truck, ClipboardList, TrendingUp } from "lucide-react";

type Project = { id: string; name: string; location: string; status: string };
type Personnel = { id: string; name: string; role: string };
type SiteAttendance = { id: string; personnel_id: string; project_id: string; date: string; status: string; hours_worked: number; notes: string; personnel?: { name: string; role: string } };
type Delivery = { id: string; project_id: string; delivery_date: string; item_name: string; quantity: number; unit: string; supplier: string; received_by: string; status: string; notes: string };
type ScopeOfWork = { id: string; name: string; description?: string; order_number: number; completion_percentage?: number; status?: string; bom_id: string };
type ProgressUpdate = { id: string; bom_scope_id: string; update_date: string; percentage_completed: number; notes: string; updated_by: string };

export default function SitePersonnel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [activeTab, setActiveTab] = useState("attendance");
  
  // Site Attendance
  const [attendance, setAttendance] = useState<SiteAttendance[]>([]);
  const [attendanceDialogOpen, setAttendanceDialogOpen] = useState(false);
  const [attendanceForm, setAttendanceForm] = useState({
    personnel_id: "",
    project_id: "",
    date: new Date().toISOString().split("T")[0],
    status: "present",
    hours_worked: 8,
    notes: ""
  });

  // Deliveries
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [deliveryForm, setDeliveryForm] = useState({
    project_id: "",
    delivery_date: new Date().toISOString().split("T")[0],
    item_name: "",
    quantity: 0,
    unit: "",
    supplier: "",
    received_by: "",
    status: "pending",
    notes: ""
  });

  // Scope of Works
  const [scopes, setScopes] = useState<ScopeOfWork[]>([]);

  // Progress Updates
  const [selectedScope, setSelectedScope] = useState<string>("");
  const [progressUpdates, setProgressUpdates] = useState<ProgressUpdate[]>([]);
  const [progressDialogOpen, setProgressDialogOpen] = useState(false);
  const [progressForm, setProgressForm] = useState({
    bom_scope_id: "",
    update_date: new Date().toISOString().split("T")[0],
    percentage_completed: 0,
    notes: "",
    updated_by: ""
  });

  useEffect(() => {
    loadProjects();
    loadPersonnel();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadAttendance();
      loadDeliveries();
      loadScopes();
    }
  }, [selectedProject, selectedDate]);

  useEffect(() => {
    if (selectedScope) {
      loadProgressUpdates();
    }
  }, [selectedScope]);

  const loadProjects = async () => {
    const { data } = await projectService.getAll();
    setProjects(data || []);
  };

  const loadPersonnel = async () => {
    const { data } = await personnelService.getAll();
    setPersonnel(data || []);
  };

  const loadAttendance = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getSiteAttendance(selectedProject, selectedDate);
    setAttendance(data || []);
  };

  const loadDeliveries = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getDeliveries(selectedProject);
    setDeliveries(data || []);
  };

  const loadScopes = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getScopeOfWorks(selectedProject);
    setScopes(data || []);
  };

  const loadProgressUpdates = async () => {
    if (!selectedScope) return;
    const { data } = await siteService.getProgressUpdates(selectedScope);
    setProgressUpdates(data || []);
  };

  const handleAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.markAttendance({
      ...attendanceForm,
      project_id: selectedProject
    });
    setAttendanceDialogOpen(false);
    resetAttendanceForm();
    loadAttendance();
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.createDelivery({
      ...deliveryForm,
      project_id: selectedProject,
      quantity: parseFloat(deliveryForm.quantity.toString())
    });
    setDeliveryDialogOpen(false);
    resetDeliveryForm();
    loadDeliveries();
  };

  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.createProgressUpdate({
      ...progressForm,
      bom_scope_id: selectedScope,
      percentage_completed: parseFloat(progressForm.percentage_completed.toString())
    });
    setProgressDialogOpen(false);
    resetProgressForm();
    loadProgressUpdates();
    loadScopes();
  };

  const resetAttendanceForm = () => {
    setAttendanceForm({
      personnel_id: "",
      project_id: "",
      date: new Date().toISOString().split("T")[0],
      status: "present",
      hours_worked: 8,
      notes: ""
    });
  };

  const resetDeliveryForm = () => {
    setDeliveryForm({
      project_id: "",
      delivery_date: new Date().toISOString().split("T")[0],
      item_name: "",
      quantity: 0,
      unit: "",
      supplier: "",
      received_by: "",
      status: "pending",
      notes: ""
    });
  };

  const resetProgressForm = () => {
    setProgressForm({
      bom_scope_id: selectedScope,
      update_date: new Date().toISOString().split("T")[0],
      percentage_completed: 0,
      notes: "",
      updated_by: ""
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      present: "bg-green-500",
      absent: "bg-red-500",
      late: "bg-yellow-500",
      half_day: "bg-orange-500",
      pending: "bg-yellow-500",
      received: "bg-green-500",
      not_started: "bg-gray-500",
      in_progress: "bg-blue-500",
      completed: "bg-green-500"
    };
    return <Badge className={colors[status]}>{status.replace("_", " ").toUpperCase()}</Badge>;
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Site Personnel</h1>
            <p className="text-muted-foreground">Daily site operations, attendance, deliveries & progress tracking</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="project">Select Project</Label>
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="date">Date</Label>
            <Input
              id="date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
        </div>

        {selectedProject && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="attendance">
                <Users className="h-4 w-4 mr-2" />
                Attendance
              </TabsTrigger>
              <TabsTrigger value="deliveries">
                <Truck className="h-4 w-4 mr-2" />
                Deliveries
              </TabsTrigger>
              <TabsTrigger value="scope">
                <ClipboardList className="h-4 w-4 mr-2" />
                Scope of Works
              </TabsTrigger>
              <TabsTrigger value="progress">
                <TrendingUp className="h-4 w-4 mr-2" />
                Progress Updates
              </TabsTrigger>
            </TabsList>

            <TabsContent value="attendance">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Daily Attendance</CardTitle>
                      <CardDescription>Track worker attendance for {selectedDate}</CardDescription>
                    </div>
                    <Dialog open={attendanceDialogOpen} onOpenChange={setAttendanceDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
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
                            <Label htmlFor="personnel">Personnel</Label>
                            <Select 
                              value={attendanceForm.personnel_id} 
                              onValueChange={(value) => setAttendanceForm({ ...attendanceForm, personnel_id: value })}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Select worker" />
                              </SelectTrigger>
                              <SelectContent>
                                {personnel.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} - {p.role}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select 
                              value={attendanceForm.status} 
                              onValueChange={(value) => setAttendanceForm({ ...attendanceForm, status: value })}
                            >
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
                          <div className="space-y-2">
                            <Label htmlFor="hours">Hours Worked</Label>
                            <Input
                              id="hours"
                              type="number"
                              step="0.5"
                              value={attendanceForm.hours_worked}
                              onChange={(e) => setAttendanceForm({ ...attendanceForm, hours_worked: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                              id="notes"
                              value={attendanceForm.notes}
                              onChange={(e) => setAttendanceForm({ ...attendanceForm, notes: e.target.value })}
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setAttendanceDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Worker</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Hours</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendance.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">{record.personnel?.name}</TableCell>
                          <TableCell>{record.personnel?.role}</TableCell>
                          <TableCell>{getStatusBadge(record.status)}</TableCell>
                          <TableCell>{record.hours_worked}</TableCell>
                          <TableCell>{record.notes}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => siteService.deleteAttendance(record.id).then(loadAttendance)}>
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

            <TabsContent value="deliveries">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Material Deliveries</CardTitle>
                      <CardDescription>Track deliveries to site</CardDescription>
                    </div>
                    <Dialog open={deliveryDialogOpen} onOpenChange={setDeliveryDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          New Delivery
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Record Delivery</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleDeliverySubmit} className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="item">Item Name</Label>
                              <Input
                                id="item"
                                value={deliveryForm.item_name}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, item_name: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="supplier">Supplier</Label>
                              <Input
                                id="supplier"
                                value={deliveryForm.supplier}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, supplier: e.target.value })}
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="quantity">Quantity</Label>
                              <Input
                                id="quantity"
                                type="number"
                                step="0.01"
                                value={deliveryForm.quantity}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, quantity: parseFloat(e.target.value) })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="unit">Unit</Label>
                              <Input
                                id="unit"
                                value={deliveryForm.unit}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, unit: e.target.value })}
                                placeholder="e.g., bags, m³, pcs"
                                required
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="delivery_date">Delivery Date</Label>
                              <Input
                                id="delivery_date"
                                type="date"
                                value={deliveryForm.delivery_date}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="received_by">Received By</Label>
                              <Input
                                id="received_by"
                                value={deliveryForm.received_by}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, received_by: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="status">Status</Label>
                            <Select 
                              value={deliveryForm.status} 
                              onValueChange={(value) => setDeliveryForm({ ...deliveryForm, status: value })}
                            >
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="received">Received</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="del_notes">Notes</Label>
                            <Textarea
                              id="del_notes"
                              value={deliveryForm.notes}
                              onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">Save</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Item</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Supplier</TableHead>
                        <TableHead>Received By</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveries.map((delivery) => (
                        <TableRow key={delivery.id}>
                          <TableCell>{delivery.delivery_date}</TableCell>
                          <TableCell className="font-medium">{delivery.item_name}</TableCell>
                          <TableCell>{delivery.quantity} {delivery.unit}</TableCell>
                          <TableCell>{delivery.supplier}</TableCell>
                          <TableCell>{delivery.received_by}</TableCell>
                          <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="ghost" onClick={() => siteService.deleteDelivery(delivery.id).then(loadDeliveries)}>
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

            <TabsContent value="scope">
              <Card>
                <CardHeader>
                  <CardTitle>Scope of Works (From BOM)</CardTitle>
                  <CardDescription>Track progress for scopes officially defined in the Bill of Materials</CardDescription>
                </CardHeader>
                <CardContent>
                  {scopes.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50">
                      <p className="mb-4">No scopes found. Ensure a Bill of Materials is created for this project with defined Scope of Works.</p>
                      <Button variant="outline" onClick={() => setActiveTab("scope")}>Go to Scope of Works</Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">#</TableHead>
                          <TableHead>Scope Name</TableHead>
                          <TableHead className="w-48">Completion</TableHead>
                          <TableHead className="w-32">Status</TableHead>
                          <TableHead className="text-right w-40">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {scopes.map((scope) => (
                          <TableRow key={scope.id}>
                            <TableCell>{scope.order_number}</TableCell>
                            <TableCell>
                              <div className="font-medium">{scope.name}</div>
                              {scope.description && <div className="text-sm text-muted-foreground">{scope.description}</div>}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-24 bg-secondary rounded-full h-2.5 overflow-hidden">
                                  <div className="bg-green-500 h-full transition-all" style={{ width: `${scope.completion_percentage || 0}%` }} />
                                </div>
                                <span className="text-sm font-medium">{scope.completion_percentage || 0}%</span>
                              </div>
                            </TableCell>
                            <TableCell>{getStatusBadge(scope.status || 'not_started')}</TableCell>
                            <TableCell className="text-right">
                              <Button 
                                size="sm" 
                                variant="outline"
                                className="bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-800 border-blue-200"
                                onClick={() => {
                                  setSelectedScope(scope.id);
                                  setProgressForm({ ...progressForm, bom_scope_id: scope.id, percentage_completed: scope.completion_percentage || 0 });
                                  setActiveTab("progress");
                                }}
                              >
                                Update Progress
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="progress">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Progress Updates</CardTitle>
                      <CardDescription>
                        {selectedScope 
                          ? `Tracking progress for: ${scopes.find(s => s.id === selectedScope)?.name}`
                          : "Select a scope from the Scope of Works tab to view and add updates"}
                      </CardDescription>
                    </div>
                    <Dialog open={progressDialogOpen} onOpenChange={setProgressDialogOpen}>
                      <DialogTrigger asChild>
                        <Button disabled={!selectedScope} className="bg-blue-600 hover:bg-blue-700 text-white">
                          <Plus className="h-4 w-4 mr-2" />
                          Log Progress
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Log Percentage Completion</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleProgressSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="update_date">Date</Label>
                            <Input
                              id="update_date"
                              type="date"
                              value={progressForm.update_date}
                              onChange={(e) => setProgressForm({ ...progressForm, update_date: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="percentage_completed">Total Percentage Completed (%)</Label>
                            <Input
                              id="percentage_completed"
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={progressForm.percentage_completed}
                              onChange={(e) => setProgressForm({ ...progressForm, percentage_completed: parseFloat(e.target.value) })}
                              required
                            />
                            <p className="text-xs text-muted-foreground">Enter the cumulative completion percentage (e.g., 50 for 50% complete).</p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="updated_by">Updated By (Name)</Label>
                            <Input
                              id="updated_by"
                              value={progressForm.updated_by}
                              onChange={(e) => setProgressForm({ ...progressForm, updated_by: e.target.value })}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="prog_notes">Notes / Observations</Label>
                            <Textarea
                              id="prog_notes"
                              value={progressForm.notes}
                              onChange={(e) => setProgressForm({ ...progressForm, notes: e.target.value })}
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setProgressDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">Save Progress</Button>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  {!selectedScope ? (
                    <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50">
                      <p className="mb-4">Select a scope from the "Scope of Works" tab to view or log progress updates.</p>
                      <Button variant="outline" onClick={() => setActiveTab("scope")}>Go to Scope of Works</Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Percentage</TableHead>
                          <TableHead>Updated By</TableHead>
                          <TableHead>Notes</TableHead>
                          <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {progressUpdates.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">No progress updates logged yet.</TableCell>
                          </TableRow>
                        ) : (
                          progressUpdates.map((update) => (
                            <TableRow key={update.id}>
                              <TableCell>{update.update_date}</TableCell>
                              <TableCell className="font-medium text-green-600">{update.percentage_completed}%</TableCell>
                              <TableCell>{update.updated_by}</TableCell>
                              <TableCell>{update.notes}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700" onClick={() => siteService.deleteProgressUpdate(update.id).then(loadProgressUpdates)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}