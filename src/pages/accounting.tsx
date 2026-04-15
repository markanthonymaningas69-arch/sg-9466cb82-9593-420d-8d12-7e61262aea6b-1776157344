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
          <h1 className="text-3xl font-heading font-bold">Accounting</h1>
          <p className="text-muted-foreground mt-1">Manage corporate finances, liquidations, payroll, and UAE taxes</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="overflow-x-auto pb-2">
            <TabsList className="shrink-0 flex flex-wrap w-full gap-1 h-auto bg-transparent p-0">
              {currentPlan === "professional" && (
                <>
                  <TabsTrigger value="dashboard" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100">
                    <Landmark className="h-3 w-3 mr-1.5 hidden sm:inline" /> Dash
                  </TabsTrigger>
                  <TabsTrigger value="journal" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-indigo-700 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                    <FileSpreadsheet className="h-3 w-3 mr-1.5 hidden sm:inline" /> Journal
                  </TabsTrigger>
                </>
              )}
              <TabsTrigger value="payroll" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-emerald-700 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                <Users className="h-3 w-3 mr-1.5 hidden sm:inline" /> Payroll
              </TabsTrigger>
              {currentPlan === "professional" && (
                <>
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
                  <TabsTrigger value="requests" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-rose-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-rose-700 bg-rose-50 text-rose-700 hover:bg-rose-100 relative">
                    <FileSearch className="h-3 w-3 mr-1.5 hidden sm:inline" /> Requests
                    {pendingRequestsCount > 0 && pendingReqIds !== seenReqIds && activeTab !== 'requests' && (
                      <Badge variant="destructive" className="ml-1 h-4 min-w-4 flex items-center justify-center p-0 px-1 text-[9px] absolute -top-1 -right-1">
                        New
                      </Badge>
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="tax" className="flex-1 min-w-[70px] h-9 text-xs data-[state=active]:bg-purple-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-purple-700 bg-purple-50 text-purple-700 hover:bg-purple-100">
                    <FileText className="h-3 w-3 mr-1.5 hidden sm:inline" /> Tax
                  </TabsTrigger>
                </>
              )}
            </TabsList>
          </div>

          {currentPlan === "professional" && (
            <>
              <TabsContent value="dashboard" className="flex-1 mt-0">
                <AccountingDashboard onTabChange={setActiveTab} />
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