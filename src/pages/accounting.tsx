import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AccountingDashboard } from "@/components/accounting/AccountingDashboard";
import { JournalOpEx } from "@/components/accounting/JournalOpEx";
import { Card, CardContent } from "@/components/ui/card";
import { Landmark, FileSpreadsheet, Users, Receipt, CircleDollarSign, FileText } from "lucide-react";

export default function Accounting() {
  const [activeTab, setActiveTab] = useState("dashboard");

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
              <TabsTrigger value="dashboard" className="flex items-center gap-2">
                <Landmark className="h-4 w-4" /> Dashboard
              </TabsTrigger>
              <TabsTrigger value="journal" className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Journal & OpEx
              </TabsTrigger>
              <TabsTrigger value="payroll" className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Payroll
              </TabsTrigger>
              <TabsTrigger value="vouchers" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" /> Vouchers
              </TabsTrigger>
              <TabsTrigger value="liquidations" className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4" /> Liquidations
              </TabsTrigger>
              <TabsTrigger value="tax" className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> UAE Tax
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="dashboard" className="flex-1 mt-0">
            <AccountingDashboard />
          </TabsContent>
          
          <TabsContent value="journal" className="flex-1 mt-0">
            <JournalOpEx />
          </TabsContent>
          
          <TabsContent value="payroll" className="flex-1 mt-0">
            <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">Payroll Module Pending</h3>
                <p>Advanced daily/weekly/monthly payroll engine connected to Site Attendance is being installed...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vouchers" className="flex-1 mt-0">
            <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
              <CardContent className="py-12 text-center text-muted-foreground">
                <Receipt className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">Voucher Management Pending</h3>
                <p>Payment, Receipt, and Journal vouchers are being installed...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="liquidations" className="flex-1 mt-0">
            <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
              <CardContent className="py-12 text-center text-muted-foreground">
                <CircleDollarSign className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">Liquidations Tracker Pending</h3>
                <p>Cash advance vs Actual tracking is being installed...</p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tax" className="flex-1 mt-0">
            <Card className="mt-4 border-t-0 rounded-t-none shadow-none">
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileText className="h-12 w-12 mx-auto mb-4 opacity-20" />
                <h3 className="text-lg font-semibold mb-2">UAE Tax Reporting Pending</h3>
                <p>Dubai VAT (Output vs Input) computation engine is being installed...</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}