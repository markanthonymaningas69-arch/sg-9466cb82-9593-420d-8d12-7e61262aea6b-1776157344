import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { FileText, Plus, CheckCircle, XCircle, Clock } from "lucide-react";

interface SiteRequest {
  id: string;
  project_id: string;
  request_type: string;
  item_name: string;
  quantity: number;
  unit: string;
  requested_by: string;
  request_date: string;
  status: string;
  notes?: string;
  created_at: string;
}

const REQUEST_TYPES = [
  "Material Request",
  "Tool Request",
  "Equipment Request",
  "Manpower Request",
  "Other",
];

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" as const },
  approved: { label: "Approved", icon: CheckCircle, variant: "default" as const },
  rejected: { label: "Rejected", icon: XCircle, variant: "destructive" as const },
};

export function SiteRequestsTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<SiteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    request_type: "Material Request",
    item_name: "",
    quantity: "",
    unit: "",
    requested_by: "",
    request_date: new Date().toISOString().split("T")[0],
    notes: "",
  });

  useEffect(() => {
    void loadRequests();
  }, [projectId]);

  async function loadRequests() {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from("site_requests")
        .select("*")
        .eq("project_id", projectId)
        .order("request_date", { ascending: false });

      if (error) throw error;
      setRequests(data || []);
    } catch (error) {
      console.error("Error loading requests:", error);
      toast({
        title: "Error",
        description: "Failed to load site requests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const { error } = await supabase.from("site_requests").insert({
        project_id: projectId,
        request_type: formData.request_type,
        item_name: formData.item_name,
        quantity: Number(formData.quantity),
        unit: formData.unit,
        requested_by: formData.requested_by,
        request_date: formData.request_date,
        status: "pending",
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Request submitted successfully",
      });

      setDialogOpen(false);
      setFormData({
        request_type: "Material Request",
        item_name: "",
        quantity: "",
        unit: "",
        requested_by: "",
        request_date: new Date().toISOString().split("T")[0],
        notes: "",
      });
      void loadRequests();
    } catch (error) {
      console.error("Error creating request:", error);
      toast({
        title: "Error",
        description: "Failed to submit request",
        variant: "destructive",
      });
    }
  }

  async function handleStatusUpdate(id: string, status: "approved" | "rejected") {
    try {
      const { error } = await supabase
        .from("site_requests")
        .update({
          status,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Request ${status}`,
      });
      void loadRequests();
    } catch (error) {
      console.error("Error updating request:", error);
      toast({
        title: "Error",
        description: "Failed to update request",
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Site Requests
        </CardTitle>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Submit Site Request</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="request_type">Request Type</Label>
                <Select value={formData.request_type} onValueChange={(value) => setFormData((prev) => ({ ...prev, request_type: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REQUEST_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="item_name">Item/Description</Label>
                <Input
                  id="item_name"
                  value={formData.item_name}
                  onChange={(e) => setFormData((prev) => ({ ...prev, item_name: e.target.value }))}
                  placeholder="e.g., Cement, Welding Machine, Mason"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="quantity">Quantity</Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    value={formData.quantity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, quantity: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    value={formData.unit}
                    onChange={(e) => setFormData((prev) => ({ ...prev, unit: e.target.value }))}
                    placeholder="e.g., bags, pcs, workers"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="request_date">Request Date</Label>
                  <Input
                    id="request_date"
                    type="date"
                    value={formData.request_date}
                    onChange={(e) => setFormData((prev) => ({ ...prev, request_date: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="requested_by">Requested By</Label>
                  <Input
                    id="requested_by"
                    value={formData.requested_by}
                    onChange={(e) => setFormData((prev) => ({ ...prev, requested_by: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes (Optional)</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Additional details..."
                  rows={3}
                />
              </div>

              <Button type="submit" className="w-full">
                Submit Request
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No requests submitted yet</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Item</TableHead>
                <TableHead>Quantity</TableHead>
                <TableHead>Requested By</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => {
                const statusKey = request.status as "pending" | "approved" | "rejected";
                const statusConfig = STATUS_CONFIG[statusKey] || STATUS_CONFIG.pending;
                const StatusIcon = statusConfig.icon;

                return (
                  <TableRow key={request.id}>
                    <TableCell>{new Date(request.request_date).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{request.request_type}</TableCell>
                    <TableCell className="font-medium">{request.item_name}</TableCell>
                    <TableCell>
                      {request.quantity} {request.unit}
                    </TableCell>
                    <TableCell>{request.requested_by}</TableCell>
                    <TableCell>
                      <Badge variant={statusConfig.variant} className="gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusConfig.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{request.notes || "-"}</TableCell>
                    <TableCell>
                      {request.status === "pending" && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleStatusUpdate(request.id, "approved")}>
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleStatusUpdate(request.id, "rejected")}>
                            <XCircle className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}