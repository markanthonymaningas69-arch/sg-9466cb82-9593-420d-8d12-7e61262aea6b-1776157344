import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSettings } from "@/contexts/SettingsProvider";
import { projectService } from "@/services/projectService";
import { accountingService } from "@/services/accountingService";
import { warehouseService } from "@/services/warehouseService";
import { BarChart3, TrendingUp, DollarSign, Package, Users, Activity } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function Analytics() {
  const { formatCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string>("all");
  const [projects, setProjects] = useState<Project[]>([]);
  const [analytics, setAnalytics] = useState({
    projectCount: 0,
    activeProjects: 0,
    totalBudget: 0,
    totalSpent: 0,
    budgetUtilization: 0,
    totalIncome: 0,
    totalExpense: 0,
    netProfit: 0,
    profitMargin: 0,
    inventoryValue: 0,
    lowStockCount: 0,
  });

  useEffect(() => {
    loadAnalytics();
  }, [selectedProject]);

  const loadAnalytics = async () => {
    setLoading(true);
    const [projectsData, projectStats, accountingSummary, warehouseData, lowStock] = await Promise.all([
      projectService.getAll(),
      projectService.getStats(),
      accountingService.getSummary(selectedProject !== "all" ? selectedProject : undefined),
      warehouseService.getAll(),
      warehouseService.getLowStock(10)
    ]);

    const projects = projectsData.data || [];
    const stats = projectStats.data || { total: 0, active: 0, completed: 0, totalBudget: 0, totalCost: 0 };
    const accounting = accountingSummary.data || { totalIncome: 0, totalExpense: 0, pending: 0, completed: 0 };
    const warehouse = warehouseData.data || [];
    
    const inventoryValue = warehouse.reduce((sum, item) => sum + (item.quantity * item.unit_cost), 0);
    const netProfit = accounting.totalIncome - accounting.totalExpense;
    const profitMargin = accounting.totalIncome > 0 ? (netProfit / accounting.totalIncome) * 100 : 0;
    const budgetUtilization = stats.totalBudget > 0 ? (stats.totalCost / stats.totalBudget) * 100 : 0;

    setProjects(projects);
    setAnalytics({
      projectCount: stats.total,
      activeProjects: stats.active,
      totalBudget: stats.totalBudget,
      totalSpent: stats.totalCost,
      budgetUtilization,
      totalIncome: accounting.totalIncome,
      totalExpense: accounting.totalExpense,
      netProfit,
      profitMargin,
      inventoryValue,
      lowStockCount: lowStock.data?.length || 0,
    });
    setLoading(false);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-heading font-bold">Analytics</h1>
            <p className="text-muted-foreground mt-1">Business intelligence and performance metrics</p>
          </div>
          <div className="w-64">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Projects</SelectItem>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Projects</CardTitle>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.activeProjects}</div>
              <p className="text-xs text-muted-foreground mt-1">
                of {analytics.projectCount} total
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Budget Utilization</CardTitle>
              <BarChart3 className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{analytics.budgetUtilization.toFixed(1)}%</div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(analytics.totalSpent)} / {formatCurrency(analytics.totalBudget)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Profit Margin</CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${analytics.profitMargin >= 0 ? 'text-success' : 'text-destructive'}`}>
                {analytics.profitMargin.toFixed(1)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {formatCurrency(analytics.netProfit)} net
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(analytics.inventoryValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {analytics.lowStockCount} low stock alerts
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                Financial Performance
              </CardTitle>
              <CardDescription>Revenue and expenses breakdown</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Income</span>
                  <span className="text-lg font-bold text-success">
                    {formatCurrency(analytics.totalIncome)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-success"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Expenses</span>
                  <span className="text-lg font-bold text-destructive">
                    {formatCurrency(analytics.totalExpense)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-destructive"
                    style={{ 
                      width: analytics.totalIncome > 0 
                        ? `${(analytics.totalExpense / analytics.totalIncome) * 100}%` 
                        : '0%' 
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Net Profit</span>
                  <span className={`text-2xl font-bold ${analytics.netProfit >= 0 ? 'text-success' : 'text-destructive'}`}>
                    {formatCurrency(analytics.netProfit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Project Budget Analysis
              </CardTitle>
              <CardDescription>Budget allocation and spending</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Total Budget</span>
                  <span className="text-lg font-bold text-primary">
                    {formatCurrency(analytics.totalBudget)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Amount Spent</span>
                  <span className="text-lg font-bold text-warning">
                    {formatCurrency(analytics.totalSpent)}
                  </span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-warning"
                    style={{ 
                      width: analytics.totalBudget > 0 
                        ? `${analytics.budgetUtilization}%` 
                        : '0%' 
                    }}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Remaining Budget</span>
                  <span className="text-2xl font-bold text-success">
                    {formatCurrency(analytics.totalBudget - analytics.totalSpent)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Key Performance Indicators</CardTitle>
            <CardDescription>Overall business health metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Revenue Per Project</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.projectCount > 0 
                    ? (analytics.totalIncome / analytics.projectCount)
                    : 0)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Average Project Budget</div>
                <div className="text-2xl font-bold">
                  {formatCurrency(analytics.projectCount > 0 
                    ? (analytics.totalBudget / analytics.projectCount)
                    : 0)}
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm text-muted-foreground">Cost Efficiency</div>
                <div className="text-2xl font-bold">
                  {analytics.totalBudget > 0 
                    ? ((1 - analytics.budgetUtilization / 100) * 100).toFixed(1)
                    : 0}%
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}