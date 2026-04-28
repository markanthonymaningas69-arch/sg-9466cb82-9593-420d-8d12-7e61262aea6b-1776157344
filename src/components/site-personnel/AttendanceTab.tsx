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
  created_at: string;
  personnel?: {
    name: string;
    role: string;
  };
}

interface Personnel {
  id: string;
  name: string;
  role: string;
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    personnelId: "all",
    role: "all",
    status: "all",
    dateFrom: "",
    dateTo: "",
  });

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

      // Load attendance
      const { data, error } = await supabase
        .from("site_attendance")
        .select(`
          *,
          personnel (name, role)
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
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance recorded",
      });

      setDialogOpen(false);
      setFormData({
        personnel_id: "",
        date: new Date().toISOString().split("T")[0],
        time_in: "",
        hours_worked: "8",
        overtime_hours: "0",
        status: "present",
        notes: "",
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

              {filteredAttendance.length === 0 ? (
                <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                  No attendance records match the current filters.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Worker Name</TableHead>
                      <TableHead>Position</TableHead>
                      <TableHead>Hours</TableHead>
                      <TableHead>Overtime</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="w-[80px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAttendance.map((record) => {
                      const statusConfig = ATTENDANCE_STATUS.find((s) => s.value === record.status);
                      const StatusIcon = statusConfig?.icon || CheckCircle;

                      return (
                        <TableRow key={record.id}>
                          <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                          <TableCell className="font-medium">{record.personnel?.name || "Unknown"}</TableCell>
                          <TableCell>{record.personnel?.role || "-"}</TableCell>
                          <TableCell>{record.hours_worked || 0}</TableCell>
                          <TableCell>{record.overtime_hours || 0}</TableCell>
                          <TableCell>
                            <Badge variant={statusConfig?.variant} className="gap-1">
                              <StatusIcon className="h-3 w-3" />
                              {statusConfig?.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{record.notes || "-"}</TableCell>
                          <TableCell>
                            <Button variant="ghost" size="icon" onClick={() => void handleDelete(record.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}