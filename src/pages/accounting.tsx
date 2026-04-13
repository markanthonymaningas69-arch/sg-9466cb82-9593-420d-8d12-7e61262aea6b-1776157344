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
import { Landmark, FileSpreadsheet, Users, Receipt, CircleDollarSign, FileText, FileSearch } from "lucide-react";
import { useSettings } from "@/contexts/SettingsProvider";
import { useEffect } from "react";

export default function Accounting() {
  const { currentPlan } = useSettings();
  const [activeTab, setActiveTab] = useState(currentPlan === "starter" ? "payroll" : "dashboard");

  useEffect(() => {
    if (currentPlan === "starter" && activeTab !== "payroll") {
      setActiveTab("payroll");
    }
  }, [currentPlan, activeTab]);

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
                    <Receipt className="h-4 w-4" /> Vouchers
                  </TabsTrigger>
                  <TabsTrigger value="liquidations" className="flex items-center gap-2">
                    <CircleDollarSign className="h-4 w-4" /> Liquidations
                  </TabsTrigger>
                  <TabsTrigger value="requests" className="flex items-center gap-2">
                    <FileSearch className="h-4 w-4" /> Requests
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