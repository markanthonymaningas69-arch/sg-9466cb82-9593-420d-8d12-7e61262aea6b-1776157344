import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountingDashboard } from "@/components/accounting/AccountingDashboard";
import { JournalOpEx } from "@/components/accounting/JournalOpEx";
import { PayrollTab } from "@/components/accounting/PayrollTab";
import { VouchersTab } from "@/components/accounting/VouchersTab";
import { LiquidationsTab } from "@/components/accounting/LiquidationsTab";
import { TaxReportTab } from "@/components/accounting/TaxReportTab";
import { RequestsViewTab } from "@/components/accounting/RequestsViewTab";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Landmark, FileSpreadsheet, Users, Receipt, CircleDollarSign, FileText, FileSearch } from "lucide-react";
import { useSettings } from "@/contexts/SettingsProvider";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Accounting() {
  const { currentPlan } = useSettings();
  const [activeTab, setActiveTab] = useState(currentPlan === "starter" ? "payroll" : "dashboard");
  const [approvedVouchersCount, setApprovedVouchersCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [approvedVoucherIds, setApprovedVoucherIds] = useState("");
  const [pendingReqIds, setPendingReqIds] = useState("");
  const [seenVoucherIds, setSeenVoucherIds] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('seenVoucherIds') || "" : "");
  const [seenReqIds, setSeenReqIds] = useState<string>(() => typeof window !== 'undefined' ? localStorage.getItem('seenReqIds') || "" : "");

  useEffect(() => {
    if (currentPlan === "starter" && activeTab !== "payroll") {
      setActiveTab("payroll");
    }
  }, [currentPlan, activeTab]);

  useEffect(() => {
    loadCounts();
    const channel = supabase
      .channel('accounting_badges')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vouchers' }, () => loadCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'site_requests' }, () => loadCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cash_advance_requests' }, () => loadCounts())
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

  useEffect(() => {
    if (activeTab === 'requests') {
      setSeenReqIds(pendingReqIds);
      if (typeof window !== 'undefined') localStorage.setItem('seenReqIds', pendingReqIds);
    }
  }, [activeTab, pendingReqIds]);

  const loadCounts = async () => {
    const { data: vData } = await supabase
      .from('vouchers')
      .select('id')
      .eq('status', 'approved');
    
    const vIds = (vData || []).map(v => v.id).sort().join(',');
    setApprovedVoucherIds(vIds);
    setApprovedVouchersCount(vData?.length || 0);

    const { data: r1 } = await supabase
      .from('site_requests')
      .select('id')
      .eq('status', 'pending');
      
    const { data: r2 } = await supabase
      .from('cash_advance_requests')
      .select('id')
      .eq('status', 'pending');

    const rIds = [...(r1 || []), ...(r2 || [])].map(r => r.id).sort().join(',');
    setPendingReqIds(rIds);
    setPendingRequestsCount((r1?.length || 0) + (r2?.length || 0));
  };

  return (
    <Layout>
      <div className="space-y-6 h-full flex flex-col">
        <div>
          <h1 className="text-3xl font-heading font-bold">ERP Accounting System</h1>
          <p className="text-muted-foreground mt-1">Manage corporate finances, liquidations, payroll, and UAE taxes</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="overflow-x-auto pb-2">
            <TabsList className="w-full justify-start min-w-max h-12">
              {currentPlan === "professional" && (
                <>
                  <TabsTrigger value="dashboard" className="flex items-center gap-2">
                    <Landmark className="h-4 w-4" /> Dashboard
                  </TabsTrigger>
                  <TabsTrigger value="journal" className="flex items-center gap-2">
                    <FileSpreadsheet className="h-4 w-4" /> Journal & OpEx
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="payroll" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Payroll
              </TabsTrigger>
              {currentPlan === "professional" && (
                <>
                  <TabsTrigger value="vouchers" className="flex items-center gap-2">
                    <Receipt className="h-4 w-4" /> 
                    Vouchers
                    {approvedVouchersCount > 0 && approvedVoucherIds !== seenVoucherIds && activeTab !== 'vouchers' && (
                      <Badge variant="destructive" className="ml-1 h-5 px-1.5 flex items-center justify-center text-[10px]">
                        New
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="liquidations" className="flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4" /> Liquidations
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4" /> Requests
                    {pendingRequestsCount > 0 && pendingReqIds !== seenReqIds && activeTab !== 'requests' && (
                      <Badge variant="destructive" className="ml-1 h-5 px-1.5 flex items-center justify-center text-[10px]">
                        New
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="tax" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" /> Taxation
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {currentPlan === "professional" && (
            <>
              <TabsContent value="dashboard" className="flex-1 mt-0">
                <AccountingDashboard />
              </TabsContent>
              
              <TabsContent value="journal" className="flex-1 mt-0">
                <JournalOpEx />
              </TabsContent>
            </>
          )}
          
          <TabsContent value="payroll" className="flex-1 mt-0">
            <PayrollTab />
          </TabsContent>

          {currentPlan === "professional" && (
            <>
              <TabsContent value="vouchers" className="flex-1 mt-0">
                <VouchersTab />
              </TabsContent>

              <TabsContent value="liquidations" className="flex-1 mt-0">
                <LiquidationsTab />
              </TabsContent>

              <TabsContent value="requests" className="flex-1 mt-0">
                <RequestsViewTab />
              </TabsContent>

              <TabsContent value="tax" className="flex-1 mt-0">
                <TaxReportTab />
              </TabsContent>
            </>
          )}
        </Tabs>
      </div>
    </Layout>
  );
}