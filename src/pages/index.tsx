import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, TrendingUp, Wallet, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsProvider";

export default function Dashboard() {
  const { formatCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalValue: 0,
    totalCost: 0,
    avgMargin: 0,
    avgCompletion: 0
  });

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    // Fetch all projects
    const { data: projects } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
      
    // Fetch BOMs and Scopes to calculate physical accomplishment
    const { data: boms } = await supabase
      .from('bill_of_materials')
      .select('project_id, bom_scope_of_work(subtotal, completion_percentage)');

    let totalVal = 0;
    let totalCst = 0;
    let totalWeightedCompletion = 0;

    const projectsData = (projects || []).map(p => {
      const budget = Number(p.budget) || 0;
      const spent = Number(p.spent) || 0;
      const margin = budget > 0 ? ((budget - spent) / budget) * 100 : 0;
      
      // Calculate accomplishment based on BOM scopes
      const projectBoms = (boms || []).filter(b => b.project_id === p.id);
      let projCompletion = 0;
      
      if (projectBoms.length > 0) {
        let totalSub = 0;
        let weightedComp = 0;
        projectBoms.forEach(bom => {
          (bom.bom_scope_of_work || []).forEach((scope: any) => {
            const sub = Number(scope.subtotal) || 0;
            const comp = Number(scope.completion_percentage) || 0;
            totalSub += sub;
            weightedComp += (comp * sub);
          });
        });
        // If scopes have no costs assigned yet, default to simple average
        if (totalSub === 0) {
          let count = 0;
          let sumComp = 0;
          projectBoms.forEach(bom => {
            (bom.bom_scope_of_work || []).forEach((scope: any) => {
              sumComp += Number(scope.completion_percentage) || 0;
              count++;
            });
          });
          projCompletion = count > 0 ? sumComp / count : 0;
        } else {
          projCompletion = weightedComp / totalSub;
        }
      }

      totalVal += budget;
      totalCst += spent;
      totalWeightedCompletion += (projCompletion * budget); // weight by project budget for portfolio avg

      return {
        ...p,
        margin,
        completion: projCompletion
      };
    });

    setPortfolio(projectsData);
    setSummary({
      totalValue: totalVal,
      totalCost: totalCst,
      avgMargin: totalVal > 0 ? ((totalVal - totalCst) / totalVal) * 100 : 0,
      avgCompletion: totalVal > 0 ? (totalWeightedCompletion / totalVal) : 0
    });
    
    setLoading(false);
  };

  const getStatusColor = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'active': return 'bg-blue-500 hover:bg-blue-600';
      case 'completed': return 'bg-green-500 hover:bg-green-600';
      case 'on-hold': return 'bg-orange-500 hover:bg-orange-600';
      case 'planning': return 'bg-purple-500 hover:bg-purple-600';
      default: return 'bg-gray-500 hover:bg-gray-600';
    }
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
        {/* Header */}
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Dashboard | GM</h1>
          <p className="text-muted-foreground mt-1">Executive overview of project portfolios and financial health</p>
        </div>

        {/* Top KPIs */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total Active Contract Amounts</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Costs to Date</CardTitle>
              <Wallet className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(summary.totalCost)}</div>
              <p className="text-xs text-muted-foreground mt-1">Accumulated Project Expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Profit Margin</CardTitle>
              <TrendingUp className={`h-4 w-4 ${summary.avgMargin >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${summary.avgMargin >= 0 ? 'text-success' : 'text-destructive'}`}>
                {summary.avgMargin.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Portfolio Average Margin</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Accomplishment</CardTitle>
              <Activity className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{summary.avgCompletion.toFixed(2)}%</div>
              <Progress value={summary.avgCompletion} className="h-2 mt-2" />
            </CardContent>
          </Card>
        </div>

        {/* Project Portfolio Table */}
        <Card>
          <CardHeader>
            <CardTitle>Project Portfolio Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto border rounded-md">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead>Project</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Contract Amount</TableHead>
                    <TableHead className="text-right">Cost to Date</TableHead>
                    <TableHead className="text-right">Profit Margin</TableHead>
                    <TableHead className="w-48 text-right">Accomplishment</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No projects found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    portfolio.map((project) => (
                      <TableRow key={project.id}>
                        <TableCell>
                          <div className="font-semibold">{project.name}</div>
                          <div className="text-xs text-muted-foreground">{project.location}</div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`text-white border-transparent ${getStatusColor(project.status)}`} variant="outline">
                            {project.status.toUpperCase()}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(project.budget)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(project.spent)}
                        </TableCell>
                        <TableCell className="text-right">
                          <span className={`font-semibold ${project.margin >= 0 ? 'text-success' : 'text-destructive'}`}>
                            {project.margin.toFixed(2)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex flex-col gap-1.5 items-end">
                            <span className="text-sm font-semibold">{project.completion.toFixed(2)}%</span>
                            <Progress value={project.completion} className="h-1.5 w-full bg-muted" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}