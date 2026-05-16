import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  approvalCenterService,
  type ApprovalAction,
  type ApprovalRequest,
  type ApprovalStatus,
  type WorkflowStatus,
} from "@/services/approvalCenterService";

interface RequestDetailsButtonProps {
  request: ApprovalRequest;
  allowActions?: boolean;
  onStatusUpdated?: () => Promise<void> | void;
}

interface AuditEntry {
  id: string;
  label: string;
  actorName: string;
  createdAt: string;
  comments: string | null;
  tone: string;
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatStatusLabel(value: string) {
  return value.replaceAll("_", " ");
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
    { label: "Scope of Work", value: typeof payload.scopeName === "string" && payload.scopeName ? payload.scopeName : null },
    { label: "Request Date", value: typeof payload.requestDate === "string" ? new Date(payload.requestDate).toLocaleDateString() : null },
    { label: "Recorded Amount", value: typeof amount === "number" ? amount.toLocaleString("en-US") : null },
  ].filter((detail): detail is { label: string; value: string } => Boolean(detail.value));
}

function getAuditLabel(status: ApprovalStatus) {
  if (status === "approved") return "Approved";
  if (status === "rejected") return "Rejected";
  if (status === "returned_for_revision") return "Returned for Revision";
  return "Reviewed";
}

function getAuditTone(status: ApprovalStatus) {
  if (status === "approved") return "border-emerald-200 bg-emerald-50";
  if (status === "rejected") return "border-rose-200 bg-rose-50";
  if (status === "returned_for_revision") return "border-amber-200 bg-amber-50";
  return "border-slate-200 bg-slate-50";
}

