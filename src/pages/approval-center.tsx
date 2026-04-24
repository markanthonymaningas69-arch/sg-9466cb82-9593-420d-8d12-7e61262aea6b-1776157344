import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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

const approvalTabs: Array<{ key: ApprovalTabKey; label: string }> = [
  { key: "all", label: "All Requests" },
  { key: "Purchasing", label: "Purchasing" },
  { key: "Accounting", label: "Accounting" },
  { key: "HR", label: "HR" },
  { key: "Site Personnel", label: "Site Personnel" },
  { key: "Project Manager", label: "Project Manager" },
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
  if (status === "approved") {
    return "bg-green-600 text-white";
  }

  if (status === "rejected") {
    return "bg-red-600 text-white";
  }

  if (status === "returned_for_revision") {
    return "bg-amber-500 text-white";
  }

  return "bg-blue-600 text-white";
}

export default function ApprovalCenterPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<ApprovalTabKey>("all");
  const [requests, setRequests] = useState<ApprovalRequest[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string>("");
  const [actions, setActions] = useState<ApprovalAction[]>([]);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const filteredRequests = useMemo(() => {
    if (activeTab === "all") {
      return requests;
    }

    return requests.filter((request) => request.sourceModule === activeTab);
  }, [activeTab, requests]);

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) || null,
    [requests, selectedRequestId]
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

  async function loadActions(requestId: string) {
    const data = await approvalCenterService.listActions(requestId);
    setActions(data);
  }

  useEffect(() => {
    void (async () => {
      try {
        setLoading(true);
        await loadRequests();
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "Failed to load approval requests",
          variant: "destructive",
        });
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
        if (selectedRequestId) {
          void loadActions(selectedRequestId);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedRequestId, toast]);

  useEffect(() => {
    const nextSelected = filteredRequests.find((request) => request.id === selectedRequestId) || filteredRequests[0] || null;
    setSelectedRequestId(nextSelected?.id || "");
  }, [filteredRequests, selectedRequestId]);

  useEffect(() => {
    if (!selectedRequestId) {
      setActions([]);
      return;
    }

    void loadActions(selectedRequestId);
  }, [selectedRequestId]);

  async function handleAction(status: ApprovalStatus) {
    if (!selectedRequestId) {
      return;
    }

    try {
      setActing(true);
      await approvalCenterService.updateStatus(selectedRequestId, status, comment);
      await loadRequests();
      await loadActions(selectedRequestId);
      setComment("");
      toast({
        title: "Approval updated",
        description: `Request marked as ${status.replaceAll("_", " ")}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update approval request",
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold">Approval Center</h1>
          <p className="text-muted-foreground mt-1">
            Centralized review for Purchasing, Accounting, HR, Site Personnel, and Project Manager requests.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ApprovalTabKey)} className="space-y-4">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0">
            {approvalTabs.map((tab) => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className="h-10 gap-2 border border-border bg-card px-3 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                <span>{tab.label}</span>
                {pendingCounts[tab.key] > 0 ? (
                  <Badge variant="destructive" className="h-5 px-2 text-[10px]">
                    NEW {pendingCounts[tab.key]}
                  </Badge>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value={activeTab} className="mt-0">
            <div className="grid gap-4 xl:grid-cols-[1.4fr_0.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>{approvalTabs.find((tab) => tab.key === activeTab)?.label}</CardTitle>
                  <CardDescription>
                    Review requests by source module with centralized actions and status history.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="py-10 text-center text-sm text-muted-foreground">Loading approval requests...</div>
                  ) : filteredRequests.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                      No approval requests in this category.
                    </div>
                  ) : (
                    <div className="overflow-hidden rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Source</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Requested By</TableHead>
                            <TableHead>Date & Time</TableHead>
                            <TableHead>Project</TableHead>
                            <TableHead>Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredRequests.map((request) => (
                            <TableRow
                              key={request.id}
                              className={selectedRequestId === request.id ? "bg-primary/5" : "cursor-pointer"}
                              onClick={() => setSelectedRequestId(request.id)}
                            >
                              <TableCell className="font-medium">{request.sourceModule}</TableCell>
                              <TableCell>{request.requestType}</TableCell>
                              <TableCell>{request.requestedBy}</TableCell>
                              <TableCell>{formatDateTime(request.requestedAt)}</TableCell>
                              <TableCell>{request.projectName || "No project"}</TableCell>
                              <TableCell>
                                <Badge className={statusBadgeClass(request.status)}>
                                  {request.status.replaceAll("_", " ")}
                                </Badge>
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
                <CardHeader>
                  <CardTitle>Request Details</CardTitle>
                  <CardDescription>View request context, add comments, and record approval actions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!selectedRequest ? (
                    <div className="rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
                      Select a request to review details and action history.
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2 rounded-lg border p-4">
                        <div className="flex items-center justify-between gap-3">
                          <h2 className="font-semibold text-foreground">{selectedRequest.requestType}</h2>
                          <Badge className={statusBadgeClass(selectedRequest.status)}>
                            {selectedRequest.status.replaceAll("_", " ")}
                          </Badge>
                        </div>
                        <div className="grid gap-2 text-sm text-muted-foreground">
                          <p><span className="font-medium text-foreground">Source module:</span> {selectedRequest.sourceModule}</p>
                          <p><span className="font-medium text-foreground">Requested by:</span> {selectedRequest.requestedBy}</p>
                          <p><span className="font-medium text-foreground">Date/time:</span> {formatDateTime(selectedRequest.requestedAt)}</p>
                          <p><span className="font-medium text-foreground">Related project:</span> {selectedRequest.projectName || "No project"}</p>
                          <p><span className="font-medium text-foreground">Summary:</span> {selectedRequest.summary || "No summary available"}</p>
                          {selectedRequest.latestComment ? (
                            <p><span className="font-medium text-foreground">Latest comment:</span> {selectedRequest.latestComment}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-medium text-foreground">Comments</label>
                        <Textarea
                          value={comment}
                          onChange={(event) => setComment(event.target.value)}
                          placeholder="Add review notes, rejection reason, or revision instructions..."
                          rows={4}
                        />
                      </div>

                      <div className="grid gap-2 sm:grid-cols-3">
                        <Button disabled={acting} onClick={() => void handleAction("approved")}>
                          Approve
                        </Button>
                        <Button disabled={acting} variant="destructive" onClick={() => void handleAction("rejected")}>
                          Reject
                        </Button>
                        <Button disabled={acting} variant="outline" onClick={() => void handleAction("returned_for_revision")}>
                          Return with comment
                        </Button>
                      </div>

                      <div className="space-y-3 rounded-lg border p-4">
                        <div>
                          <h3 className="font-semibold text-foreground">Audit Trail</h3>
                          <p className="text-sm text-muted-foreground">
                            All approval actions are logged with actor, timestamp, status, and comments.
                          </p>
                        </div>
                        <div className="space-y-3">
                          {actions.length === 0 ? (
                            <p className="text-sm text-muted-foreground">No actions recorded yet.</p>
                          ) : (
                            actions.map((action) => (
                              <div key={action.id} className="rounded-md border bg-muted/30 p-3">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="font-medium text-foreground">{action.actorName}</span>
                                  <Badge className={statusBadgeClass(action.actionStatus)}>
                                    {action.actionStatus.replaceAll("_", " ")}
                                  </Badge>
                                </div>
                                <p className="mt-1 text-xs text-muted-foreground">{formatDateTime(action.createdAt)}</p>
                                {action.comments ? (
                                  <p className="mt-2 text-sm text-foreground">{action.comments}</p>
                                ) : null}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}