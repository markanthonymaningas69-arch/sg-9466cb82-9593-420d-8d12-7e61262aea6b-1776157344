import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Building2, TrendingUp, Wallet, Activity, Archive, Eye, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsProvider";
import { ArchiveViewer } from "@/components/ArchiveViewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";

export default function Dashboard() {
  const { formatCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalValue: 0,
    totalCost: 0,
    avgMargin: 0,
    avgCompletion: 0
  });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<any>(null);
  const [projectProgressData, setProjectProgressData] = useState<any[]>([]);
  const [projectProgressHistory, setProjectProgressHistory] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    
    const [
      { data: projectsData },
      { data: bomsData },
      { data: consumptionsData },
      { data: attendancesData }
    ] = await Promise.all([
      supabase.from('projects').select('*').order('created_at', { ascending: false }),
      supabase.from('bill_of_materials').select('project_id, bom_scope_of_work(*, bom_materials(*), bom_labor(*)), bom_indirect_costs(*)'),
      supabase.from('material_consumption').select('*'),
      supabase.from('site_attendance').select('*, personnel(*)')
    ]);

    const projects = projectsData || [];
    const boms = bomsData || [];
    const consumptions = consumptionsData || [];
    const attendances = attendancesData || [];
    
    let totalVal = 0;
    let totalCst = 0;
    let totalWeightedCompletion = 0;

    const projectsDataResult = projects.map(p => {
      const budget = Number(p.budget) || 0;
      
      // --- ACCOMPLISHMENT (From Analytics SWA) ---
      const projectBom = boms.find(b => b.project_id === p.id);
      let grandTotalCost = 0;
      let accomplishmentAmount = 0;
      let accomplishmentPct = 0;

      if (projectBom) {
        const scopes = projectBom.bom_scope_of_work || [];
        const indirects = projectBom.bom_indirect_costs || [];

        const scopeRows = scopes.map((scope: any) => {
          const matCost = (scope.bom_materials || []).reduce((sum: number, m: any) => sum + (Number(m.quantity || 0) * Number(m.unit_cost || 0)), 0);
          const labCost = (scope.bom_labor || []).reduce((sum: number, l: any) => sum + Number(l.total_cost || (Number(l.hours || 0) * Number(l.hourly_rate || 0))), 0);
          const cost = matCost + labCost;
          grandTotalCost += cost;
          return { cost, completion: Number(scope.completion_percentage || 0) };
        });

        const avgCompletion = scopeRows.length > 0 ? scopeRows.reduce((sum, r) => sum + r.completion, 0) / scopeRows.length : 0;

        const icRows = indirects.map((ic: any) => {
          const cost = Number(ic.total_indirect || 0);
          grandTotalCost += cost;
          return { cost, completion: avgCompletion };
        });

        const allRows = [...scopeRows, ...icRows];
        
        allRows.forEach(row => {
          const wtPercentage = grandTotalCost > 0 ? (row.cost / grandTotalCost) * 100 : 0;
          const accomp = wtPercentage * (row.completion / 100);
          accomplishmentPct += accomp;
          accomplishmentAmount += row.cost * (row.completion / 100);
        });
      }

      // --- ACTUAL COST TO DATE (From Site Personnel/Analytics) ---
      const projCons = consumptions.filter(c => c.project_id === p.id);
      const projAtt = attendances.filter(a => a.project_id === p.id);

      let actualMatCost = 0;
      projCons.forEach((c: any) => {
        let unitCost = 0;
        if (projectBom) {
          const scope = (projectBom.bom_scope_of_work || []).find((s:any) => s.id === c.bom_scope_id);
          if (scope && scope.bom_materials) {
            const bomMat = scope.bom_materials.find((m:any) => m.material_name === (c.item_name || c.material_name));
            if (bomMat) unitCost = Number(bomMat.unit_cost || 0);
          }
        }
        actualMatCost += (Number(c.quantity || c.quantity_used || 0) * unitCost);
      });

      let actualLabCost = 0;
      projAtt.forEach((a: any) => {
        const hrRate = Number(a.personnel?.hourly_rate || (a.personnel?.daily_rate ? a.personnel.daily_rate / 8 : 0));
        actualLabCost += (Number(a.hours_worked || 0) * hrRate);
      });

      const totalActualCost = actualMatCost + actualLabCost;

      // Base financial calculations on BOM Grand Total if available, otherwise fallback to project budget
      const activeBudget = grandTotalCost > 0 ? grandTotalCost : budget;
      const margin = activeBudget > 0 ? ((activeBudget - totalActualCost) / activeBudget) * 100 : 0;

      totalVal += activeBudget;
      totalCst += totalActualCost;
      // Weight completion by budget for the portfolio average
      totalWeightedCompletion += (accomplishmentPct * activeBudget);

      return {
        ...p,
        contractAmount: activeBudget,
        costToDate: totalActualCost,
        margin: margin,
        completion: accomplishmentPct,
        amountOfCompletion: accomplishmentAmount
      };
    });

    setPortfolio(projectsDataResult);
    setSummary({
      totalValue: totalVal,
      totalCost: totalCst,
      avgMargin: totalVal > 0 ? ((totalVal - totalCst) / totalVal) * 100 : 0,
      avgCompletion: totalVal > 0 ? (totalWeightedCompletion / totalVal) : 0
    });
    
    setLoading(false);
  };

  const openProjectDetails = async (project: any) => {
    setSelectedProjectDetails(project);
    setDetailsOpen(true);
    setIsFullScreen(true);
    setProjectProgressData([]);
    setProjectProgressHistory([]);
    
    const { data: bom } = await supabase.from('bill_of_materials').select('id').eq('project_id', project.id).maybeSingle();
    if (bom) {
      const { data: scopes } = await supabase.from('bom_scope_of_work').select('id, name').eq('bom_id', bom.id);
      if (scopes && scopes.length > 0) {
        const scopeIds = scopes.map(s => s.id);
        const { data: updates } = await supabase.from('bom_progress_updates').select('*, bom_scope_of_work(name)').in('bom_scope_id', scopeIds).order('update_date', { ascending: true });
        
        if (updates) {
          setProjectProgressHistory([...updates].reverse());
          
          const dailyScopes: Record<string, number> = {};
          const dataPoints: any[] = [];
          const uniqueDates = Array.from(new Set(updates.map(u => u.update_date)));
          
          for (const date of uniqueDates) {
            const updatesOnDate = updates.filter(u => u.update_date === date);
            updatesOnDate.forEach(u => {
              dailyScopes[u.bom_scope_id] = u.percentage_completed || 0;
            });
            
            let totalPct = 0;
            const count = scopes.length || 1;
            scopes.forEach(s => {
              totalPct += (dailyScopes[s.id] || 0);
            });
            
            dataPoints.push({
              date,
              completion: parseFloat((totalPct / count).toFixed(2))
            });
          }
          setProjectProgressData(dataPoints);
        }
      }
    }
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
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-heading font-bold text-foreground">Dashboard | GM</h1>
            <p className="text-muted-foreground mt-1">Executive overview of project portfolios and financial health</p>
          </div>
          <Button variant="outline" onClick={() => setArchiveOpen(true)} className="border-orange-200 text-orange-700 hover:bg-orange-50 mt-2 sm:mt-0">
            <Archive className="mr-2 h-4 w-4" />
            Archived Files
          </Button>
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
                    <TableHead className="w-24 text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
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
                          {formatCurrency(project.contractAmount)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {formatCurrency(project.costToDate)}
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
                        <TableCell className="text-right">
                          <Button size="sm" variant="outline" className="h-8" onClick={() => openProjectDetails(project)}>
                            <Eye className="h-3 w-3 mr-1" /> View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <ArchiveViewer open={archiveOpen} onOpenChange={setArchiveOpen} />

        {/* Project Details Modal */}
        <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
          <DialogContent className={`flex flex-col transition-all duration-200 ${isFullScreen ? 'max-w-[100vw] w-screen h-[100dvh] m-0 rounded-none border-0' : 'max-w-5xl h-[85vh]'}`}>
            <button 
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="absolute right-12 top-4 rounded-sm opacity-70 transition-opacity hover:opacity-100 disabled:pointer-events-none p-0.5 z-50 bg-background"
              title={isFullScreen ? "Minimize" : "Maximize"}
            >
              {isFullScreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              <span className="sr-only">Toggle full screen</span>
            </button>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold mr-16">{selectedProjectDetails?.name} Details</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-hidden flex flex-col gap-6 pt-4">
              <div className="grid grid-cols-3 gap-4 shrink-0">
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <div className="text-sm text-muted-foreground">Contract Amount</div>
                  <div className="text-xl font-bold">{selectedProjectDetails ? formatCurrency(selectedProjectDetails.contractAmount) : '-'}</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <div className="text-sm text-muted-foreground">Cost to Date</div>
                  <div className="text-xl font-bold">{selectedProjectDetails ? formatCurrency(selectedProjectDetails.costToDate) : '-'}</div>
                </div>
                <div className="bg-muted/50 p-4 rounded-lg border">
                  <div className="text-sm text-muted-foreground">Overall Completion</div>
                  <div className="text-xl font-bold text-primary">{selectedProjectDetails?.completion?.toFixed(2)}%</div>
                </div>
              </div>

              <div className="flex-1 min-h-[250px] border rounded-lg p-4 bg-white shrink-0">
                <h4 className="font-semibold mb-4 text-sm text-muted-foreground">Overall Project Accomplishment Curve</h4>
                {projectProgressData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={projectProgressData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                      <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} tickFormatter={(val) => `${val}%`} />
                      <ChartTooltip formatter={(value) => [`${value}%`, 'Overall Completion']} />
                      <Line type="monotone" dataKey="completion" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-lg bg-gray-50">
                    No progress history recorded yet.
                  </div>
                )}
              </div>

              <div className="flex-1 border rounded-lg overflow-hidden flex flex-col min-h-[200px]">
                <div className="bg-muted/50 px-4 py-2 border-b font-semibold text-sm">Recent Scope Updates</div>
                <ScrollArea className="flex-1">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Scope of Work</TableHead>
                        <TableHead>Completion</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projectProgressHistory.length > 0 ? (
                        projectProgressHistory.map((update) => (
                          <TableRow key={update.id}>
                            <TableCell className="whitespace-nowrap">{update.update_date}</TableCell>
                            <TableCell className="font-medium">{update.bom_scope_of_work?.name || "Unknown Scope"}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={update.percentage_completed === 100 ? "bg-green-50 text-green-700" : ""}>
                                {update.percentage_completed}%
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={update.notes}>{update.notes || "-"}</TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-6 text-muted-foreground">
                            No recent updates.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}