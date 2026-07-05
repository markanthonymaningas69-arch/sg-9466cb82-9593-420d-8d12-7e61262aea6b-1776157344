import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, Plus, Trash2, CheckCircle, XCircle, Clock, Filter } from "lucide-react";
import { siteService } from "@/services/siteService";
import { formatCurrency } from "@/lib/currency";

interface AttendanceRecord {
  id: string;
  project_id: string;
  personnel_id: string;
  date: string;
  time_in?: string;
  hours_worked?: number;
  overtime_hours?: number;
  status: "present" | "absent" | "late" | "half_day";
  notes?: string;
  bom_scope_id?: string;
  created_at: string;
  personnel?: {
    name: string;
    role: string;
    hourly_rate?: number;
    daily_rate?: number;
  };
  bom_scope_of_work?: {
    name: string;
  };
}

interface Personnel {
  id: string;
  name: string;
  role: string;
}

interface ScopeOfWork {
  id: string;
  name: string;
}

const ATTENDANCE_STATUS = [
  { value: "present", label: "Present", variant: "default" as const, icon: CheckCircle },
  { value: "absent", label: "Absent", variant: "destructive" as const, icon: XCircle },
  { value: "late", label: "Late", variant: "secondary" as const, icon: Clock },
  { value: "half_day", label: "Half Day", variant: "secondary" as const, icon: Clock },
];

