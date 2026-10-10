import { useState } from "react";
import { Layout } from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BudgetPlannerTab } from "@/components/tools/BudgetPlannerTab";
import { Calculator, Wallet } from "lucide-react";

export default function Tools() {
  const [activeTab, setActiveTab] = useState("budget-planner");

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-heading font-bold">Tools</h1>
            <p className="text-muted-foreground mt-1">Utility tools for project management</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
          <div className="overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0">
            <TabsList className="shrink-0 inline-flex w-auto min-w-full gap-1 h-auto bg-transparent p-0">
              <TabsTrigger
                value="budget-planner"
                className="flex-shrink-0 min-w-[110px] h-9 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-emerald-700 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              >
                <Wallet className="h-3 w-3 mr-1.5 hidden sm:inline" /> Budget Planner
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="budget-planner" className="flex-1 mt-3 space-y-4">
            <BudgetPlannerTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}