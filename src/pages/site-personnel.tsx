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
import { Switch } from "@/components/ui/switch";
import { siteService } from "@/services/siteService";
import { projectService } from "@/services/projectService";
import { personnelService } from "@/services/personnelService";
import { Plus, Pencil, Trash2, Users, Truck, ClipboardList, ArrowUp, ArrowDown } from "lucide-react";

type Project = { id: string; name: string; location: string; status: string };
type Personnel = { id: string; name: string; role: string; hourly_rate: number };
type SiteAttendance = { id: string; personnel_id: string; project_id: string; date: string; status: string; hours_worked: number; overtime_hours?: number; bom_scope_id?: string; notes: string; personnel?: { name: string; role: string } };
type AttendanceRow = { personnel_id: string; name: string; role: string; hourly_rate: number; status: string; hours_worked: number; overtime_hours: number; bom_scope_id: string | null };
type Delivery = { id: string; project_id: string; delivery_date: string; item_name: string; quantity: number; unit: string; supplier: string; received_by: string; status: string; notes: string; receipt_number?: string };
type ScopeOfWork = { id: string; name: string; description?: string; order_number: number; completion_percentage?: number; status?: string; bom_id: string };

export default function SitePersonnel() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [personnel, setPersonnel] = useState<Personnel[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [activeTab, setActiveTab] = useState("attendance");
  
  const [attendanceDate, setAttendanceDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [deliveriesDate, setDeliveriesDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [scopeDate, setScopeDate] = useState<string>(new Date().toISOString().split("T")[0]);
  
  // Site Attendance (Roll Call)
  const [attendanceList, setAttendanceList] = useState<AttendanceRow[]>([]);
  const [enrollDialogOpen, setEnrollDialogOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    name: "",
    role: "",
    hourly_rate: 0
  });

  // Deliveries
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [bomMaterials, setBomMaterials] = useState<{id: string, name: string, unit: string}[]>([]);
  const [isManualItem, setIsManualItem] = useState(false);
  const [isManualUnit, setIsManualUnit] = useState(false);
  const [deliveryDialogOpen, setDeliveryDialogOpen] = useState(false);
  const [expandedReceipts, setExpandedReceipts] = useState<Record<string, boolean>>({});
  const [deliveryForm, setDeliveryForm] = useState({
    project_id: "",
    delivery_date: new Date().toISOString().split("T")[0],
    item_name: "",
    quantity: 0,
    unit: "",
    supplier: "",
    receipt_number: "",
    received_by: "",
    status: "pending",
    notes: ""
  });

  // Scope of Works
  const [scopes, setScopes] = useState<ScopeOfWork[]>([]);

  useEffect(() => {
    loadProjects();
    loadPersonnel();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadAttendanceData();
    }
  }, [selectedProject, attendanceDate]);

  useEffect(() => {
    if (selectedProject) {
      loadDeliveries();
    }
  }, [selectedProject, deliveriesDate]);

  useEffect(() => {
    if (selectedProject) {
      loadScopes();
      loadBomMaterials();
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    const { data } = await projectService.getAll();
    setProjects(data || []);
  };

  const loadPersonnel = async () => {
    // Only needed globally if you want, but we rely on project specific personnel now
  };

  const loadAttendanceData = async () => {
    if (!selectedProject) return;
    const { data: projectPersonnel } = await siteService.getProjectPersonnel(selectedProject);
    const { data: attendance } = await siteService.getSiteAttendance(selectedProject, attendanceDate);

    const merged = projectPersonnel.map((p: any) => {
      const att = attendance.find((a: any) => a.personnel_id === p.id);
      return {
        personnel_id: p.id,
        name: p.name,
        role: p.role,
        hourly_rate: p.hourly_rate || 0,
        status: att?.status || "present",
        hours_worked: att?.hours_worked ?? 8,
        overtime_hours: att?.overtime_hours ?? 0,
        bom_scope_id: att?.bom_scope_id || null,
      };
    });
    setAttendanceList(merged);
  };

  const loadDeliveries = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getDeliveries(selectedProject, deliveriesDate);
    setDeliveries(data || []);
  };

  const loadScopes = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getScopeOfWorks(selectedProject);
    setScopes(data || []);
  };

  const loadBomMaterials = async () => {
    if (!selectedProject) return;
    const { data } = await siteService.getBomMaterials(selectedProject);
    setBomMaterials(data || []);
  };

  const handleUpdateProgress = async (scope: ScopeOfWork, newValue: string) => {
    const percentage = parseFloat(newValue);
    if (isNaN(percentage)) return;

    const clamped = Math.min(Math.max(percentage, 0), 100);
    if (clamped === (scope.completion_percentage || 0)) return;

    await siteService.createProgressUpdate({
      bom_scope_id: scope.id,
      percentage_completed: clamped,
      update_date: scopeDate,
      updated_by: "Site App",
      notes: "Inline progress update"
    });
    loadScopes();
  };

  const handleEnrollSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.enrollPersonnel({
      project_id: selectedProject,
      name: enrollForm.name,
      role: enrollForm.role,
      hourly_rate: enrollForm.hourly_rate,
      status: "active",
      hire_date: new Date().toISOString().split("T")[0],
      email: `${enrollForm.name.replace(/\s+/g, '').toLowerCase()}${Date.now()}@example.com`
    });
    setEnrollDialogOpen(false);
    setEnrollForm({ name: "", role: "", hourly_rate: 0 });
    loadAttendanceData();
  };

  const handleAttendanceChange = async (personnel_id: string, field: string, value: any) => {
    const list = [...attendanceList];
    const idx = list.findIndex(r => r.personnel_id === personnel_id);
    if (idx === -1) return;

    const newRow = { ...list[idx], [field]: value };
    
    // Auto-adjust hours based on presence
    if (field === "status" && value === "absent") {
      newRow.hours_worked = 0;
      newRow.overtime_hours = 0;
      newRow.bom_scope_id = null;
    } else if (field === "status" && value === "present") {
      newRow.hours_worked = 8;
    }

    list[idx] = newRow;
    setAttendanceList(list);

    await siteService.upsertAttendance({
      project_id: selectedProject,
      personnel_id: personnel_id,
      date: attendanceDate,
      status: newRow.status,
      hours_worked: newRow.hours_worked,
      overtime_hours: newRow.overtime_hours,
      bom_scope_id: newRow.bom_scope_id
    });
  };

  const handleDeliverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await siteService.createDelivery({
      ...deliveryForm,
      project_id: selectedProject,
      quantity: parseFloat(deliveryForm.quantity.toString())
    });
    setDeliveryForm(prev => ({ ...prev, item_name: "", quantity: 0, unit: "" }));
    setIsManualItem(false);
    setIsManualUnit(false);
    loadDeliveries();
  };

  const resetDeliveryForm = () => {
    setDeliveryForm({
      project_id: "",
      delivery_date: new Date().toISOString().split("T")[0],
      item_name: "",
      quantity: 0,
      unit: "",
      supplier: "",
      receipt_number: "",
      received_by: "",
      status: "pending",
      notes: ""
    });
    setIsManualItem(false);
    setIsManualUnit(false);
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

  const standardUnits = ["pcs", "bags", "m2", "m3", "kg", "ton", "L", "rolls", "length", "box", "set", "lot", "cu.m", "sq.m"];
  const availableUnits = Array.from(new Set([...standardUnits, ...bomMaterials.map(m => m.unit).filter(Boolean)]));

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Site Personnel</h1>
            <p className="text-muted-foreground">Daily site operations, attendance, deliveries & progress tracking</p>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-1">
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
        </div>

        {selectedProject && (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
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
            </TabsList>

            <TabsContent value="attendance">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Daily Roll Call & Assignment</CardTitle>
                      <CardDescription>Manage presence, overtime, and tasks</CardDescription>
                      <div className="flex items-center gap-3 mt-4">
                        <Label>Date:</Label>
                        <Input
                          type="date"
                          value={attendanceDate}
                          onChange={(e) => setAttendanceDate(e.target.value)}
                          className="w-auto h-9"
                        />
                      </div>
                    </div>
                    <Dialog open={enrollDialogOpen} onOpenChange={setEnrollDialogOpen}>
                      <DialogTrigger asChild>
                        <Button>
                          <Plus className="h-4 w-4 mr-2" />
                          Enroll Manpower
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Enroll New Worker to Project</DialogTitle>
                        </DialogHeader>
                        <form onSubmit={handleEnrollSubmit} className="space-y-4">
                          <div className="space-y-2">
                            <Label>Full Name</Label>
                            <Input
                              required
                              value={enrollForm.name}
                              onChange={(e) => setEnrollForm({ ...enrollForm, name: e.target.value })}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Position / Role</Label>
                            <Input
                              required
                              value={enrollForm.role}
                              onChange={(e) => setEnrollForm({ ...enrollForm, role: e.target.value })}
                              placeholder="e.g., Mason, Carpenter, Laborer"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Hourly Rate (₱)</Label>
                            <Input
                              required
                              type="number"
                              min="0"
                              step="0.01"
                              value={enrollForm.hourly_rate}
                              onChange={(e) => setEnrollForm({ ...enrollForm, hourly_rate: parseFloat(e.target.value) || 0 })}
                            />
                          </div>
                          <div className="flex justify-end gap-2 pt-4">
                            <Button type="button" variant="outline" onClick={() => setEnrollDialogOpen(false)}>
                              Cancel
                            </Button>
                            <Button type="submit">Enroll Worker</Button>
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
                        <TableHead>Position</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-32 text-center">Overtime (Hrs)</TableHead>
                        <TableHead className="w-[250px]">Scope Assignment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {attendanceList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground border-2 border-dashed">
                            No manpower enrolled. Click "Enroll Manpower" to add workers to this project.
                          </TableCell>
                        </TableRow>
                      ) : (
                        attendanceList.map((row) => (
                          <TableRow key={row.personnel_id} className={row.status === "absent" ? "bg-muted/50 opacity-75" : ""}>
                            <TableCell className="font-medium">{row.name}</TableCell>
                            <TableCell>{row.role}</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <Switch
                                  checked={row.status === "present"}
                                  onCheckedChange={(checked) => handleAttendanceChange(row.personnel_id, "status", checked ? "present" : "absent")}
                                />
                                <span className={`text-sm font-semibold ${row.status === "present" ? "text-green-600" : "text-red-500"}`}>
                                  {row.status === "present" ? "Present" : "Absent"}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min="0"
                                step="0.5"
                                className="w-20 mx-auto text-center"
                                value={row.overtime_hours}
                                disabled={row.status === "absent"}
                                onChange={(e) => {
                                  const list = [...attendanceList];
                                  const idx = list.findIndex(l => l.personnel_id === row.personnel_id);
                                  list[idx].overtime_hours = parseFloat(e.target.value) || 0;
                                  setAttendanceList(list);
                                }}
                                onBlur={(e) => handleAttendanceChange(row.personnel_id, "overtime_hours", parseFloat(e.target.value) || 0)}
                              />
                            </TableCell>
                            <TableCell>
                              <Select
                                value={row.bom_scope_id || "unassigned"}
                                disabled={row.status === "absent"}
                                onValueChange={(val) => handleAttendanceChange(row.personnel_id, "bom_scope_id", val === "unassigned" ? null : val)}
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Assign task..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="unassigned" className="text-muted-foreground italic">Unassigned</SelectItem>
                                  {scopes.map((s) => (
                                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="deliveries">
              <Card>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>Material Deliveries</CardTitle>
                      <CardDescription>Track deliveries to site</CardDescription>
                      <div className="flex items-center gap-3 mt-4">
                        <Label>Date Filter:</Label>
                        <Input
                          type="date"
                          value={deliveriesDate}
                          onChange={(e) => setDeliveriesDate(e.target.value)}
                          className="w-auto h-9"
                        />
                        {deliveriesDate && (
                          <Button variant="ghost" size="sm" onClick={() => setDeliveriesDate("")} className="text-muted-foreground h-9">
                            Clear Filter
                          </Button>
                        )}
                      </div>
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
                              {!isManualItem ? (
                                <Select
                                  value={deliveryForm.item_name}
                                  onValueChange={(val) => {
                                    if (val === "others") {
                                      setIsManualItem(true);
                                      setDeliveryForm({ ...deliveryForm, item_name: "", unit: "" });
                                      setIsManualUnit(false);
                                    } else {
                                      const mat = bomMaterials.find(m => m.name === val);
                                      setDeliveryForm({ ...deliveryForm, item_name: val, unit: mat?.unit || deliveryForm.unit });
                                      setIsManualUnit(false);
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select material" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {bomMaterials.map((mat) => (
                                      <SelectItem key={mat.id} value={mat.name}>{mat.name}</SelectItem>
                                    ))}
                                    <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    id="item"
                                    placeholder="Custom material"
                                    value={deliveryForm.item_name}
                                    onChange={(e) => setDeliveryForm({ ...deliveryForm, item_name: e.target.value })}
                                    required
                                  />
                                  <Button type="button" variant="outline" className="px-2" onClick={() => {
                                    setIsManualItem(false);
                                    setDeliveryForm({ ...deliveryForm, item_name: "", unit: "" });
                                  }}>
                                    List
                                  </Button>
                                </div>
                              )}
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
                              {!isManualUnit ? (
                                <Select
                                  value={deliveryForm.unit}
                                  onValueChange={(val) => {
                                    if (val === "others") {
                                      setIsManualUnit(true);
                                      setDeliveryForm({ ...deliveryForm, unit: "" });
                                    } else {
                                      setDeliveryForm({ ...deliveryForm, unit: val });
                                    }
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select unit" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {availableUnits.map((u) => (
                                      <SelectItem key={u} value={u}>{u}</SelectItem>
                                    ))}
                                    <SelectItem value="others" className="font-semibold text-blue-600">Others (Manual Input)</SelectItem>
                                  </SelectContent>
                                </Select>
                              ) : (
                                <div className="flex gap-2">
                                  <Input
                                    id="unit"
                                    value={deliveryForm.unit}
                                    onChange={(e) => setDeliveryForm({ ...deliveryForm, unit: e.target.value })}
                                    placeholder="Custom unit"
                                    required
                                  />
                                  <Button type="button" variant="outline" className="px-2" onClick={() => {
                                    setIsManualUnit(false);
                                    setDeliveryForm({ ...deliveryForm, unit: "" });
                                  }}>
                                    List
                                  </Button>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="receipt_number">Receipt Number</Label>
                              <Input
                                id="receipt_number"
                                value={deliveryForm.receipt_number || ""}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, receipt_number: e.target.value })}
                                placeholder="Optional"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="delivery_date">Delivery Date</Label>
                              <Input
                                id="delivery_date"
                                type="date"
                                value={deliveryForm.delivery_date}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, delivery_date: e.target.value })}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label htmlFor="received_by">Received By</Label>
                              <Input
                                id="received_by"
                                value={deliveryForm.received_by}
                                onChange={(e) => setDeliveryForm({ ...deliveryForm, received_by: e.target.value })}
                              />
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
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="del_notes">Notes</Label>
                            <Textarea
                              id="del_notes"
                              value={deliveryForm.notes}
                              onChange={(e) => setDeliveryForm({ ...deliveryForm, notes: e.target.value })}
                            />
                          </div>
                          <div className="flex justify-between items-center pt-4">
                            <Button type="button" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50" onClick={resetDeliveryForm}>
                              Clear
                            </Button>
                            <div className="flex gap-2">
                              <Button type="button" variant="outline" onClick={() => setDeliveryDialogOpen(false)}>
                                Done / Close
                              </Button>
                              <Button type="submit">Save</Button>
                            </div>
                          </div>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {Object.entries(
                      deliveries.reduce((acc, curr) => {
                        const key = `${curr.supplier}::${curr.receipt_number || 'No Receipt'}::${curr.delivery_date}`;
                        if (!acc[key]) acc[key] = [];
                        acc[key].push(curr);
                        return acc;
                      }, {} as Record<string, Delivery[]>)
                    ).map(([groupKey, groupDeliveries]) => {
                      const [supplier, receipt, date] = groupKey.split('::');
                      const isExpanded = expandedReceipts[groupKey];
                      return (
                        <div key={groupKey} className="border rounded-lg overflow-hidden">
                          <div 
                            className="bg-muted/50 p-4 flex justify-between items-center cursor-pointer hover:bg-muted transition-colors"
                            onClick={() => setExpandedReceipts(prev => ({ ...prev, [groupKey]: !isExpanded }))}
                          >
                            <div className="flex items-center gap-4">
                              <div>
                                <h4 className="font-semibold">{supplier}</h4>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <span>{date}</span>
                                  {receipt !== 'No Receipt' && (
                                    <>
                                      <span>•</span>
                                      <Badge variant="outline">Receipt: {receipt}</Badge>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="text-sm font-medium">{groupDeliveries.length} items</div>
                              {isExpanded ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                            </div>
                          </div>
                          
                          {isExpanded && (
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Item</TableHead>
                                  <TableHead>Quantity</TableHead>
                                  <TableHead>Received By</TableHead>
                                  <TableHead>Status</TableHead>
                                  <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {groupDeliveries.map((delivery) => (
                                  <TableRow key={delivery.id}>
                                    <TableCell className="font-medium">{delivery.item_name}</TableCell>
                                    <TableCell>{delivery.quantity} {delivery.unit}</TableCell>
                                    <TableCell>{delivery.received_by}</TableCell>
                                    <TableCell>{getStatusBadge(delivery.status)}</TableCell>
                                    <TableCell className="text-right">
                                      <Button size="sm" variant="ghost" onClick={(e) => {
                                        e.stopPropagation();
                                        siteService.deleteDelivery(delivery.id).then(loadDeliveries);
                                      }}>
                                        <Trash2 className="h-4 w-4 text-red-500" />
                                      </Button>
                                    </TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="scope">
              <Card>
                <CardHeader>
                  <CardTitle>Scope of Works (From BOM)</CardTitle>
                  <CardDescription>Track progress for scopes officially defined in the Bill of Materials</CardDescription>
                  <div className="flex items-center gap-3 mt-4">
                    <Label>Update Date:</Label>
                    <Input
                      type="date"
                      value={scopeDate}
                      onChange={(e) => setScopeDate(e.target.value)}
                      className="w-auto h-9"
                    />
                  </div>
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
                          <TableHead className="text-right w-40">Update Progress</TableHead>
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
                              <div className="flex items-center justify-end gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  className="w-20 text-right h-8"
                                  defaultValue={scope.completion_percentage || 0}
                                  onBlur={(e) => handleUpdateProgress(scope, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.currentTarget.blur();
                                    }
                                  }}
                                />
                                <span className="text-sm font-medium">%</span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
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