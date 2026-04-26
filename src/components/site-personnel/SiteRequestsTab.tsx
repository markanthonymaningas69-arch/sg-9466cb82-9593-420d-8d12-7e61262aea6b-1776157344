import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, Clock, FileText, Filter, Plus, XCircle } from "lucide-react";

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

const REQUEST_TYPE_OPTIONS = [
  { label: "Materials", value: "Materials" },
  { label: "Tools&Equipments", value: "Tools&Equipments" },
  { label: "Cash Advance", value: "Cash Advance" },
  { label: "Petty Cash", value: "Petty Cash" },
] as const;

const STATUS_CONFIG = {
  pending: { label: "Pending", icon: Clock, variant: "secondary" as const },
  approved: { label: "Approved", icon: CheckCircle, variant: "default" as const },
  rejected: { label: "Rejected", icon: XCircle, variant: "destructive" as const },
};

function getDefaultFormData() {
  return {
    request_type: "Materials",
    item_name: "",
    quantity: "",
    unit: "",
    requested_by: "",
    request_date: new Date().toISOString().split("T")[0],
    notes: "",
  };
}

function isCashRequestType(requestType: string) {
  return requestType === "Cash Advance" || requestType === "Petty Cash";
}

export function SiteRequestsTab({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const [requests, setRequests] = useState<SiteRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    requestType: "all",
    status: "all",
    item: "",
    dateFrom: "",
    dateTo: "",
  });
  const [formData, setFormData] = useState(getDefaultFormData);

  const filteredRequests = useMemo(() => {
    const itemQuery = filters.item.trim().toLowerCase();

    return requests.filter((request) => {
      if (filters.requestType !== "all" && request.request_type !== filters.requestType) {
        return false;
      }

      if (filters.status !== "all" && request.status !== filters.status) {
        return false;
      }

      if (itemQuery && !request.item_name.toLowerCase().includes(itemQuery) && !(request.notes || "").toLowerCase().includes(itemQuery)) {
        return false;
      }

      if (filters.dateFrom && request.request_date < filters.dateFrom) {
        return false;
      }

      if (filters.dateTo && request.request_date > filters.dateTo) {
        return false;
      }

      return true;
    });
  }, [filters, requests]);

  const historySummary = useMemo(() => {
    return {
      recordCount: filteredRequests.length,
      pendingCount: filteredRequests.filter((request) => request.status === "pending").length,
      approvedCount: filteredRequests.filter((request) => request.status === "approved").length,
      rejectedCount: filteredRequests.filter((request) => request.status === "rejected").length,
    };
  }, [filteredRequests]);

  const quantityLabel = isCashRequestType(formData.request_type) ? "Amount" : "Quantity";
  const unitLabel = isCashRequestType(formData.request_type) ? "Currency / Ref." : "Unit";
  const itemLabel = isCashRequestType(formData.request_type) ? "Purpose / Description" : "Item / Description";

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

  function clearFilters() {
    setFilters({
      requestType: "all",
      status: "all",
      item: "",
      dateFrom: "",
      dateTo: "",
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

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
      setFormData(getDefaultFormData());
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
          Requests
        </CardTitle>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              New Request
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Submit Request</DialogTitle>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-[11px]">Request Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {REQUEST_TYPE_OPTIONS.map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      variant={formData.request_type === option.value ? "default" : "outline"}
                      className="h-8 text-xs"
                      onClick={() => setFormData((current) => ({ ...current, request_type: option.value }))}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="item_name" className="text-[11px]">
                  {itemLabel}
                </Label>
                <Input
                  id="item_name"
                  className="h-8 text-xs"
                  value={formData.item_name}
                  onChange={(event) => setFormData((current) => ({ ...current, item_name: event.target.value }))}
                  placeholder={isCashRequestType(formData.request_type) ? "e.g., Fuel allowance for crew" : "e.g., Cement, Grinder, Safety Helmet"}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="quantity" className="text-[11px]">
                    {quantityLabel}
                  </Label>
                  <Input
                    id="quantity"
                    type="number"
                    step="0.01"
                    className="h-8 text-xs"
                    value={formData.quantity}
                    onChange={(event) => setFormData((current) => ({ ...current, quantity: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="unit" className="text-[11px]">
                    {unitLabel}
                  </Label>
                  <Input
                    id="unit"
                    className="h-8 text-xs"
                    value={formData.unit}
                    onChange={(event) => setFormData((current) => ({ ...current, unit: event.target.value }))}
                    placeholder={isCashRequestType(formData.request_type) ? "e.g., PHP / SOA" : "e.g., bags, pcs, set"}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="request_date" className="text-[11px]">
                    Request Date
                  </Label>
                  <Input
                    id="request_date"
                    type="date"
                    className="h-8 text-xs"
                    value={formData.request_date}
                    onChange={(event) => setFormData((current) => ({ ...current, request_date: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="requested_by" className="text-[11px]">
                    Requested By
                  </Label>
                  <Input
                    id="requested_by"
                    className="h-8 text-xs"
                    value={formData.requested_by}
                    onChange={(event) => setFormData((current) => ({ ...current, requested_by: event.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label htmlFor="notes" className="text-[11px]">
                  Notes
                </Label>
                <Textarea
                  id="notes"
                  rows={2}
                  className="min-h-[72px] text-xs"
                  value={formData.notes}
                  onChange={(event) => setFormData((current) => ({ ...current, notes: event.target.value }))}
                  placeholder="Add supporting details for this request"
                />
              </div>

              <Button type="submit" className="h-8 w-full text-xs">
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
          <div className="py-8 text-center text-muted-foreground">No requests submitted yet.</div>
        ) : (
          <div className="space-y-4">
            <div className="rounded-lg border bg-muted/30 p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">Request History</p>
                  <p className="text-xs text-muted-foreground">
                    Review requests with the same clean history pattern used across the other site tabs.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-xs" onClick={() => setFiltersOpen((open) => !open)}>
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
                <div className="mt-3 space-y-3">
                  <div className="space-y-1">
                    <Label className="text-[11px]">Request Type</Label>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant={filters.requestType === "all" ? "default" : "outline"} className="h-8 text-xs" onClick={() => setFilters((current) => ({ ...current, requestType: "all" }))}>
                        All Types
                      </Button>
                      {REQUEST_TYPE_OPTIONS.map((option) => (
                        <Button
                          key={option.value}
                          type="button"
                          variant={filters.requestType === option.value ? "default" : "outline"}
                          className="h-8 text-xs"
                          onClick={() => setFilters((current) => ({ ...current, requestType: option.value }))}
                        >
                          {option.label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="space-y-1">
                      <Label htmlFor="request-history-item" className="text-[11px]">
                        Item / Purpose
                      </Label>
                      <Input
                        id="request-history-item"
                        className="h-8 text-xs"
                        value={filters.item}
                        onChange={(event) => setFilters((current) => ({ ...current, item: event.target.value }))}
                        placeholder="Search description or notes"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="request-history-status" className="text-[11px]">
                        Status
                      </Label>
                      <Select value={filters.status} onValueChange={(value) => setFilters((current) => ({ ...current, status: value }))}>
                        <SelectTrigger id="request-history-status" className="h-8 text-xs">
                          <SelectValue placeholder="All statuses" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All statuses</SelectItem>
                          <SelectItem value="pending">Pending</SelectItem>
                          <SelectItem value="approved">Approved</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="request-history-date-from" className="text-[11px]">
                        Date From
                      </Label>
                      <Input
                        id="request-history-date-from"
                        type="date"
                        className="h-8 text-xs"
                        value={filters.dateFrom}
                        onChange={(event) => setFilters((current) => ({ ...current, dateFrom: event.target.value }))}
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="request-history-date-to" className="text-[11px]">
                        Date To
                      </Label>
                      <Input
                        id="request-history-date-to"
                        type="date"
                        className="h-8 text-xs"
                        value={filters.dateTo}
                        onChange={(event) => setFilters((current) => ({ ...current, dateTo: event.target.value }))}
                      />
                    </div>
                  </div>
                </div>
              ) : null}

              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>{historySummary.recordCount} requests</span>
                <span>{historySummary.pendingCount} pending</span>
                <span>{historySummary.approvedCount} approved</span>
                <span>{historySummary.rejectedCount} rejected</span>
              </div>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="rounded-lg border border-dashed py-8 text-center text-sm text-muted-foreground">
                No requests match the current filters.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Item / Purpose</TableHead>
                    <TableHead>Qty / Amount</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[110px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRequests.map((request) => {
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
                        <TableCell className="max-w-[220px] truncate text-sm text-muted-foreground">{request.notes || "—"}</TableCell>
                        <TableCell>
                          {request.status === "pending" ? (
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleStatusUpdate(request.id, "approved")}>
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => void handleStatusUpdate(request.id, "rejected")}>
                                <XCircle className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
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
  );
}