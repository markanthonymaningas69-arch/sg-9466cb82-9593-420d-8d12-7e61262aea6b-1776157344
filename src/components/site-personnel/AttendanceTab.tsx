import { useState, useEffect } from "react";
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
import { Users, Plus, Trash2, CheckCircle, XCircle, Clock } from "lucide-react";

interface AttendanceRecord {
  id: string;
  project_id: string;
  worker_name: string;
  position: string;
  date: string;
  time_in?: string;
  time_out?: string;
  status: "present" | "absent" | "late" | "half_day";
  notes?: string;
  created_at: string;
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
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    worker_name: "",
    position: "",
    date: new Date().toISOString().split("T")[0],
    time_in: "",
    time_out: "",
    status: "present" as AttendanceRecord["status"],
    notes: "",
  });

  useEffect(() => {
    void loadAttendance();
  }, [projectId]);

  async function loadAttendance() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("site_attendance")
        .select("*")
        .eq("project_id", projectId)
        .order("date", { ascending: false });

      if (error) throw error;
      setAttendance(data || []);
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

    try {
      const { error } = await supabase.from("site_attendance").insert({
        project_id: projectId,
        worker_name: formData.worker_name,
        position: formData.position,
        date: formData.date,
        time_in: formData.time_in || null,
        time_out: formData.time_out || null,
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
        worker_name: "",
        position: "",
        date: new Date().toISOString().split("T")[0],
        time_in: "",
        time_out: "",
        status: "present",
        notes: "",
      });
      void loadAttendance();
    } catch (error) {
      console.error("Error recording attendance:", error);
      toast({
        title: "Error",
        description: "Failed to record attendance",
        variant: "destructive",
      });
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this attendance record?")) return;

    try {
      const { error } = await supabase.from("site_attendance").delete().eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Attendance record deleted",
      });
      void loadAttendance();
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="worker_name">Worker Name</Label>
                    <Input
                      id="worker_name"
                      value={formData.worker_name}
                      onChange={(e) => setFormData((prev) => ({ ...prev, worker_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="position">Position</Label>
                    <Input
                      id="position"
                      value={formData.position}
                      onChange={(e) => setFormData((prev) => ({ ...prev, position: e.target.value }))}
                      required
                    />
                  </div>
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
                    <Label htmlFor="time_in">Time In (Optional)</Label>
                    <Input
                      id="time_in"
                      type="time"
                      value={formData.time_in}
                      onChange={(e) => setFormData((prev) => ({ ...prev, time_in: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label htmlFor="time_out">Time Out (Optional)</Label>
                    <Input
                      id="time_out"
                      type="time"
                      value={formData.time_out}
                      onChange={(e) => setFormData((prev) => ({ ...prev, time_out: e.target.value }))}
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Worker Name</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Time In</TableHead>
                  <TableHead>Time Out</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="w-[80px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {attendance.map((record) => {
                  const statusConfig = ATTENDANCE_STATUS.find((s) => s.value === record.status);
                  const StatusIcon = statusConfig?.icon || CheckCircle;

                  return (
                    <TableRow key={record.id}>
                      <TableCell>{new Date(record.date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{record.worker_name}</TableCell>
                      <TableCell>{record.position}</TableCell>
                      <TableCell>{record.time_in || "-"}</TableCell>
                      <TableCell>{record.time_out || "-"}</TableCell>
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
        </CardContent>
      </Card>
    </div>
  );
}