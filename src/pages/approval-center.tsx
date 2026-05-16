import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RequestDetailsButton } from "@/components/approval/RequestDetailsButton";
import {
  approvalCenterService,
  type ApprovalRequest,
  type ApprovalStatus,
  type WorkflowStatus,
} from "@/services/approvalCenterService";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RotateCcw, Trash2, Search, Loader2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

type ApprovalTabKey = "all" | "Purchasing" | "Accounting" | "HR" | "Site Personnel" | "Project Manager";

interface ApprovalTab {
  key: ApprovalTabKey;
  label: string;
  tone: string;
  activeTone: string;
}

const approvalTabs: ApprovalTab[] = [
  { key: "all", label: "All Requests", tone: "border-slate-200 bg-slate-50 text-slate-700", activeTone: "data-[state=active]:border-slate-700 data-[state=active]:bg-slate-700 data-[state=active]:text-white" },
  { key: "Purchasing", label: "Purchasing", tone: "border-amber-200 bg-amber-50 text-amber-800", activeTone: "data-[state=active]:border-amber-700 data-[state=active]:bg-amber-600 data-[state=active]:text-white" },
  { key: "Accounting", label: "Accounting", tone: "border-emerald-200 bg-emerald-50 text-emerald-800", activeTone: "data-[state=active]:border-emerald-700 data-[state=active]:bg-emerald-600 data-[state=active]:text-white" },
  { key: "HR", label: "HR", tone: "border-sky-200 bg-sky-50 text-sky-800", activeTone: "data-[state=active]:border-sky-700 data-[state=active]:bg-sky-600 data-[state=active]:text-white" },
  { key: "Site Personnel", label: "Site Personnel", tone: "border-violet-200 bg-violet-50 text-violet-800", activeTone: "data-[state=active]:border-violet-700 data-[state=active]:bg-violet-600 data-[state=active]:text-white" },
  { key: "Project Manager", label: "Project Manager", tone: "border-rose-200 bg-rose-50 text-rose-800", activeTone: "data-[state=active]:border-rose-700 data-[state=active]:bg-rose-600 data-[state=active]:text-white" },
];

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusBadgeClass(status: ApprovalStatus) {
  if (status === "approved") return "bg-emerald-600 text-white";
  if (status === "rejected") return "bg-rose-600 text-white";
  if (status === "returned_for_revision") return "bg-amber-500 text-white";
  return "bg-amber-500 text-white";
}

function workflowBadgeClass(status: WorkflowStatus) {
  if (status === "completed") return "bg-emerald-700 text-white";
  if (status === "in_purchasing") return "bg-amber-600 text-white";
  if (status === "in_accounting") return "bg-violet-600 text-white";
  if (status === "rejected") return "bg-rose-600 text-white";
  if (status === "returned_for_revision") return "bg-amber-500 text-white";
  if (status === "approved") return "bg-emerald-600 text-white";
  return "bg-amber-500 text-white";
}

function formatWorkflowStatus(status: WorkflowStatus) {
  return status.replaceAll("_", " ");
}

function getModuleTone(sourceModule: string) {
  return approvalTabs.find((tab) => tab.key === sourceModule)?.tone || approvalTabs[0].tone;
}

function canArchiveRequest(request: ApprovalRequest) {
  return request.status === "approved" && ["purchases", "site_requests", "cash_advance_requests", "leave_requests"].includes(request.sourceTable);
}

function getLinkedRequestDetails(request: ApprovalRequest) {
  if (request.sourceTable !== "site_requests" || !request.payload || Array.isArray(request.payload) || typeof request.payload !== "object") {
    return [];
  }

  const payload = request.payload as Record<string, unknown>;
  const quantity = payload.quantity;
  const unit = payload.unit;
  const amount = payload.amount;
  const quantityLabel =
    typeof quantity === "number" || typeof quantity === "string"
      ? `${quantity}${typeof unit === "string" && unit ? ` ${unit}` : ""}`
      : null;

  return [
    { label: "Requested Item", value: typeof payload.itemName === "string" ? payload.itemName : null },
    { label: "Quantity / Amount", value: quantityLabel },
    { label: "Request Date", value: typeof payload.requestDate === "string" ? new Date(payload.requestDate).toLocaleDateString() : null },
    { label: "Scope of Work", value: typeof payload.scopeName === "string" && payload.scopeName ? payload.scopeName : null },
    { label: "Recorded Amount", value: typeof amount === "number" ? amount.toLocaleString("en-US") : null },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value));
}

