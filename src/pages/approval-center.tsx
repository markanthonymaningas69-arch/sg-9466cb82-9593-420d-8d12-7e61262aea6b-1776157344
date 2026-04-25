import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  approvalCenterService,
  type ApprovalAction,
  type ApprovalRequest,
  type ApprovalStatus,
} from "@/services/approvalCenterService";

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
  return "bg-sky-600 text-white";
}

function getModuleTone(sourceModule: string) {
  return approvalTabs.find((tab) => tab.key === sourceModule)?.tone || approvalTabs[0].tone;
}

export default function ApprovalCenterPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ApprovalTabKey>("all");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [viewRequest, setViewRequest] = useState<ApprovalRequest | null>(null);
  const [viewActions, setViewActions] = useState<ApprovalAction[]>([]);
  const [viewLoading, setViewLoading] = useState(false);

  const filteredRequests = useMemo(() => {
    if (activeTab === "all") return requests;
    return requests.filter((request) => request.sourceModule === activeTab);
  }, [activeTab, requests]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || filteredRequests[0] || null,
    [filteredRequests, requests, selectedRequestId]
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

  async function loadViewActions(requestId: string) {
    setViewLoading(true);
    const data = await approvalCenterService.listActions(requestId);
    setViewActions(data);
    setViewLoading(false);
  }

  async function handleOpenView(request: ApprovalRequest) {
    setSelectedRequestId(request.id);
    setViewRequest(request);
    setViewOpen(true);
    await loadViewActions(request.id);
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
      .on("postgres_changes", { event: "*", schema: "public", table: "approval_actions" }, () => {
        if (viewRequest?.id) void loadViewActions(viewRequest.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast, viewRequest?.id]);

  useEffect(() => {
    if (!selectedRequestId && filteredRequests[0]?.id) {
      setSelectedRequestId(filteredRequests[0].id);
    }
    if (selectedRequestId && !filteredRequests.find((request) => request.id === selectedRequestId)) {
      setSelectedRequestId(filteredRequests[0]?.id || "");
    }
  }, [filteredRequests, selectedRequestId]);

  async function handleAction(status: ApprovalStatus) {
    if (!selectedRequest?.id) return;

    try {
      setActing(true);
      await approvalCenterService.updateStatus(selectedRequest.id, status, comment);
      await loadRequests();
      if (viewRequest?.id === selectedRequest.id) {
        await loadViewActions(selectedRequest.id);
      }
      setComment("");
      toast({
        title: "Approval updated",
        description: `Request marked as ${status.replaceAll("_", " ")}.`,
      });
    } catch (error) {
      console.error(error);
      toast({ title: "Error", description: "Failed to update approval request", variant: "destructive" });
    } finally {
      setActing(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="font-heading text-xl font-bold sm:text-2xl">Approval Center</h1>
          <p className="text-sm text-muted-foreground">
            Review Purchasing, Accounting, HR, Site Personnel, and Project Manager requests in one place.
          </p>
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
                    {pendingCounts[tab.key]}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.65fr)_340px]">
              <Card>
                <CardHeader className="space-y-1 p-4">
                  <CardTitle className="text-base">
                    {approvalTabs.find((tab) => tab.key === activeTab)?.label}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Denser review list with quick access to request details and audit trail.
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
                            <TableHead className="h-9 text-right text-[11px] uppercase tracking-wide">View</TableHead>
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
                              <TableCell className="py-2.5 text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    void handleOpenView(request);
                                  }}
                                >
                                  View
                                </Button>
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
                  <CardTitle className="text-base">Request Details</CardTitle>
                  <CardDescription className="text-xs">
                    Review context, add notes, and update the request status.
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
                          <p><span className="font-medium text-foreground">Date/time:</span> {formatDateTime(selectedRequest.requestedAt)}</p>
                          <p><span className="font-medium text-foreground">Related project:</span> {selectedRequest.projectName || "No project"}</p>
                          <p><span className="font-medium text-foreground">Summary:</span> {selectedRequest.summary || "No summary available"}</p>
                          {selectedRequest.latestComment ? (
                            <p><span className="font-medium text-foreground">Latest comment:</span> {selectedRequest.latestComment}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Comments</label>
                        <Textarea
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          placeholder="Add review notes, rejection reason, or revision instructions..."
                          rows={3}
                          className="text-sm"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Button size="sm" disabled={acting} onClick={() => void handleAction("approved")}>
                          Approve
                        </Button>
                        <Button size="sm" disabled={acting} variant="destructive" onClick={() => void handleAction("rejected")}>
                          Reject
                        </Button>
                        <Button size="sm" disabled={acting} variant="outline" onClick={() => void handleAction("returned_for_revision")}>
                          Return with comment
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => void handleOpenView(selectedRequest)}>
                          View audit trail
                        </Button>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={viewOpen} onOpenChange={setViewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="text-base">Request View</DialogTitle>
              <DialogDescription className="text-xs">
                Full request summary with audit trail history.
              </DialogDescription>
            </DialogHeader>

            {!viewRequest ? null : (
              <div className="space-y-4">
                <div className="grid gap-3 rounded-lg border p-3 text-xs text-muted-foreground sm:grid-cols-2">
                  <div className="space-y-1">
                    <p><span className="font-medium text-foreground">Module:</span> {viewRequest.sourceModule}</p>
                    <p><span className="font-medium text-foreground">Request type:</span> {viewRequest.requestType}</p>
                    <p><span className="font-medium text-foreground">Requested by:</span> {viewRequest.requestedBy}</p>
                  </div>
                  <div className="space-y-1">
                    <p><span className="font-medium text-foreground">Date/time:</span> {formatDateTime(viewRequest.requestedAt)}</p>
                    <p><span className="font-medium text-foreground">Project:</span> {viewRequest.projectName || "No project"}</p>
                    <p><span className="font-medium text-foreground">Status:</span> {viewRequest.status.replaceAll("_", " ")}</p>
                  </div>
                  <div className="sm:col-span-2">
                    <p><span className="font-medium text-foreground">Summary:</span> {viewRequest.summary || "No summary available"}</p>
                    {viewRequest.latestComment ? (
                      <p className="mt-1"><span className="font-medium text-foreground">Latest comment:</span> {viewRequest.latestComment}</p>
                    ) : null}
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Audit Trail</h3>
                    <p className="text-xs text-muted-foreground">
                      Logged status changes, comments, and reviewer activity.
                    </p>
                  </div>
                  <div className="max-h-[340px] space-y-2 overflow-y-auto pr-1">
                    {viewLoading ? (
                      <p className="text-sm text-muted-foreground">Loading audit trail...</p>
                    ) : viewActions.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
                    ) : (
                      viewActions.map((action) => (
                        <div key={action.id} className="rounded-md border bg-muted/20 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-medium text-foreground">{action.actorName}</span>
                            <Badge className={`text-[10px] ${statusBadgeClass(action.actionStatus)}`}>
                              {action.actionStatus.replaceAll("_", " ")}
                            </Badge>
                          </div>
                          <p className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(action.createdAt)}</p>
                          {action.comments ? (
                            <p className="mt-2 text-sm text-foreground">{action.comments}</p>
                          ) : null}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}