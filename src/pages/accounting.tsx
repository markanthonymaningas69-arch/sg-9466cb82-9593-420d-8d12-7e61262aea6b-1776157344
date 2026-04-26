import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountingDashboard } from "@/components/accounting/AccountingDashboard";
import { JournalOpEx } from "@/components/accounting/JournalOpEx";
import { PayrollTab } from "@/components/accounting/PayrollTab";
import { VouchersTab } from "@/components/accounting/VouchersTab";
import { LiquidationsTab } from "@/components/accounting/LiquidationsTab";
import { TaxReportTab } from "@/components/accounting/TaxReportTab";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Landmark, FileSpreadsheet, Users, Receipt, CircleDollarSign, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { approvalCenterService, type ApprovalRequest } from "@/services/approvalCenterService";
import { RequestDetailsButton } from "@/components/approval/RequestDetailsButton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

function getRequestPayload(request: ApprovalRequest) {
  if (!request.payload || Array.isArray(request.payload) || typeof request.payload !== "object") {
    return null;
  }

  return request.payload as Record<string, unknown>;
}

function getRequestReference(request: ApprovalRequest) {
  const payload = getRequestPayload(request);
  const voucherNumber = typeof payload?.voucherNumber === "string" ? payload.voucherNumber : null;
  const orderNumber = typeof payload?.orderNumber === "string" ? payload.orderNumber : null;
  const siteRequestId = typeof payload?.siteRequestId === "string" ? payload.siteRequestId : null;

  if (voucherNumber) {
    return voucherNumber;
  }

  if (orderNumber) {
    return orderNumber;
  }

  if (siteRequestId) {
    return siteRequestId;
  }

  return request.sourceRecordId;
}