export function RequestDetailsButton({
  request,
  allowActions = false,
  onStatusUpdated,
}: RequestDetailsButtonProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [acting, setActing] = useState(false);
  const [actions, setActions] = useState<ApprovalAction[]>([]);
  const [loadingActions, setLoadingActions] = useState(false);
  const [showAuditTrail, setShowAuditTrail] = useState(false);

  const canTakeAction = allowActions && request.status === "pending";
  const linkedDetails = useMemo(() => getLinkedRequestDetails(request), [request]);

  const auditEntries = useMemo<AuditEntry[]>(() => {
    const createdEntry: AuditEntry = {
      id: `created-${request.id}`,
      label: "Request Created",
      actorName: request.requestedBy,
      createdAt: request.requestedAt,
      comments: request.summary,
      tone: "border-sky-200 bg-sky-50",
    };

    const actionEntries = actions.map((action) => ({
      id: action.id,
      label: getAuditLabel(action.actionStatus),
      actorName: action.actorName,
      createdAt: action.createdAt,
      comments: action.comments,
      tone: getAuditTone(action.actionStatus),
    }));

    const workflowEntries: AuditEntry[] = [];
    
    if (request.routedAt && request.targetModule) {
      workflowEntries.push({
        id: `routed-${request.id}`,
        label: `Routed to ${request.targetModule}`,
        actorName: "System",
        createdAt: request.routedAt,
        comments: `Request forwarded to ${request.targetModule} for processing`,
        tone: "border-violet-200 bg-violet-50",
      });
    }

    if (request.processedAt) {
      workflowEntries.push({
        id: `processed-${request.id}`,
        label: "Processing Started",
        actorName: request.targetModule || "System",
        createdAt: request.processedAt,
        comments: `${request.targetModule || "Module"} started processing this request`,
        tone: "border-amber-200 bg-amber-50",
      });
    }

    if (request.completedAt) {
      workflowEntries.push({
        id: `completed-${request.id}`,
        label: "Request Completed",
        actorName: request.targetModule || "System",
        createdAt: request.completedAt,
        comments: "Request lifecycle completed successfully",
        tone: "border-emerald-200 bg-emerald-50",
      });
    }

    return [createdEntry, ...actionEntries, ...workflowEntries].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }, [actions, request]);

  useEffect(() => {
    if (!open) {
      setComment("");
      setShowAuditTrail(false);
      return;
    }

    void (async () => {
      try {
        setLoadingActions(true);
        const data = await approvalCenterService.listActions(request.id);
        setActions(data);
      } catch (error) {
        console.error(error);
        toast({
          title: "Error",
          description: "Failed to load request audit trail",
          variant: "destructive",
        });
      } finally {
        setLoadingActions(false);
      }
    })();
  }, [open, request.id, toast]);

  async function handleAction(status: ApprovalStatus) {
    if ((status === "rejected" || status === "returned_for_revision") && !comment.trim()) {
      toast({
        title: "Comment required",
        description: status === "rejected" ? "Reject requires a comment." : "Return requires a comment.",
        variant: "destructive",
      });
      return;
    }

    try {
      setActing(true);
      await approvalCenterService.updateStatus(request.id, status, comment.trim());
      await onStatusUpdated?.();
      setOpen(false);
      toast({
        title: "Request updated",
        description: `Request marked as ${formatStatusLabel(status)}.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to update request status",
        variant: "destructive",
      });
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs"
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
      >
        View Details
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <div className="flex max-h-[90vh] flex-col">
            <DialogHeader className="border-b px-6 py-4">
              <DialogTitle className="text-lg font-semibold">Request Details</DialogTitle>
              <DialogDescription className="text-sm">
                Review context, lifecycle history, and update request status
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5 overflow-y-auto px-6 py-5">
              <section className="space-y-3 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">General Info</h3>
                    <p className="text-xs text-muted-foreground">Core request identity and lifecycle context.</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Badge className={`text-[11px] ${statusBadgeClass(request.status)}`}>
                      {formatStatusLabel(request.status)}
                    </Badge>
                    <Badge className={`text-[11px] ${workflowBadgeClass(request.workflowStatus)}`}>
                      {formatStatusLabel(request.workflowStatus)}
                    </Badge>
                  </div>
                </div>

                <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                  <div className="space-y-2">
                    <p><span className="font-medium text-foreground">Request Type:</span> {request.requestType}</p>
                    <p><span className="font-medium text-foreground">Requested by:</span> {request.requestedBy}</p>
                    <p><span className="font-medium text-foreground">Date / Time:</span> {formatDateTime(request.requestedAt)}</p>
                    <p><span className="font-medium text-foreground">Related Project:</span> {request.projectName || "No project"}</p>
                  </div>
                  <div className="space-y-2">
                    <p><span className="font-medium text-foreground">Source Module:</span> {request.sourceModule}</p>
                    <p><span className="font-medium text-foreground">Target Module:</span> {request.targetModule || "Unassigned"}</p>
                    <p><span className="font-medium text-foreground">Lifecycle Status:</span> {formatStatusLabel(request.workflowStatus)}</p>
                    {request.routedAt ? (
                      <p><span className="font-medium text-foreground">Routed At:</span> {formatDateTime(request.routedAt)}</p>
                    ) : null}
                  </div>
                </div>
              </section>

              <section className="space-y-3 rounded-lg border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Request Details</h3>
                  <p className="text-xs text-muted-foreground">Requested item and linked transaction context.</p>
                </div>

                {linkedDetails.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No additional request details recorded.</p>
                ) : (
                  <div className="grid gap-3 text-sm text-muted-foreground sm:grid-cols-2">
                    {linkedDetails.map((detail) => (
                      <div key={detail.label} className="rounded-md bg-muted/30 p-3">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{detail.label}</p>
                        <p className="mt-1.5 text-sm font-medium text-foreground">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              <section className="space-y-3 rounded-lg border p-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Summary</h3>
                  <p className="text-xs text-muted-foreground">Short description for fast review.</p>
                </div>
                <div className="rounded-md bg-muted/30 p-3.5 text-sm leading-relaxed text-foreground">
                  {request.summary || "No summary available"}
                </div>
              </section>

              <section className="space-y-4 rounded-lg border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">Lifecycle Audit Trail</h3>
                    <p className="text-xs text-muted-foreground">Complete request history with timestamps and actions.</p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs font-medium"
                    onClick={() => setShowAuditTrail((current) => !current)}
                  >
                    {showAuditTrail ? "Hide Timeline" : "View Timeline"}
                  </Button>
                </div>

                {canTakeAction ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Add Review Notes</label>
                    <Textarea
                      value={comment}
                      onChange={(event) => setComment(event.target.value)}
                      placeholder="Add review notes, rejection reason, or revision instructions..."
                      rows={4}
                      className="text-sm leading-relaxed"
                    />
                  </div>
                ) : (
                  <div className="rounded-md border bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
                    {request.latestComment || "Read-only mode. No new review note can be added for this request."}
                  </div>
                )}

                {showAuditTrail ? (
                  <div className="space-y-3 border-t pt-4">
                    <h4 className="text-sm font-semibold text-foreground">Timeline History</h4>
                    {loadingActions ? (
                      <p className="text-sm text-muted-foreground">Loading audit trail...</p>
                    ) : (
                      <div className="relative space-y-4 pl-6">
                        <div className="absolute bottom-0 left-2 top-2 w-0.5 bg-border"></div>
                        {auditEntries.map((entry, index) => (
                          <div key={entry.id} className="relative">
                            <div className={`absolute -left-6 top-2 h-4 w-4 rounded-full border-2 border-background ${entry.tone.includes("emerald") ? "bg-emerald-500" : entry.tone.includes("rose") ? "bg-rose-500" : entry.tone.includes("amber") ? "bg-amber-500" : entry.tone.includes("violet") ? "bg-violet-500" : "bg-sky-500"}`}></div>
                            <div className={`rounded-lg border-2 p-4 shadow-sm ${entry.tone}`}>
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold text-foreground">{entry.label}</p>
                                  <p className="mt-0.5 text-sm text-muted-foreground">
                                    by <span className="font-medium text-foreground">{entry.actorName}</span>
                                  </p>
                                </div>
                                <p className="shrink-0 text-xs font-medium text-muted-foreground">{formatDateTime(entry.createdAt)}</p>
                              </div>
                              {entry.comments ? (
                                <div className="mt-3 rounded-md bg-background/60 p-3">
                                  <p className="text-sm leading-relaxed text-foreground">{entry.comments}</p>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            </div>

            <div className="border-t bg-background/95 px-6 py-4">
              {canTakeAction ? (
                <div className="flex flex-col gap-2.5 sm:flex-row sm:justify-end">
                  <Button size="sm" disabled={acting} onClick={() => void handleAction("approved")} className="h-9 px-4">
                    {acting ? "Saving..." : "Approve"}
                  </Button>
                  <Button size="sm" disabled={acting} variant="destructive" onClick={() => void handleAction("rejected")} className="h-9 px-4">
                    {acting ? "Saving..." : "Reject"}
                  </Button>
                  <Button size="sm" disabled={acting} variant="outline" onClick={() => void handleAction("returned_for_revision")} className="h-9 px-4">
                    {acting ? "Saving..." : "Return with Comment"}
                  </Button>
                </div>
              ) : (
                <div className="text-sm leading-relaxed text-muted-foreground">
                  This request is in read-only mode. Approval actions are available only while the request is pending.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}