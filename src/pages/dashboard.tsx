import { useEffect, useState } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, TrendingUp, Wallet, Activity, Archive, Eye, Maximize2, Minimize2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSettings } from "@/contexts/SettingsProvider";
import { ArchiveViewer } from "@/components/ArchiveViewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer } from "recharts";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useRouter } from "next/router";

export default function Dashboard() {
  const router = useRouter();
  const { formatCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [portfolio, setPortfolio] = useState<any[]>([]);
  const [summary, setSummary] = useState({
    totalValue: 0,
    totalCost: 0,
    avgMargin: 0,
    avgCompletion: 0,
    weightedProjectCost: 0
  });

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [overallAccomplishmentOpen, setOverallAccomplishmentOpen] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(true);
  const [selectedProjectDetails, setSelectedProjectDetails] = useState<any>(null);
  
  const [projectScopes, setProjectScopes] = useState<any[]>([]);
  const [projectProgressScopeFilter, setProjectProgressScopeFilter] = useState<string>("all");
  const [rawProgressUpdates, setRawProgressUpdates] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setLoading(true);
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/login');
      return;
    }
    
    const { data: profile } = await supabase.from('profiles').select('assigned_module').eq('id', session.user.id).maybeSingle();
    
    if (!profile?.assigned_module) {
      router.push('/onboarding');
      return;
    }

    const moduleMap: Record<string, string> = {
      'Project Profile': '/projects',
      'Site Personnel': '/site-personnel',
      'Purchasing': '/purchasing',
      'Accounting': '/accounting',
      'Human Resources': '/personnel',
      'Warehouse': '/warehouse'
    };

    if (profile.assigned_module !== 'GM' && moduleMap[profile.assigned_module]) {
      router.push(moduleMap[profile.assigned_module]);
      return;
    }
    
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

    const projectsDataResult = projects.map(p => {
      const budget = Number(p.budget) || 0;
      
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

      const activeBudget = grandTotalCost > 0 ? grandTotalCost : budget;
      const margin = activeBudget > 0 ? ((activeBudget - totalActualCost) / activeBudget) * 100 : 0;

      totalVal += activeBudget;
      totalCst += totalActualCost;

      return {
        ...p,
        contractAmount: activeBudget,
        projectCost: activeBudget,
        costToDate: totalActualCost,
        margin: margin,
        completion: accomplishmentPct || 0,
        amountOfCompletion: accomplishmentAmount,
        weightPercent: 0,
        weightedContribution: 0
      };
    });

    const totalProjectCost = projectsDataResult.reduce((sum, project) => sum + (Number(project.projectCost) || 0), 0);
    const weightedPortfolio = projectsDataResult.map((project) => {
      const projectCost = Number(project.projectCost) || 0;
      const accomplishment = Number(project.completion) || 0;
      const projectWeight = totalProjectCost > 0 ? projectCost / totalProjectCost : 0;
      const weightedContribution = projectWeight * accomplishment;

      return {
        ...project,
        weightPercent: projectWeight * 100,
        weightedContribution,
      };
    });

    const overallAccomplishment = weightedPortfolio.reduce(
      (sum, project) => sum + (Number(project.weightedContribution) || 0),
      0
    );

    setPortfolio(weightedPortfolio);
    setSummary({
      totalValue: totalVal,
      totalCost: totalCst,
      avgMargin: totalVal > 0 ? ((totalVal - totalCst) / totalVal) * 100 : 0,
      avgCompletion: totalProjectCost > 0 ? overallAccomplishment : 0,
      weightedProjectCost: totalProjectCost
    });
    
    setLoading(false);
  };

  const openProjectDetails = async (project: any) => {
    setSelectedProjectDetails(project);
    setDetailsOpen(true);
    setIsFullScreen(true);
    setProjectScopes([]);
    setProjectProgressScopeFilter("all");
    setRawProgressUpdates([]);
    
    const { data: bom } = await supabase.from('bill_of_materials').select('id').eq('project_id', project.id).maybeSingle();
    if (bom) {
      const { data: scopes } = await supabase.from('bom_scope_of_work').select('id, name').eq('bom_id', bom.id);
      if (scopes && scopes.length > 0) {
        setProjectScopes(scopes);
        const scopeIds = scopes.map(s => s.id);
        const { data: updates } = await supabase.from('bom_progress_updates').select('*, bom_scope_of_work(name)').in('bom_scope_id', scopeIds).order('update_date', { ascending: true });
        
        if (updates) {
          setRawProgressUpdates(updates);
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

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Portfolio Value</CardTitle>
              <Building2 className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{formatCurrency(summary.totalValue)}</div>
              <p className="text-xs text-muted-foreground mt-1">Total Active Contract Amounts</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Costs to Date</CardTitle>
              <Wallet className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold">{formatCurrency(summary.totalCost)}</div>
              <p className="text-xs text-muted-foreground mt-1">Accumulated Project Expenses</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Overall Profit Margin</CardTitle>
              <TrendingUp className={`h-4 w-4 ${summary.avgMargin >= 0 ? 'text-green-600' : 'text-red-600'}`} />
            </CardHeader>
            <CardContent>
              <div className={`text-xl sm:text-2xl font-bold ${summary.avgMargin >= 0 ? 'text-success' : 'text-destructive'}`}>
                {summary.avgMargin.toFixed(2)}%
              </div>
              <p className="text-xs text-muted-foreground mt-1">Portfolio Average Margin</p>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer border-primary/40 bg-primary/5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            role="button"
            tabIndex={0}
            onClick={() => setOverallAccomplishmentOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                setOverallAccomplishmentOpen(true);
              }
            }}
          >
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div>
                <CardTitle className="text-sm font-medium text-primary">Overall Accomplishment</CardTitle>
                <p className="mt-1 text-xs text-primary/80">Click to view weighted breakdown</p>
              </div>
              <Activity className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-primary">{summary.avgCompletion.toFixed(2)}%</div>
              <Progress value={summary.avgCompletion} className="mt-2 h-2" />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Project Portfolio Status</CardTitle>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="min-w-[150px]">Project</TableHead>
                    <TableHead className="min-w-[100px]">Status</TableHead>
                    <TableHead className="text-right min-w-[120px]">Contract Amount</TableHead>
                    <TableHead className="text-right min-w-[120px]">Cost to Date</TableHead>
                    <TableHead className="text-right min-w-[100px]">Profit Margin</TableHead>
                    <TableHead className="w-48 text-right min-w-[150px]">Accomplishment</TableHead>
                    <TableHead className="w-24 text-right min-w-[100px]">Action</TableHead>
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
                          <Button size="sm" variant="outline" className="h-8 w-full sm:w-auto" onClick={() => openProjectDetails(project)}>
                            <Eye className="h-3 w-3 sm:mr-1" /> <span className="hidden sm:inline">View</span>
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

        <Card>
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Cost-Weighted Accomplishment Summary</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Overall accomplishment is based on each project&apos;s share of total project cost.
              </p>
            </div>
            <div className="rounded-xl border bg-primary/5 px-4 py-3 sm:min-w-[240px]">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall Accomplishment</p>
              <p className="mt-1 text-2xl font-bold text-primary">{summary.avgCompletion.toFixed(2)}%</p>
              <Progress value={summary.avgCompletion} className="mt-3 h-2" />
              <p className="mt-2 text-xs text-muted-foreground">
                Based on {formatCurrency(summary.weightedProjectCost)} total project cost
              </p>
            </div>
          </CardHeader>
          <CardContent className="p-0 sm:p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="min-w-[170px]">Project Name</TableHead>
                    <TableHead className="text-right min-w-[130px]">Cost</TableHead>
                    <TableHead className="text-right min-w-[110px]">Weight (%)</TableHead>
                    <TableHead className="text-right min-w-[140px]">Accomplishment (%)</TableHead>
                    <TableHead className="text-right min-w-[130px]">Contribution (%)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {portfolio.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                        No project cost and accomplishment data found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    portfolio.map((project) => (
                      <TableRow key={`${project.id}-weighted`}>
                        <TableCell>
                          <div className="font-semibold">{project.name}</div>
                          <div className="text-xs text-muted-foreground">{project.location}</div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(project.projectCost)}
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">
                          {project.weightPercent.toFixed(2)}%
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold text-primary">{project.completion.toFixed(2)}%</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <span className="font-semibold">{project.weightedContribution.toFixed(2)}%</span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                  <TableRow className="bg-muted/30">
                    <TableCell className="font-semibold">Overall Accomplishment</TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(summary.weightedProjectCost)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {summary.weightedProjectCost > 0 ? "100.00%" : "0.00%"}
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {summary.avgCompletion.toFixed(2)}%
                    </TableCell>
                    <TableCell className="text-right font-semibold text-primary">
                      {summary.avgCompletion.toFixed(2)}%
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        <ArchiveViewer open={archiveOpen} onOpenChange={setArchiveOpen} />

        <Dialog open={overallAccomplishmentOpen} onOpenChange={setOverallAccomplishmentOpen}>
          <DialogContent className="max-w-5xl">
            <DialogHeader>
              <DialogTitle>Cost-Weighted Accomplishment Summary</DialogTitle>
              <p className="pr-8 text-sm text-muted-foreground">
                Overall accomplishment is based on each project&apos;s share of total project cost.
              </p>
            </DialogHeader>
            <div className="space-y-4">
              <div className="rounded-xl border bg-primary/5 px-4 py-4">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall Accomplishment</p>
                <p className="mt-1 text-2xl font-bold text-primary">{summary.avgCompletion.toFixed(2)}%</p>
                <Progress value={summary.avgCompletion} className="mt-3 h-2" />
                <p className="mt-2 text-xs text-muted-foreground">
                  Based on {formatCurrency(summary.weightedProjectCost)} total project cost
                </p>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/50">
                    <TableRow>
                      <TableHead className="min-w-[170px]">Project Name</TableHead>
                      <TableHead className="text-right min-w-[130px]">Cost</TableHead>
                      <TableHead className="text-right min-w-[110px]">Weight (%)</TableHead>
                      <TableHead className="text-right min-w-[140px]">Accomplishment (%)</TableHead>
                      <TableHead className="text-right min-w-[130px]">Contribution (%)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {portfolio.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="py-8 text-center text-muted-foreground">
                          No project cost and accomplishment data found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      portfolio.map((project) => (
                        <TableRow key={`${project.id}-weighted`}>
                          <TableCell>
                            <div className="font-semibold">{project.name}</div>
                            <div className="text-xs text-muted-foreground">{project.location}</div>
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatCurrency(project.projectCost)}
                          </TableCell>
                          <TableCell className="text-right text-muted-foreground">
                            {project.weightPercent.toFixed(2)}%
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold text-primary">{project.completion.toFixed(2)}%</span>
                          </TableCell>
                          <TableCell className="text-right">
                            <span className="font-semibold">{project.weightedContribution.toFixed(2)}%</span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                    <TableRow className="bg-muted/30">
                      <TableCell className="font-semibold">Overall Accomplishment</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(summary.weightedProjectCost)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {summary.weightedProjectCost > 0 ? "100.00%" : "0.00%"}
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {summary.avgCompletion.toFixed(2)}%
                      </TableCell>
                      <TableCell className="text-right font-semibold text-primary">
                        {summary.avgCompletion.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </div>
          </DialogContent>
        </Dialog>

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
            
            {(() => {
              const dailyScopes: Record<string, number> = {};
              const dynamicChartData: any[] = [];
              const uniqueDates = Array.from(new Set(rawProgressUpdates.map(u => u.update_date)));
              
              for (const date of uniqueDates) {
                const updatesOnDate = rawProgressUpdates.filter(u => u.update_date === date);
                updatesOnDate.forEach(u => {
                  dailyScopes[u.bom_scope_id] = u.percentage_completed || 0;
                });
                
                let totalPct = 0;
                let count = projectScopes.length || 1;
                
                if (projectProgressScopeFilter !== 'all') {
                  totalPct = dailyScopes[projectProgressScopeFilter] || 0;
                  count = 1;
                } else {
                  projectScopes.forEach(s => {
                    totalPct += (dailyScopes[s.id] || 0);
                  });
                }
                
                dynamicChartData.push({
                  date,
                  completion: parseFloat((totalPct / count).toFixed(2))
                });
              }

              const filteredHistory = [...rawProgressUpdates].reverse().filter(u => 
                projectProgressScopeFilter === 'all' || u.bom_scope_id === projectProgressScopeFilter
              );

              return (
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

                  <div className="flex-1 min-h-[250px] border rounded-lg p-4 bg-card shrink-0 flex flex-col">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-semibold text-sm text-muted-foreground">Project Accomplishment Curve</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Scope:</span>
                        <Select value={projectProgressScopeFilter} onValueChange={setProjectProgressScopeFilter}>
                          <SelectTrigger className="w-[200px] h-8 text-sm">
                            <SelectValue placeholder="All Scopes" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Scopes</SelectItem>
                            {projectScopes.map(s => (
                              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex-1 min-h-0">
                      {dynamicChartData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={dynamicChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="date" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={{ stroke: "hsl(var(--border))" }} />
                            <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={{ stroke: "hsl(var(--border))" }} tickLine={{ stroke: "hsl(var(--border))" }} tickFormatter={(val) => `${val}%`} />
                            <ChartTooltip
                              formatter={(value) => [`${value}%`, projectProgressScopeFilter === 'all' ? 'Overall Completion' : 'Scope Completion']}
                              contentStyle={{
                                backgroundColor: "hsl(var(--popover))",
                                borderColor: "hsl(var(--border))",
                                color: "hsl(var(--popover-foreground))"
                              }}
                              labelStyle={{ color: "hsl(var(--popover-foreground))" }}
                            />
                            <Line
                              type="monotone"
                              dataKey="completion"
                              stroke="hsl(var(--primary))"
                              strokeWidth={3}
                              dot={{ r: 4, fill: "hsl(var(--primary))" }}
                              activeDot={{ r: 6, fill: "hsl(var(--primary))" }}
                            />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed rounded-lg bg-muted/30">
                          No progress history recorded yet for this selection.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 border rounded-lg overflow-hidden flex flex-col min-h-[200px]">
                    <div className="bg-muted/50 px-4 py-2 border-b font-semibold text-sm">Scope Updates History</div>
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
                          {filteredHistory.length > 0 ? (
                            filteredHistory.map((update) => (
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
                                No updates found.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </ScrollArea>
                  </div>
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}