export function AttendanceTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [personnelList, setPersonnelList] = useState<Personnel[]>([]);
  const [scopesList, setScopesList] = useState<ScopeOfWork[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [bulkAddDialogOpen, setBulkAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    personnelId: "all",
    role: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });
  const [usageScopeFilter, setUsageScopeFilter] = useState("all");
  const [scopeFilter, setScopeFilter] = useState<string>("all");

  const workerOptions = useMemo(() => {
    return Array.from(
      new Map(
        attendance
          .filter((record) => record.personnel_id && record.personnel?.name)
          .map((record) => [
            record.personnel_id,
            {
              id: record.personnel_id,
              name: record.personnel?.name || "Unknown",
            },
          ])
      ).values()
    ).sort((left, right) => left.name.localeCompare(right.name));
  }, [attendance]);

  const roleOptions = useMemo(() => {
    return Array.from(
      new Set(
        attendance
          .map((record) => record.personnel?.role?.trim())
          .filter((role): role is string => Boolean(role))
      )
    ).sort((left, right) => left.localeCompare(right));
  }, [attendance]);

  const attendances = useMemo(() => {
    if (!attendance) return [];
    return attendance.filter((a) => {
      if (filters.personnelId !== "all" && a.personnel_id !== filters.personnelId) return false;
      if (filters.dateFrom && a.date < filters.dateFrom) return false;
      if (filters.dateTo && a.date > filters.dateTo) return false;
      return true;
    });
  }, [attendance, filters.personnelId, filters.dateFrom, filters.dateTo]);

  const filteredAttendances = useMemo(() => {
    if (!attendances) return [];
    return attendances.filter((a) => {
      if (scopeFilter === "all") return true;
      if (scopeFilter === "unassigned") return !a.bom_scope_id;
      return a.bom_scope_id === scopeFilter;
    });
  }, [attendances, scopeFilter]);

  const totalLaborCost = useMemo(() => {
    return filteredAttendances.reduce((sum, record) => {
      const hrRate = Number(record.personnel?.hourly_rate || (record.personnel?.daily_rate ? record.personnel.daily_rate / 8 : 0));
      const hoursWorked = Number(record.hours_worked || 0);
      const overtimeHours = Number(record.overtime_hours || 0);
      const regularCost = hoursWorked * hrRate;
      const overtimeCost = overtimeHours * (hrRate * 1.5);
      return sum + regularCost + overtimeCost;
    }, 0);
  }, [filteredAttendances]);

  const filteredAttendance = useMemo(() => {
    return attendance.filter((record) => {
      if (filters.personnelId !== "all" && record.personnel_id !== filters.personnelId) {
        return false;
      }

      if (filters.role !== "all" && record.personnel?.role !== filters.role) {
        return false;
      }

      if (filters.status !== "all" && record.status !== filters.status) {
        return false;
      }

      if (filters.dateFrom && record.date < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && record.date > filters.dateTo) {
        return false;
      }

      return true;
    });
  }, [attendance, filters]);

  const historySummary = useMemo(() => {
    return {
      recordCount: filteredAttendance.length,
      presentCount: filteredAttendance.filter((record) => record.status === "present").length,
      absentCount: filteredAttendance.filter((record) => record.status === "absent").length,
      lateCount: filteredAttendance.filter((record) => record.status === "late").length,
    };
  }, [filteredAttendance]);

  function clearFilters() {
    setFilters({
      personnelId: "all",
      role: "all",
      status: "all",
      dateFrom: "",
      dateTo: "",
    });
  }

  // Form state
  const [formData, setFormData] = useState({
    personnel_id: "",
    date: new Date().toISOString().split("T")[0],
    time_in: "",
    hours_worked: "8",
    overtime_hours: "0",
    status: "present" as AttendanceRecord["status"],
    bom_scope_id: "",
    notes: "",
  });

  // Bulk add form state
  const [bulkFormData, setBulkFormData] = useState({
    date: new Date().toISOString().split("T")[0],
    hours_worked: "8",
    overtime_hours: "0",
    status: "present" as AttendanceRecord["status"],
    bom_scope_id: "",
    notes: "",
  });

  useEffect(() => {
    void loadData();
  }, [projectId]);

  async function loadData() {
    try {
      setLoading(true);

      // Load personnel for this project
      const { data: personnelData, error: personnelError } = await supabase
        .from("personnel")
        .select("id, name, role")
        .eq("status", "active")
        .eq("project_id", projectId);

      if (personnelError) throw personnelError;
      setPersonnelList(personnelData || []);

      // Load scopes of work for this project
      const { data: scopesData, error: scopesError } = await siteService.getScopeOfWorks(projectId);
      if (scopesError) throw scopesError;
      setScopesList(scopesData || []);

      // Load attendance
      const { data, error } = await supabase
        .from("site_attendance")
        .select(`
          *,
          personnel (name, role, hourly_rate, daily_rate),
          bom_scope_of_work (name)
        `)
        .eq("project_id", projectId)
        .eq("is_archived", false)
        .order("date", { ascending: false });

      if (error) throw error;
      setAttendance((data as any) || []);
    } catch (error) {
      console.error("Error loading attendance:", error);
      toast({
        title: "Error",
        description: "Failed to load attendance records",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!formData.personnel_id) {
      toast({ title: "Required", description: "Please select a worker", variant: "destructive" });
      return;
    }

    try {
      const { error } = await supabase.from("site_attendance").insert({
        project_id: projectId,
        personnel_id: formData.personnel_id,
        date: formData.date,
        time_in: formData.time_in ? `${formData.time_in}:00` : null,
        hours_worked: Number(formData.hours_worked),
        overtime_hours: Number(formData.overtime_hours),
        status: formData.status,
        bom_scope_id: formData.bom_scope_id || null,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance recorded",
      });

      setFormData({
        personnel_id: "",
        date: formData.date,
        time_in: formData.time_in,
        hours_worked: formData.hours_worked,
        overtime_hours: formData.overtime_hours,
        status: formData.status,
        bom_scope_id: formData.bom_scope_id,
        notes: formData.notes,
      });
      void loadData();
    } catch (error: any) {
      console.error("Error recording attendance:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") ? "Attendance already recorded for this worker on this date" : "Failed to record attendance",
        variant: "destructive",
      });
    }
  }

  async function handleBulkAdd(e: React.FormEvent) {
    e.preventDefault();

    if (personnelList.length === 0) {
      toast({ title: "No Workers", description: "No active workers found for this project", variant: "destructive" });
      return;
    }

    try {
      const attendanceRecords = personnelList.map(person => ({
        project_id: projectId,
        personnel_id: person.id,
        date: bulkFormData.date,
        hours_worked: Number(bulkFormData.hours_worked),
        overtime_hours: Number(bulkFormData.overtime_hours),
        status: bulkFormData.status,
        bom_scope_id: bulkFormData.bom_scope_id || null,
        notes: bulkFormData.notes || null,
      }));

      const { error } = await supabase.from("site_attendance").insert(attendanceRecords);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Attendance recorded for ${personnelList.length} workers`,
      });

      setBulkAddDialogOpen(false);
      setBulkFormData({
        date: new Date().toISOString().split("T")[0],
        hours_worked: "8",
        overtime_hours: "0",
        status: "present",
        bom_scope_id: "",
        notes: "",
      });
      void loadData();
    } catch (error: any) {
      console.error("Error recording bulk attendance:", error);
      toast({
        title: "Error",
        description: error.message?.includes("duplicate") ? "Some workers already have attendance for this date" : "Failed to record attendance",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this attendance record?")) return;

    try {
      const { error } = await siteService.deleteAttendance(id);

      if (error) throw error;

      toast({
        title: "Moved to recycle bin",
        description: "Attendance record archived",
      });
      void loadData();
    } catch (error) {
      console.error("Error deleting attendance:", error);
      toast({
        title: "Error",
        description: "Failed to delete attendance record",
        variant: "destructive",
      });
    }
  }

  async function handleScopeChange(recordId: string, newScopeId: string) {
    try {
      const { error } = await supabase
        .from("site_attendance")
        .update({ bom_scope_id: newScopeId === "none" ? null : newScopeId })
        .eq("id", recordId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Scope of work updated",
      });
      void loadData();
    } catch (error) {
      console.error("Error updating scope:", error);
      toast({
        title: "Error",
        description: "Failed to update scope of work",
        variant: "destructive",
      });
    }
  }

  function openEditDialog(record: AttendanceRecord) {
    setEditingRecord(record);
    setFormData({
      personnel_id: record.personnel_id,
      date: record.date,
      time_in: record.time_in?.substring(0, 5) || "",
      hours_worked: String(record.hours_worked || 0),
      overtime_hours: String(record.overtime_hours || 0),
      status: record.status,
      bom_scope_id: record.bom_scope_id || "",
      notes: record.notes || "",
    });
    setEditDialogOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();

    if (!editingRecord) return;

    try {
      const { error } = await supabase
        .from("site_attendance")
        .update({
          date: formData.date,
          time_in: formData.time_in ? `${formData.time_in}:00` : null,
          hours_worked: Number(formData.hours_worked),
          overtime_hours: Number(formData.overtime_hours),
          status: formData.status,
          bom_scope_id: formData.bom_scope_id || null,
          notes: formData.notes || null,
        })
        .eq("id", editingRecord.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance updated",
      });

      setEditDialogOpen(false);
      setEditingRecord(null);
      setFormData({
        personnel_id: "",
        date: new Date().toISOString().split("T")[0],
        time_in: "",
        hours_worked: "8",
        overtime_hours: "0",
        status: "present",
        bom_scope_id: "",
        notes: "",
      });
      void loadData();
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      toast({
        title: "Error",
        description: "Failed to update attendance",
        variant: "destructive",
      });
    }
  }

  // Calculate attendance summary
  const today = new Date().toISOString().split("T")[0];
  const todayAttendance = attendance.filter((a) => a.date === today);
  const presentCount = todayAttendance.filter((a) => a.status === "present").length;
  const absentCount = todayAttendance.filter((a) => a.status === "absent").length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Today's Total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{todayAttendance.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Present</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-green-600">{presentCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Absent</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-destructive">{absentCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Attendance Records
          </CardTitle>
          <div className="flex gap-2">
            <Dialog open={bulkAddDialogOpen} onOpenChange={setBulkAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  Add All Workers
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark Attendance for All Workers</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleBulkAdd} className="space-y-4">
                  <div>
                    <Label htmlFor="bulk_date">Date</Label>
                    <Input
                      id="bulk_date"
                      type="date"
                      value={bulkFormData.date}
                      onChange={(e) => setBulkFormData((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="bulk_scope">Scope of Work (Optional)</Label>
                    <Select value={bulkFormData.bom_scope_id || "none"} onValueChange={(value) => setBulkFormData((prev) => ({ ...prev, bom_scope_id: value === "none" ? "" : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope of work" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No scope assigned</SelectItem>
                        {scopesList.map((scope) => (
                          <SelectItem key={scope.id} value={scope.id}>
                            {scope.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="bulk_hours_worked">Hours Worked</Label>
                      <Input
                        id="bulk_hours_worked"
                        type="number"
                        step="0.5"
                        value={bulkFormData.hours_worked}
                        onChange={(e) => setBulkFormData((prev) => ({ ...prev, hours_worked: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="bulk_overtime_hours">Overtime Hours</Label>
                      <Input
                        id="bulk_overtime_hours"
                        type="number"
                        step="0.5"
                        value={bulkFormData.overtime_hours}
                        onChange={(e) => setBulkFormData((prev) => ({ ...prev, overtime_hours: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bulk_status">Status</Label>
                    <Select value={bulkFormData.status} onValueChange={(value: AttendanceRecord["status"]) => setBulkFormData((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDANCE_STATUS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="bulk_notes">Notes (Optional)</Label>
                    <Input
                      id="bulk_notes"
                      value={bulkFormData.notes}
                      onChange={(e) => setBulkFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <div className="bg-muted p-3 rounded-md text-sm">
                    <p className="font-medium">This will mark attendance for {personnelList.length} active workers</p>
                  </div>

                  <Button type="submit" className="w-full">
                    Mark Attendance for All
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Edit Attendance</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleEdit} className="space-y-4">
                  <div>
                    <Label htmlFor="edit_personnel">Worker</Label>
                    <Input
                      id="edit_personnel"
                      value={editingRecord?.personnel?.name || ""}
                      disabled
                      className="bg-muted"
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_date">Date</Label>
                    <Input
                      id="edit_date"
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="edit_scope">Scope of Work (Optional)</Label>
                    <Select value={formData.bom_scope_id || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, bom_scope_id: value === "none" ? "" : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope of work" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No scope assigned</SelectItem>
                        {scopesList.map((scope) => (
                          <SelectItem key={scope.id} value={scope.id}>
                            {scope.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="edit_hours_worked">Hours Worked</Label>
                      <Input
                        id="edit_hours_worked"
                        type="number"
                        step="0.5"
                        value={formData.hours_worked}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hours_worked: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="edit_overtime_hours">Overtime Hours</Label>
                      <Input
                        id="edit_overtime_hours"
                        type="number"
                        step="0.5"
                        value={formData.overtime_hours}
                        onChange={(e) => setFormData((prev) => ({ ...prev, overtime_hours: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="edit_status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: AttendanceRecord["status"]) => setFormData((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDANCE_STATUS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="edit_notes">Notes (Optional)</Label>
                    <Input
                      id="edit_notes"
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Update Attendance
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Mark Attendance
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark Attendance</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <Label htmlFor="personnel_id">Worker</Label>
                    <Select value={formData.personnel_id} onValueChange={(value) => setFormData((prev) => ({ ...prev, personnel_id: value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select worker" />
                      </SelectTrigger>
                      <SelectContent>
                        {personnelList.map((person) => (
                          <SelectItem key={person.id} value={person.id}>
                            {person.name} ({person.role})
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
                      value={formData.date}
                      onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="scope">Scope of Work (Optional)</Label>
                    <Select value={formData.bom_scope_id || "none"} onValueChange={(value) => setFormData((prev) => ({ ...prev, bom_scope_id: value === "none" ? "" : value }))}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select scope of work" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No scope assigned</SelectItem>
                        {scopesList.map((scope) => (
                          <SelectItem key={scope.id} value={scope.id}>
                            {scope.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="hours_worked">Hours Worked</Label>
                      <Input
                        id="hours_worked"
                        type="number"
                        step="0.5"
                        value={formData.hours_worked}
                        onChange={(e) => setFormData((prev) => ({ ...prev, hours_worked: e.target.value }))}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="overtime_hours">Overtime Hours</Label>
                      <Input
                        id="overtime_hours"
                        type="number"
                        step="0.5"
                        value={formData.overtime_hours}
                        onChange={(e) => setFormData((prev) => ({ ...prev, overtime_hours: e.target.value }))}
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="status">Status</Label>
                    <Select value={formData.status} onValueChange={(value: AttendanceRecord["status"]) => setFormData((prev) => ({ ...prev, status: value }))}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ATTENDANCE_STATUS.map((status) => (
                          <SelectItem key={status.value} value={status.value}>
                            {status.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="notes">Notes (Optional)</Label>
                    <Input
                      id="notes"
                      value={formData.notes}
                      onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>

                  <Button type="submit" className="w-full">
                    Mark Attendance
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading attendance records...</div>
          ) : attendance.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">No attendance records yet</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">Attendance History</p>
                    <p className="text-xs text-muted-foreground">
                      Review attendance by worker, position, attendance status, and date range.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8 px-3 text-xs"
                      onClick={() => setFiltersOpen((current) => !current)}
                    >
                      <Filter className="mr-2 h-3.5 w-3.5" />
                      {filtersOpen ? "Hide filters" : "Filter"}
                    </Button>
                    {filtersOpen ? (
                      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={clearFilters}>
                        Clear filters
                      </Button>
                    ) : null}
                  </div>
                </div>

                {filtersOpen ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <div className="space-y-1">
                      <Label htmlFor="attendance-history-worker" className="text-[11px]">
                        Worker
                      </Label>
                      <Select
                        value={filters.personnelId}
                        onValueChange={(value) => setFilters((current) => ({ ...current, personnelId: value }))}
                      >
                        <SelectTrigger id="attendance-history-worker" className="h-8 text-xs">
                          <SelectValue placeholder="All workers" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All workers</SelectItem>
                          {workerOptions.map((worker) => (
                            <SelectItem key={worker.id} value={worker.id}>
                              {worker.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="attendance-history-role" className="text-[11px]">
                        Position
                      </Label>
                      <Select value={filters.role} onValueChange={(value) => setFilters((current) => ({ ...current, role: value }))}>
                        <SelectTrigger id="attendance-history-role" className="h-8 text-xs">
                          <SelectValue placeholder="All positions" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All positions</SelectItem>
                          {roleOptions.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="attendance-history-status" className="text-[11px]">
                        Status
                      </Label>
                      <Select
                        value={filters.status}
                        onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}
                      >
                        <SelectTrigger id="attendance-history-status" className="h-8 text-xs">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          {ATTENDANCE_STATUS.map((status) => (
                            <SelectItem key={status.value} value={status.value}>
                              {status.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="attendance-history-date-from" className="text-[11px]">
                        Date From
                      </Label>
                      <Input
                        id="attendance-history-date-from"
                        type="date"
                        className="h-8 text-xs"
                        value={filters.dateFrom}
                        onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="attendance-history-date-to" className="text-[11px]">
                        Date To
                      </Label>
                      <Input
                        id="attendance-history-date-to"
                        type="date"
                        className="h-8 text-xs"
                        value={filters.dateTo}
                        onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                      />
                    </div>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                  <span>{historySummary.recordCount} records</span>
                  <span>{historySummary.presentCount} present</span>
                  <span>{historySummary.absentCount} absent</span>
                  <span>{historySummary.lateCount} late</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Label className="text-xs text-muted-foreground whitespace-nowrap">Scope:</Label>
                <Select value={scopeFilter} onValueChange={setScopeFilter}>
                  <SelectTrigger className="h-8 w-[180px]">
                    <SelectValue placeholder="All Scopes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Scopes</SelectItem>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {scopesList.map((scope) => (
                      <SelectItem key={scope.id} value={scope.id}>
                        {scope.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Worker Name</TableHead>
                        <TableHead>Position</TableHead>
                        <TableHead>Scope of Work</TableHead>
                        <TableHead className="text-center min-w-[80px]">Hours</TableHead>
                        <TableHead className="text-center min-w-[80px]">OT Hrs</TableHead>
                        <TableHead className="text-right min-w-[100px]">Labor Cost</TableHead>
                        <TableHead className="min-w-[150px]">Notes</TableHead>
                        <TableHead className="text-center min-w-[100px]">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredAttendances.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                            No attendance records found
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {filteredAttendances.map((record) => {
                            const hrRate = Number(record.personnel?.hourly_rate || (record.personnel?.daily_rate ? record.personnel.daily_rate / 8 : 0));
                            const hoursWorked = Number(record.hours_worked || 0);
                            const overtimeHours = Number(record.overtime_hours || 0);
                            const regularCost = hoursWorked * hrRate;
                            const overtimeCost = overtimeHours * (hrRate * 1.5);
                            const laborCost = regularCost + overtimeCost;

                            return (
                              <TableRow key={record.id}>
                                <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                                <TableCell className="font-medium">{record.personnel?.name || "Unknown"}</TableCell>
                                <TableCell>{record.personnel?.role || "-"}</TableCell>
                                <TableCell>
                                  <Select
                                    value={record.bom_scope_id || "none"}
                                    onValueChange={(value) => void handleScopeChange(record.id, value)}
                                  >
                                    <SelectTrigger className="h-8 w-[180px]">
                                      <SelectValue placeholder="Select scope" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">No scope assigned</SelectItem>
                                      {scopesList.map((scope) => (
                                        <SelectItem key={scope.id} value={scope.id}>
                                          {scope.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </TableCell>
                                <TableCell>{record.hours_worked || 0}</TableCell>
                                <TableCell>{record.overtime_hours || 0}</TableCell>
                                <TableCell className="text-right font-medium">
                                  {formatCurrency(laborCost)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">{record.notes || "-"}</TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-1">
                                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(record)}>
                                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                        <path d="m15 5 4 4"/>
                                      </svg>
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={() => void handleDelete(record.id)}>
                                      <Trash2 className="h-4 w-4 text-destructive" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                            <TableCell colSpan={6} className="text-right">TOTAL</TableCell>
                            <TableCell className="text-right text-primary">
                              {formatCurrency(totalLaborCost)}
                            </TableCell>
                            <TableCell colSpan={2}></TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}