function getRequestAmount(request: ApprovalRequest) {
  const payload = getRequestPayload(request);
  const totalAmount = payload?.totalAmount;
  const numericAmount =
    typeof totalAmount === "number"
      ? totalAmount
      : typeof totalAmount === "string" && totalAmount.trim()
        ? Number(totalAmount)
        : null;

  if (numericAmount === null || Number.isNaN(numericAmount)) {
    return "—";
  }

  return numericAmount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getRequestLinkedStatus(request: ApprovalRequest) {
  const payload = getRequestPayload(request);
  const accountingStatus = typeof payload?.accountingStatus === "string" ? payload.accountingStatus : null;
  const voucherStatus = typeof payload?.voucherStatus === "string" ? payload.voucherStatus : null;

  return accountingStatus || voucherStatus || "—";
}

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [approvedVouchersCount, setApprovedVouchersCount] = useState(0);
  const [approvedVoucherIds, setApprovedVoucherIds] = useState("");
  const [seenVoucherIds, setSeenVoucherIds] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('seenVoucherIds') || "" : "");
  const [incomingRequests, setIncomingRequests] = useState<ApprovalRequest[]>([]);
  const [processingRequestId, setProcessingRequestId] = useState("");

  useEffect(() => {
    loadCounts();
    void loadIncomingRequests();

    const channel = supabase
      .channel('accounting_badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => loadCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'approval_requests' }, () => {
        void loadIncomingRequests();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (activeTab === 'vouchers') {
      setSeenVoucherIds(approvedVoucherIds);
      if (typeof window !== 'undefined') localStorage.setItem('seenVoucherIds', approvedVoucherIds);
    }
  }, [activeTab, approvedVoucherIds]);

  const loadCounts = async () => {
    const { data: vData } = await supabase
      .from('vouchers')
      .select('id')
      .eq('status', 'approved');
    
    const vIds = (vData || []).map(v => v.id).sort().join(',');
    setApprovedVoucherIds(vIds);
    setApprovedVouchersCount(vData?.length || 0);
  };

  const loadIncomingRequests = async () => {
    const incoming = await approvalCenterService.listModuleInbox("Accounting");
    setIncomingRequests(incoming);
  };

  const handleCompleteIncomingRequest = async (approvalRequestId: string) => {
    try {
      setProcessingRequestId(approvalRequestId);
      await approvalCenterService.updateWorkflowStatus(approvalRequestId, "completed");
      await loadIncomingRequests();
    } finally {
      setProcessingRequestId("");
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold">Accounting</h1>
            <p className="text-muted-foreground mt-1">Financial management and reporting</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="overflow-x-auto pb-2">
            <TabsList className="shrink-0 flex flex-wrap w-full gap-1 h-auto bg-transparent p-0">
              <TabsTrigger value="dashboard" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100">
                <Landmark className="h-3 w-3 mr-1.5 hidden sm:inline" /> Dash
              </TabsTrigger>
              <TabsTrigger value="journal" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-indigo-700 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                <FileSpreadsheet className="h-3 w-3 mr-1.5 hidden sm:inline" /> Journal
              </TabsTrigger>
              <TabsTrigger value="payroll" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-emerald-700 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                <Users className="h-3 w-3 mr-1.5 hidden sm:inline" /> Payroll
              </TabsTrigger>
              <TabsTrigger value="vouchers" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-amber-700 bg-amber-50 text-amber-700 hover:bg-amber-100 relative">
                <Receipt className="h-3 w-3 mr-1.5 hidden sm:inline" /> 
                Vouchers
                {approvedVouchersCount > 0 && approvedVoucherIds !== seenVoucherIds && activeTab !== 'vouchers' && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[9px] absolute -top-1 -right-1">
                    New
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="liquidations" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-orange-700 bg-orange-50 text-orange-700 hover:bg-orange-100">
                <CircleDollarSign className="h-3 w-3 mr-1.5 hidden sm:inline" /> Liquidate
              </TabsTrigger>
              <TabsTrigger value="incoming" className="flex-1 min-w-[90px] h-9 text-xs data-[state=active]:bg-cyan-700 data-[state=active]:text-white border border-transparent data-[state=active]:border-cyan-800 bg-cyan-50 text-cyan-700 hover:bg-cyan-100 relative">
                Incoming Requests
                {incomingRequests.filter((request) => request.workflowStatus === "in_accounting").length > 0 && (
                  <Badge variant="destructive" className="ml-1 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[9px] absolute -top-1 -right-1">
                    {incomingRequests.filter((request) => request.workflowStatus === "in_accounting").length}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="tax" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-purple-700 bg-purple-50 text-purple-700 hover:bg-purple-100">
                <FileText className="h-3 w-3 mr-1.5 hidden sm:inline" /> Tax
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="flex-1 mt-0">
            <AccountingDashboard onTabChange={setActiveTab} />
          </TabsContent>
          
          <TabsContent value="journal" className="flex-1 mt-0">
            <JournalOpEx />
          </TabsContent>
          
          <TabsContent value="payroll" className="flex-1 mt-0">
            <PayrollTab />
          </TabsContent>

          <TabsContent value="vouchers" className="flex-1 mt-0">
            <VouchersTab />
          </TabsContent>

          <TabsContent value="liquidations" className="flex-1 mt-0">
            <LiquidationsTab />
          </TabsContent>

          <TabsContent value="incoming" className="flex-1 mt-0">
            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Request</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Requested By</TableHead>
                        <TableHead>Reference</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Routed</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Summary</TableHead>
                        <TableHead className="text-right">View Details</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {incomingRequests.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={10} className="py-8 text-center text-muted-foreground">
                            No incoming Accounting requests.
                          </TableCell>
                        </TableRow>
                      ) : (
                        incomingRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{request.requestType}</TableCell>
                            <TableCell>{request.projectName || "No project"}</TableCell>
                            <TableCell>{request.requestedBy}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                <p className="font-medium">{getRequestReference(request)}</p>
                                <p className="text-xs text-muted-foreground">{getRequestLinkedStatus(request).replaceAll("_", " ")}</p>
                              </div>
                            </TableCell>
                            <TableCell>{getRequestAmount(request)}</TableCell>
                            <TableCell>{request.routedAt ? new Date(request.routedAt).toLocaleString() : "—"}</TableCell>
                            <TableCell>
                              <Badge variant={request.workflowStatus === "completed" ? "default" : "secondary"}>
                                {request.workflowStatus.replaceAll("_", " ")}
                              </Badge>
                            </TableCell>
                            <TableCell className="max-w-[260px] truncate text-sm text-muted-foreground">
                              {request.summary || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              <RequestDetailsButton request={request} />
                            </TableCell>
                            <TableCell className="text-right">
                              {request.workflowStatus === "completed" ? (
                                <span className="text-xs text-muted-foreground">Completed</span>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => void handleCompleteIncomingRequest(request.id)}
                                  disabled={processingRequestId === request.id}
                                >
                                  {processingRequestId === request.id ? "Saving..." : "Mark Completed"}
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax" className="flex-1 mt-0">
            <TaxReportTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}