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
import { ArchiveViewer } from "@/components/ArchiveViewer";

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
  const [archivingId, setArchivingId] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);

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
    const data = await approvalCenterService.listRequests();
    setRequests(data);
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

  async function handleArchive(request: ApprovalRequest) {
    try {
      setArchivingId(request.id);
      await approvalCenterService.archiveRequest(request.id);
      await loadRequests();
      if (selectedRequestId === request.id) {
        setSelectedRequestId("");
      }
      setArchiveOpen(true);
      toast({
        title: "Moved to GM Vault",
        description: "The approved record was archived and is now available in the GM Vault.",
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to archive record to GM Vault",
        variant: "destructive",
      });
    } finally {
      setArchivingId("");
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
          <Button variant="outline" className="border-amber-200 text-amber-800 hover:bg-amber-50" onClick={() => setArchiveOpen(true)}>
            Open GM Vault
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ApprovalTabKey)} className="space-y-3">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1.5 bg-transparent p-0">
            {approvalTabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className={`h-8 gap-2 border px-2.5 text-xs font-medium ${tab.tone} ${tab.activeTone}`}
              >
                <span>{tab.label}</span>
                {pendingCounts[tab.key] > 0 ? (
                  <Badge className="h-4 rounded-sm bg-black/15 px-1.5 text-[10px] text-current shadow-none">
                    NEW {pendingCounts[tab.key]}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_340px]">
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
                            <TableHead className="h-9 text-right text-[11px] uppercase tracking-wide">Archive</TableHead>
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
                                {canArchiveRequest(request) ? (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 border-amber-200 px-2 text-xs text-amber-800 hover:bg-amber-50"
                                    disabled={archivingId === request.id}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      void handleArchive(request);
                                    }}
                                  >
                                    {archivingId === request.id ? "Archiving..." : "Archive"}
                                  </Button>
                                ) : (
                                  <span className="text-[11px] text-muted-foreground">—</span>
                                )}
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

              <Card>
                <CardHeader className="space-y-1 p-4">
                  <CardTitle className="text-base">Selected Request</CardTitle>
                  <CardDescription className="text-xs">
                    Preview request context here, then open Request Details to review notes, audit trail, and pending actions.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 p-4 pt-0">
                  {!selectedRequest ? (
                    <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                      Select a request to review details.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 rounded-lg border p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1">
                            <Badge variant="outline" className={`border text-[10px] ${getModuleTone(selectedRequest.sourceModule)}`}>
                              {selectedRequest.sourceModule}
                            </Badge>
                            <h2 className="text-sm font-semibold text-foreground">{selectedRequest.requestType}</h2>
                          </div>
                          <Badge className={`text-[10px] ${statusBadgeClass(selectedRequest.status)}`}>
                            {selectedRequest.status.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <div className="grid gap-1.5 text-xs text-muted-foreground">
                          <p><span className="font-medium text-foreground">Requested by:</span> {selectedRequest.requestedBy}</p>
                          <p><span className="font-medium text-foreground">Date / time:</span> {formatDateTime(selectedRequest.requestedAt)}</p>
                          <p><span className="font-medium text-foreground">Related project:</span> {selectedRequest.projectName || "No project"}</p>
                          <p><span className="font-medium text-foreground">Target module:</span> {selectedRequest.targetModule || "Unassigned"}</p>
                          <p><span className="font-medium text-foreground">Lifecycle status:</span> {formatWorkflowStatus(selectedRequest.workflowStatus)}</p>
                          <p><span className="font-medium text-foreground">Summary:</span> {selectedRequest.summary || "No summary available"}</p>
                        </div>
                        {selectedRequestDetails.length > 0 ? (
                          <div className="grid gap-1.5 border-t pt-2 text-xs text-muted-foreground">
                            {selectedRequestDetails.map((detail) => (
                              <p key={detail.label}>
                                <span className="font-medium text-foreground">{detail.label}:</span> {detail.value}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid gap-2">
                        <RequestDetailsButton request={selectedRequest} allowActions onStatusUpdated={loadRequests} />
                        {canArchiveRequest(selectedRequest) ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-amber-200 text-amber-800 hover:bg-amber-50"
                            disabled={archivingId === selectedRequest.id}
                            onClick={() => void handleArchive(selectedRequest)}
                          >
                            {archivingId === selectedRequest.id ? "Archiving..." : "Archive to GM Vault"}
                          </Button>
                        ) : null}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <ArchiveViewer open={archiveOpen} onOpenChange={setArchiveOpen} />
      </div>
    </Layout>
  );
}