import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { projectService } from "@/services/projectService";
import { accountingService } from "@/services/accountingService";
import { warehouseService } from "@/services/warehouseService";
import { DollarSign, FolderKanban, TrendingUp, AlertTriangle, Package, Users } from "lucide-react";

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    projects: { total: 0, active: 0, completed: 0, totalBudget: 0, totalCost: 0 },
    accounting: { totalIncome: 0, totalExpense: 0, pending: 0, completed: 0 },
    lowStock: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    const [projectStats, accountingStats, lowStockItems] = await Promise.all([
      projectService.getStats(),
      accountingService.getSummary(),
      warehouseService.getLowStock(10)
    ]);

    setStats({
      projects: projectStats.data || { total: 0, active: 0, completed: 0, totalBudget: 0, totalCost: 0 },
      accounting: accountingStats.data || { totalIncome: 0, totalExpense: 0, pending: 0, completed: 0 },
      lowStock: lowStockItems.data?.length || 0
    });
    setLoading(false);
  };

  const metricCards = [
    {
      title: "Active Projects",
      value: stats.projects.active,
      description: `${stats.projects.completed} completed`,
      icon: FolderKanban,
      color: "text-blue-600"
    },
    {
      title: "Total Budget",
      value: `$${(stats.projects.totalBudget / 1000).toFixed(0)}k`,
      description: `$${(stats.projects.totalCost / 1000).toFixed(0)}k spent`,
      icon: DollarSign,
      color: "text-green-600"
    },
    {
      title: "Net Income",
      value: `$${((stats.accounting.totalIncome - stats.accounting.totalExpense) / 1000).toFixed(0)}k`,
      description: `$${(stats.accounting.pending / 1000).toFixed(0)}k pending`,
      icon: TrendingUp,
      color: "text-emerald-600"
    },
    {
      title: "Low Stock Alerts",
      value: stats.lowStock,
      description: "Items need reorder",
      icon: AlertTriangle,
      color: "text-amber-600"
    }
  ];

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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Thea-X Construction Accounting System - Project overview and key metrics</p>
        </div>

        {/* Metric Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metricCards.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
                  <Icon className={`h-4 w-4 ${metric.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{metric.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{metric.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" />
                Financial Summary
              </CardTitle>
              <CardDescription>Income vs Expenses</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Income</span>
                <span className="text-lg font-semibold text-success">
                  ${stats.accounting.totalIncome.toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Expenses</span>
                <span className="text-lg font-semibold text-destructive">
                  ${stats.accounting.totalExpense.toLocaleString()}
                </span>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Net Balance</span>
                  <span className="text-xl font-bold text-primary">
                    ${(stats.accounting.totalIncome - stats.accounting.totalExpense).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Project Status
              </CardTitle>
              <CardDescription>Budget utilization overview</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Projects</span>
                <span className="text-lg font-semibold">{stats.projects.total}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Budget Allocated</span>
                <span className="text-lg font-semibold text-blue-600">
                  ${stats.projects.totalBudget.toLocaleString()}
                </span>
              </div>
              <div className="pt-4 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Budget Remaining</span>
                  <span className="text-xl font-bold text-success">
                    ${(stats.projects.totalBudget - stats.projects.totalCost).toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
}