export default function ApprovalCenterPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ApprovalTabKey>("all");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState("");
  const [restoringId, setRestoringId] = useState("");
  const [permanentlyDeletingId, setPermanentlyDeletingId] = useState("");
  const [deletedRequests, setDeletedRequests] = useState<ApprovalRequest[]>([]);
  const [recycleBinOpen, setRecycleBinOpen] = useState(false);
  const [loadingDeleted, setLoadingDeleted] = useState(false);
  const [emptyDialogOpen, setEmptyDialogOpen] = useState(false);
  const [emptyingBin, setEmptyingBin] = useState(false);

  const filteredRequests = useMemo(() => {
    if (activeTab === "all") return requests;
    return requests.filter((request) => request.sourceModule === activeTab);
  }, [activeTab, requests]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || filteredRequests[0] || null,
    [filteredRequests, requests, selectedRequestId]
  );

  const selectedRequestDetails = useMemo(
    () => (selectedRequest ? getLinkedRequestDetails(selectedRequest) : []),
    [selectedRequest]
  );

  const pendingCounts = useMemo(() => {
    return approvalTabs.reduce<Record<ApprovalTabKey, number>>((accumulator, tab) => {
      const source = tab.key === "all" ? requests : requests.filter((request) => request.sourceModule === tab.key);
      accumulator[tab.key] = source.filter((request) => request.status === "pending").length;
      return accumulator;
    }, { all: 0, Purchasing: 0, Accounting: 0, HR: 0, "Site Personnel": 0, "Project Manager": 0 });
  }, [requests]);

  async function loadRequests() {
    const [activeData, deletedData] = await Promise.all([
      approvalCenterService.listRequests(),
      approvalCenterService.listDeletedRequests(),
    ]);
    setRequests(activeData);
    setDeletedRequests(deletedData);
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await loadRequests();
      } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "Failed to load approval requests", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    })();

    const channel = supabase
      .channel("approval_center_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_requests" }, () => {
        void loadRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  useEffect(() => {
    if (!selectedRequestId && filteredRequests[0]?.id) {
      setSelectedRequestId(filteredRequests[0].id);
    }
    if (selectedRequestId && !filteredRequests.find((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(filteredRequests[0]?.id || "");
    }
  }, [filteredRequests, selectedRequestId]);

  async function loadDeletedRequests() {
    setLoadingDeleted(true);
    try {
      const data = await approvalCenterService.listDeletedRequests();
      setDeletedRequests(data);
    } catch (error) {
      console.error("Error loading deleted requests:", error);
      toast({
        title: "Error",
        description: "Failed to load deleted requests",
        variant: "destructive",
      });
    } finally {
      setLoadingDeleted(false);
    }
  }

  async function handleDelete(request: ApprovalRequest) {
    try {
      setDeletingId(request.id);
      await approvalCenterService.softDeleteRequest(request.id);
      await loadRequests();
      if (selectedRequestId === request.id) {
        setSelectedRequestId("");
      }
      toast({
        title: "Moved to recycle bin",
        description: "The approval request was removed from the active list.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to move request to recycle bin",
        variant: "destructive",
      });
    } finally {
      setDeletingId("");
    }
  }

  async function handleRestore(request: ApprovalRequest) {
    try {
      setRestoringId(request.id);
      await approvalCenterService.restoreRequest(request.id);
      await loadRequests();
      toast({
        title: "Request restored",
        description: "The approval request is back in the active list.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to restore request",
        variant: "destructive",
      });
    } finally {
      setRestoringId("");
    }
  }

  async function handlePermanentDelete(request: ApprovalRequest) {
    const confirmed = window.confirm("Permanently delete this approval request from the recycle bin?");
    if (!confirmed) return;

    try {
      setPermanentlyDeletingId(request.id);
      await approvalCenterService.permanentlyDeleteRequest(request.id);
      await loadRequests();
      toast({
        title: "Request permanently deleted",
        description: "The approval request was removed from the recycle bin.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to permanently delete request",
        variant: "destructive",
      });
    } finally {
      setPermanentlyDeletingId("");
    }
  }

  async function handleRestoreRequest(id: string) {
    try {
      await approvalCenterService.restoreRequest(id);
      toast({
        title: "Request Restored",
        description: "Request has been restored successfully",
      });
      await Promise.all([loadDeletedRequests(), loadRequests()]);
    } catch (error) {
      console.error("Error restoring request:", error);
      toast({
        title: "Error",
        description: "Failed to restore request",
        variant: "destructive",
      });
    }
  }

  async function handlePermanentDelete(id: string) {
    if (!confirm("Permanently delete this request? This action cannot be undone.")) {
      return;
    }

    try {
      await approvalCenterService.permanentlyDeleteRequest(id);
      toast({
        title: "Request Deleted",
        description: "Request has been permanently deleted",
      });
      await loadDeletedRequests();
    } catch (error) {
      console.error("Error deleting request:", error);
      toast({
        title: "Error",
        description: "Failed to delete request permanently",
        variant: "destructive",
      });
    }
  }

  async function handleEmptyRecycleBin() {
    try {
      setEmptyingBin(true);
      
      const deletePromises = deletedRequests.map((request) =>
        approvalCenterService.permanentlyDeleteRequest(request.id)
      );
      
      await Promise.all(deletePromises);

      toast({
        title: "Recycle Bin Emptied",
        description: `${deletedRequests.length} requests permanently deleted`,
      });

      setEmptyDialogOpen(false);
      await loadDeletedRequests();
    } catch (error) {
      console.error("Error emptying recycle bin:", error);
      toast({
        title: "Error",
        description: "Failed to empty recycle bin",
        variant: "destructive",
      });
    } finally {
      setEmptyingBin(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="font-heading text-xl font-bold sm:text-2xl">Approval Center</h1>
            <p className="text-sm text-muted-foreground">
              Review centralized requests, open the full request details panel, and route approved work into the correct execution module.
            </p>
          </div>
          <Button variant="outline" className="border-slate-200 text-slate-700 hover:bg-slate-50" onClick={() => setRecycleBinOpen(true)}>
            Recycle Bin
            {deletedRequests.length > 0 ? (
              <Badge className="ml-2 h-5 rounded-sm bg-slate-700 px-1.5 text-[10px] text-white">
                {deletedRequests.length}
              </Badge>
            ) : null}
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ApprovalTabKey)} className="space-y-3">
          <div className="overflow-x-auto overflow-y-hidden rounded-lg border bg-card p-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TabsList className="inline-flex h-9 min-w-max flex-nowrap items-center justify-start gap-1 bg-transparent p-0">
              {approvalTabs.map((tab) => (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className={`h-7 shrink-0 whitespace-nowrap border px-2.5 text-[11px] font-medium ${tab.tone} ${tab.activeTone}`}
                >
                  <span>{tab.label}</span>
                  {pendingCounts[tab.key] > 0 ? (
                    <Badge className="ml-1 h-4 rounded-sm bg-black/15 px-1 text-[10px] text-current shadow-none">
                      {pendingCounts[tab.key]}
                    </Badge>
                  ) : null}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          <TabsContent value={activeTab} className="mt-0">
            <div className="grid gap-3">
              <Card>
                <CardHeader className="space-y-1 p-4">
                  <CardTitle className="text-base">{approvalTabs.find((tab) => tab.key === activeTab)?.label}</CardTitle>
                  <CardDescription className="text-xs">
                    Structured request review list with direct access to the full Request Details panel.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Loading approval requests...</div>
                  ) : filteredRequests.length === 0 ? (
                    <div className="rounded-b-lg border-t border-dashed py-10 text-center text-sm text-muted-foreground">
                      No approval requests in this category.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-y">
                            <TableHead className="h-9 text-[11px] uppercase tracking-wide">Source</TableHead>
                            <TableHead className="h-9 text-[11px] uppercase tracking-wide">Type</TableHead>
                            <TableHead className="h-9 text-[11px] uppercase tracking-wide">Requested By</TableHead>
                            <TableHead className="h-9 text-[11px] uppercase tracking-wide">Date & Time</TableHead>
                            <TableHead className="h-9 text-[11px] uppercase tracking-wide">Project</TableHead>
                            <TableHead className="h-9 text-[11px] uppercase tracking-wide">Status</TableHead>
                            <TableHead className="h-9 text-[11px] uppercase tracking-wide">Lifecycle</TableHead>
                            <TableHead className="h-9 text-right text-[11px] uppercase tracking-wide">Delete</TableHead>
                            <TableHead className="h-9 text-right text-[11px] uppercase tracking-wide">View Details</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRequests.map((request) => (
                            <TableRow
                              key={request.id}
                              className={`cursor-pointer text-xs ${selectedRequest?.id === request.id ? "bg-primary/5" : ""}`}
                              onClick={() => setSelectedRequestId(request.id)}
                            >
                              <TableCell className="py-2.5">
                                <Badge variant="outline" className={`border text-[10px] ${getModuleTone(request.sourceModule)}`}>
                                  {request.sourceModule}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5 font-medium">{request.requestType}</TableCell>
                              <TableCell className="py-2.5">{request.requestedBy}</TableCell>
                              <TableCell className="py-2.5 text-muted-foreground">{formatDateTime(request.requestedAt)}</TableCell>
                              <TableCell className="py-2.5">{request.projectName || "No project"}</TableCell>
                              <TableCell className="py-2.5">
                                <Badge className={`text-[10px] ${statusBadgeClass(request.status)}`}>
                                  {request.status.replaceAll("_", " ")}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-2.5">
                                <div className="space-y-1">
                                  <Badge className={`text-[10px] ${workflowBadgeClass(request.workflowStatus)}`}>
                                    {formatWorkflowStatus(request.workflowStatus)}
                                  </Badge>
                                  <p className="text-[11px] text-muted-foreground">{request.targetModule || "Unassigned"}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 border-rose-200 px-2 text-xs text-rose-700 hover:bg-rose-50"
                                  disabled={deletingId === request.id}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleDelete(request);
                                  }}
                                >
                                  {deletingId === request.id ? "Deleting..." : "Delete"}
                                </Button>
                              </TableCell>
                              <TableCell className="py-2.5 text-right">
                                <RequestDetailsButton request={request} allowActions onStatusUpdated={loadRequests} />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={recycleBinOpen} onOpenChange={setRecycleBinOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle>Approval Center Recycle Bin</DialogTitle>
                  <DialogDescription>
                    Restore or permanently delete approval requests
                  </DialogDescription>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setEmptyDialogOpen(true)}
                  disabled={deletedRequests.length === 0 || loadingDeleted}
                  className="h-8"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Empty Recycle Bin
                </Button>
              </div>
            </DialogHeader>

            {loadingDeleted ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : deletedRequests.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                Recycle bin is empty
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Request Type</TableHead>
                    <TableHead>Requested By</TableHead>
                    <TableHead>Module</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Summary</TableHead>
                    <TableHead>Deleted</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {deletedRequests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Badge variant="outline">{request.requestType}</Badge>
                      </TableCell>
                      <TableCell>{request.requestedBy}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{request.sourceModule}</Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        {new Date(request.requestedAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {request.summary}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {request.deletedAt ? new Date(request.deletedAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRestoreRequest(request.id)}
                          >
                            <RotateCcw className="mr-1 h-3.5 w-3.5" />
                            Restore
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => void handlePermanentDelete(request.id)}
                          >
                            <Trash2 className="mr-1 h-3.5 w-3.5" />
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </DialogContent>
        </Dialog>

        <AlertDialog open={emptyDialogOpen} onOpenChange={setEmptyDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Empty Recycle Bin?</AlertDialogTitle>
              <AlertDialogDescription>
                This action will permanently delete all {deletedRequests.length} approval requests in the recycle bin and cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={emptyingBin}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void handleEmptyRecycleBin()}
                disabled={emptyingBin}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {emptyingBin ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Confirm Delete
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}