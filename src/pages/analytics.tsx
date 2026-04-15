import { useEffect, useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSettings } from "@/contexts/SettingsProvider";
import { projectService } from "@/services/projectService";
import { bomService } from "@/services/bomService";
import { siteService } from "@/services/siteService";
import { ClipboardList, Package, DollarSign, AlertCircle, TrendingUp, BarChart3 } from "lucide-react";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { Database } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";

type Project = Database["public"]["Tables"]["projects"]["Row"];

export default function Analytics() {
  const { formatCurrency } = useSettings();
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<string>("");

  // Data states
  const [bom, setBom] = useState<any>(null);
  const [consumption, setConsumption] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [progressUpdates, setProgressUpdates] = useState<any[]>([]);

  // Filters
  const [usageScopeFilter, setUsageScopeFilter] = useState<string>("all");

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (selectedProject) {
      loadProjectData(selectedProject);
    } else {
      setBom(null);
      setConsumption([]);
      setAttendance([]);
      setDeliveries([]);
      setProgressUpdates([]);
    }
  }, [selectedProject]);

  const loadProjects = async () => {
    setLoading(true);
    const { data } = await projectService.getAll();
    setProjects(data || []);
    if (data && data.length > 0) {
      setSelectedProject(data[0].id);
    } else {
      setLoading(false);
    }
  };

  const loadProjectData = async (projectId: string) => {
    setLoading(true);
    try {
      const [bomData, consumptionData, attendanceData, deliveriesData, scopesData, purchasesResponse] = await Promise.all([
        bomService.getByProjectId(projectId),
        siteService.getMaterialConsumption(projectId),
        siteService.getSiteAttendance(projectId),
        siteService.getDeliveries(projectId),
        siteService.getScopeOfWorks(projectId),
        supabase.from('purchases').select('item_name, quantity, unit_cost, order_date').order('order_date', { ascending: true })
      ]);

      // 1. Build chronological purchase lots for True FIFO costing
      const purchasesList = purchasesResponse.data || [];
      const lots: Record<string, { qty: number; cost: number }[]> = {};
      purchasesList.forEach(p => {
        const name = (p.item_name || '').toLowerCase();
        if (!lots[name]) lots[name] = [];
        lots[name].push({ qty: Number(p.quantity || 0), cost: Number(p.unit_cost || 0) });
      });

      // 2. Sort consumptions chronologically
      const consumptionList = [...(consumptionData.data || [])].sort((a, b) => new Date(a.date_used).getTime() - new Date(b.date_used).getTime());
      
      // 3. Apply FIFO depletion
      const enrichedConsumption = consumptionList.map(c => {
        const name = (c.item_name || c.material_name || '').toLowerCase();
        let qtyToCost = Number(c.quantity || c.quantity_used || 0);
        let totalCost = 0;

        if (lots[name]) {
          for (let i = 0; i < lots[name].length && qtyToCost > 0; i++) {
            const lot = lots[name][i];
            if (lot.qty > 0) {
              const consumedFromLot = Math.min(qtyToCost, lot.qty);
              totalCost += consumedFromLot * lot.cost;
              lot.qty -= consumedFromLot;
              qtyToCost -= consumedFromLot;
            }
          }
        }

        // If no purchase history or lots exhausted
        if (qtyToCost > 0) {
          if (Number(c.estimated_cost) > 0) {
            // Fallback 1: Manual estimated cost from Site
            totalCost += qtyToCost * Number(c.estimated_cost);
          } else {
            // Fallback 2: Original BOM estimate
            const scope = bomData.data?.bom_scope_of_work?.find((s: any) => s.id === c.bom_scope_id);
            const bomMat = Array.isArray(scope?.bom_materials) 
              ? scope.bom_materials.find((m: any) => (m.material_name || '').toLowerCase() === name)
              : null;
            const fallbackCost = bomMat ? Number(bomMat.unit_cost || 0) : 0;
            totalCost += qtyToCost * fallbackCost;
          }
        }

        return { ...c, calculated_total_cost: totalCost };
      });

      setBom(bomData.data || null);
      setConsumption(enrichedConsumption);
      setAttendance(attendanceData.data || []);
      setDeliveries(deliveriesData.data || []);
      
      if (scopesData.data && scopesData.data.length > 0) {
        const scopeIds = scopesData.data.map((s: any) => s.id);
        const { data: progressData } = await supabase
          .from('bom_progress_updates')
          .select('*, bom_scope_of_work(name)')
          .in('bom_scope_id', scopeIds)
          .order('update_date', { ascending: false });
        setProgressUpdates(progressData || []);
      } else {
        setProgressUpdates([]);
      }
    } catch (err) {
      console.error("Error loading project data:", err);
      setBom(null);
      setConsumption([]);
      setAttendance([]);
      setDeliveries([]);
      setProgressUpdates([]);
    } finally {
      setLoading(false);
    }
  };

  // 1. SWA Data
  const swaData = useMemo(() => {
    if (!bom?.bom_scope_of_work || !Array.isArray(bom.bom_scope_of_work)) return { rows: [], totals: { cost: 0, wtPercentage: 0, accomplishment: 0, amountOfCompletion: 0 } };

    const scopes = [...bom.bom_scope_of_work].sort((a: any, b: any) => (a.order_number || 0) - (b.order_number || 0));
    const indirects = Array.isArray(bom.bom_indirect_costs) ? bom.bom_indirect_costs : [];

    let grandTotalCost = 0;

    const scopeRows = scopes.map((scope: any) => {
      const matCost = Array.isArray(scope.bom_materials) 
        ? scope.bom_materials.reduce((sum: number, m: any) => sum + (Number(m.quantity || 0) * Number(m.unit_cost || 0)), 0)
        : 0;
      const labCost = Array.isArray(scope.bom_labor)
        ? scope.bom_labor.reduce((sum: number, l: any) => sum + Number(l.total_cost || (Number(l.hours || 0) * Number(l.hourly_rate || 0))), 0)
        : 0;
      
      const cost = matCost + labCost;
      grandTotalCost += cost;

      return {
        id: scope.id,
        name: scope.name || "Unknown Scope",
        type: "scope",
        cost,
        completion: Number(scope.completion_percentage || 0),
        order_number: scope.order_number || 0
      };
    });

    const avgCompletion = scopeRows.length > 0 
      ? scopeRows.reduce((sum, r) => sum + r.completion, 0) / scopeRows.length 
      : 0;

    const icRows = indirects.map((ic: any) => {
      const cost = Number(ic.total_indirect || 0); // Get value straight from BOM
      grandTotalCost += cost;

      return {
        id: ic.id || "indirect",
        name: "Indirect Cost",
        type: "indirect",
        cost,
        completion: avgCompletion // Average completion of all scopes
      };
    });

    const allRows = [...scopeRows, ...icRows].map(row => {
      const wtPercentage = grandTotalCost > 0 ? (row.cost / grandTotalCost) * 100 : 0;
      const accomplishment = wtPercentage * (row.completion / 100);
      const amountOfCompletion = row.cost * (row.completion / 100);

      return {
        ...row,
        wtPercentage,
        accomplishment,
        amountOfCompletion
      };
    });

    const totals = {
      cost: grandTotalCost,
      wtPercentage: grandTotalCost > 0 ? 100 : 0,
      accomplishment: allRows.reduce((sum, r) => sum + r.accomplishment, 0),
      amountOfCompletion: allRows.reduce((sum, r) => sum + r.amountOfCompletion, 0)
    };

    return { rows: allRows, totals };
  }, [bom]);

  // 2. Material Usage vs Allocated
  const materialUsageData = useMemo(() => {
    if (!bom?.bom_scope_of_work || !Array.isArray(bom.bom_scope_of_work)) return [];
    
    const usageMap: Record<string, { allocated: number; actual: number; unit: string; scopeName: string }> = {};

    // Map allocated
    bom.bom_scope_of_work.forEach((scope: any) => {
      if (usageScopeFilter !== "all" && scope.id !== usageScopeFilter) return;

      if (Array.isArray(scope.bom_materials)) {
        scope.bom_materials.forEach((mat: any) => {
          const name = mat.material_name || "Unknown";
          const key = `${scope.id}_${name}`;
          if (!usageMap[key]) {
            usageMap[key] = { allocated: 0, actual: 0, unit: mat.unit || "", scopeName: scope.name || "" };
          }
          usageMap[key].allocated += Number(mat.quantity || 0);
        });
      }
    });

    // Map actual
    (consumption || []).forEach((cons: any) => {
      if (usageScopeFilter !== "all" && cons.bom_scope_id !== usageScopeFilter) return;

      const name = cons.item_name || cons.material_name || "Unknown";
      const qty = Number(cons.quantity || cons.quantity_used || 0);
      const key = `${cons.bom_scope_id}_${name}`;
      const scope = bom.bom_scope_of_work.find((s: any) => s.id === cons.bom_scope_id);
      
      if (!usageMap[key]) {
        usageMap[key] = { allocated: 0, actual: 0, unit: cons.unit || "", scopeName: scope?.name || "Unknown Scope" };
      }
      usageMap[key].actual += qty;
    });

    return Object.entries(usageMap).map(([key, data]) => {
      const [scopeId, ...nameParts] = key.split("_");
      return {
        scopeId,
        materialName: nameParts.join("_"),
        ...data,
        variance: data.allocated - data.actual
      };
    });
  }, [bom, consumption, usageScopeFilter]);

  // 3. Amount Spent per Scope
  const scopeSpendingData = useMemo(() => {
    if (!bom?.bom_scope_of_work || !Array.isArray(bom.bom_scope_of_work)) return [];

    return bom.bom_scope_of_work.map((scope: any) => {
      // Allocated Materials
      const allocatedMatCost = Array.isArray(scope.bom_materials) 
        ? scope.bom_materials.reduce((sum: number, m: any) => sum + (Number(m.quantity || 0) * Number(m.unit_cost || 0)), 0)
        : 0;
      
      // Allocated Labor
      const allocatedLabCost = Array.isArray(scope.bom_labor)
        ? scope.bom_labor.reduce((sum: number, l: any) => sum + Number(l.total_cost || (Number(l.hours || 0) * Number(l.hourly_rate || 0))), 0)
        : 0;

      // Actual Materials
      const actualMatCost = (consumption || [])
        .filter(c => c.bom_scope_id === scope.id)
        .reduce((sum: number, c: any) => sum + (c.calculated_total_cost || 0), 0);

      // Actual Labor
      const actualLabCost = (attendance || [])
        .filter(a => a.bom_scope_id === scope.id)
        .reduce((sum: number, a: any) => {
          const hrRate = Number(a.personnel?.hourly_rate || (a.personnel?.daily_rate ? a.personnel.daily_rate / 8 : 0));
          return sum + (Number(a.hours_worked || 0) * hrRate);
        }, 0);

      return {
        scopeName: scope.name || "Unknown Scope",
        allocatedMatCost,
        allocatedLabCost,
        totalAllocated: allocatedMatCost + allocatedLabCost,
        actualMatCost,
        actualLabCost,
        totalActual: actualMatCost + actualLabCost
      };
    });
  }, [bom, consumption, attendance]);

  // 4. OCM (Materials used but not in BOM)
  const ocmData = useMemo(() => {
    if (!bom?.bom_scope_of_work || !Array.isArray(bom.bom_scope_of_work)) return [];
    
    const ocmList: any[] = [];

    (consumption || []).forEach((cons: any) => {
      const scope = bom.bom_scope_of_work.find((s: any) => s.id === cons.bom_scope_id);
      if (scope) {
        const consName = (cons.item_name || cons.material_name || "").toLowerCase();
        const isInBom = Array.isArray(scope.bom_materials) && scope.bom_materials.some((m: any) => 
          (m.material_name?.toLowerCase() || "") === consName
        );
        
        if (!isInBom) {
          ocmList.push({
            date: cons.date_used,
            scopeName: scope.name || "Unknown Scope",
            materialName: cons.item_name || cons.material_name || "Unknown Material",
            quantity: Number(cons.quantity || cons.quantity_used || 0),
            unit: cons.unit || "",
            cost: cons.calculated_total_cost || 0,
            remarks: cons.notes || cons.remarks || "-"
          });
        }
      }
    });

    return ocmList;
  }, [bom, consumption]);

  // 5. Visual Analytics Data
  const visualAnalyticsData = useMemo(() => {
    // Group consumption by date
    const consumptionByDate: Record<string, number> = {};
    (consumption || []).forEach(c => {
      const date = c.date_used;
      if (!consumptionByDate[date]) consumptionByDate[date] = 0;
      consumptionByDate[date] += (c.calculated_total_cost || 0);
    });

    // Group labor by date
    const laborByDate: Record<string, { hours: number; cost: number }> = {};
    (attendance || []).forEach(a => {
      const date = a.date;
      if (!laborByDate[date]) laborByDate[date] = { hours: 0, cost: 0 };
      
      const hrRate = Number(a.personnel?.hourly_rate || (a.personnel?.daily_rate ? a.personnel.daily_rate / 8 : 0));
      const hours = Number(a.hours_worked || 0);
      
      laborByDate[date].hours += hours;
      laborByDate[date].cost += hours * hrRate;
    });

    // Combine all dates
    const allDates = Array.from(new Set([
      ...Object.keys(consumptionByDate),
      ...Object.keys(laborByDate)
    ])).sort();

    let cumulativeCost = 0;
    const chartData = allDates.map(date => {
      const matCost = consumptionByDate[date] || 0;
      const labData = laborByDate[date] || { hours: 0, cost: 0 };
      const dailyTotal = matCost + labData.cost;
      cumulativeCost += dailyTotal;

      return {
        date,
        materialCost: matCost,
        laborHours: labData.hours,
        laborCost: labData.cost,
        dailyTotal,
        cumulativeCost
      };
    });

    return chartData;
  }, [bom, consumption, attendance]);

  // 6. Progress Chart Data
  const progressChartData = useMemo(() => {
    if (!bom?.bom_scope_of_work || !Array.isArray(bom.bom_scope_of_work)) return [];
    
    const scopes = bom.bom_scope_of_work;
    const sorted = [...progressUpdates].sort((a,b) => new Date(a.update_date).getTime() - new Date(b.update_date).getTime());
    const dailyScopes: Record<string, number> = {};
    const dataPoints: any[] = [];
    
    const uniqueDates = Array.from(new Set(sorted.map(u => u.update_date)));
    
    for (const date of uniqueDates) {
      const updatesOnDate = sorted.filter(u => u.update_date === date);
      updatesOnDate.forEach(u => {
        dailyScopes[u.bom_scope_id] = u.percentage_completed || 0;
      });
      
      let totalPct = 0;
      const count = scopes.length || 1;
      
      scopes.forEach((s: any) => {
        totalPct += (dailyScopes[s.id] || 0);
      });
      
      dataPoints.push({
        date,
        completion: parseFloat((totalPct / count).toFixed(2))
      });
    }
    
    return dataPoints;
  }, [bom, progressUpdates]);

  if (loading && projects.length === 0) {
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
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-heading font-bold">Project Analytics</h1>
            <p className="text-muted-foreground mt-1">Detailed reporting and accomplishment metrics</p>
          </div>
          <div className="w-full sm:w-72">
            <Select value={selectedProject} onValueChange={setSelectedProject}>
              <SelectTrigger>
                <SelectValue placeholder="Select a project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {!selectedProject ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Please select a project to view analytics.
            </CardContent>
          </Card>
        ) : loading ? (
          <Card>
            <CardContent className="py-12 flex justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="swa" className="space-y-6">
            <TabsList className="shrink-0 flex flex-wrap w-full gap-1 h-auto bg-transparent p-0 pb-4">
              <TabsTrigger value="swa" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-blue-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-blue-700 bg-blue-50 text-blue-700 hover:bg-blue-100">
                <ClipboardList className="h-3 w-3 mr-1.5 hidden sm:inline" />
                SWA
              </TabsTrigger>
              <TabsTrigger value="materials" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-indigo-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-indigo-700 bg-indigo-50 text-indigo-700 hover:bg-indigo-100">
                <Package className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Materials
              </TabsTrigger>
              <TabsTrigger value="spent" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-emerald-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-emerald-700 bg-emerald-50 text-emerald-700 hover:bg-emerald-100">
                <DollarSign className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Spent vs Alloc.
              </TabsTrigger>
              <TabsTrigger value="ocm" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-amber-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-amber-700 bg-amber-50 text-amber-700 hover:bg-amber-100">
                <AlertCircle className="h-3 w-3 mr-1.5 hidden sm:inline" />
                OCM
              </TabsTrigger>
              <TabsTrigger value="visual" className="flex-1 min-w-[80px] h-9 text-xs data-[state=active]:bg-orange-600 data-[state=active]:text-white border border-transparent data-[state=active]:border-orange-700 bg-orange-50 text-orange-700 hover:bg-orange-100">
                <BarChart3 className="h-3 w-3 mr-1.5 hidden sm:inline" />
                Visuals
              </TabsTrigger>
            </TabsList>

            {/* 1. SWA */}
            <TabsContent value="swa">
              <Card>
                <CardHeader>
                  <CardTitle>Statement of Work Accomplishment</CardTitle>
                  <CardDescription>Weighted progress and financial completion status per scope and indirect costs.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead className="text-right">Wt. %</TableHead>
                        <TableHead className="text-right">Completed %</TableHead>
                        <TableHead className="text-right">Accomplishment</TableHead>
                        <TableHead className="text-right">Amount of Completion</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {swaData.rows.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No scopes or indirect costs defined in BOM.
                          </TableCell>
                        </TableRow>
                      ) : (
                        <>
                          {swaData.rows.map((row: any) => (
                            <TableRow key={row.id}>
                              <TableCell className="font-medium">
                                {row.name}
                                {row.type === "indirect" && <Badge variant="outline" className="ml-2 text-[10px] h-5">Indirect Cost</Badge>}
                              </TableCell>
                              <TableCell className="text-right">{formatCurrency(row.cost)}</TableCell>
                              <TableCell className="text-right">{row.wtPercentage.toFixed(2)}%</TableCell>
                              <TableCell className="text-right">{row.completion.toFixed(2)}%</TableCell>
                              <TableCell className="text-right font-bold text-primary">{row.accomplishment.toFixed(2)}%</TableCell>
                              <TableCell className="text-right font-bold text-primary">{formatCurrency(row.amountOfCompletion)}</TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 font-bold hover:bg-muted/50">
                            <TableCell>GRAND TOTAL</TableCell>
                            <TableCell className="text-right text-primary">{formatCurrency(swaData.totals.cost)}</TableCell>
                            <TableCell className="text-right text-primary">{swaData.totals.wtPercentage.toFixed(2)}%</TableCell>
                            <TableCell className="text-right">-</TableCell>
                            <TableCell className="text-right text-primary">{swaData.totals.accomplishment.toFixed(2)}%</TableCell>
                            <TableCell className="text-right text-primary">{formatCurrency(swaData.totals.amountOfCompletion)}</TableCell>
                          </TableRow>
                        </>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 2. Material Usage vs Allocated */}
            <TabsContent value="materials">
              <Card>
                <CardHeader className="flex flex-row items-start justify-between space-y-0">
                  <div>
                    <CardTitle>Material Usage vs Allocated</CardTitle>
                    <CardDescription>Compare planned material quantities against actual site consumption.</CardDescription>
                  </div>
                  <Select value={usageScopeFilter} onValueChange={setUsageScopeFilter}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by Scope" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Scopes</SelectItem>
                      {bom?.bom_scope_of_work?.map((scope: any) => (
                        <SelectItem key={scope.id} value={scope.id}>{scope.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scope</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Allocated Qty</TableHead>
                        <TableHead className="text-right">Actual Qty</TableHead>
                        <TableHead className="text-right">Variance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {materialUsageData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No materials found for the selected criteria.
                          </TableCell>
                        </TableRow>
                      ) : (
                        materialUsageData.map((row: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="text-sm text-muted-foreground">{row.scopeName}</TableCell>
                            <TableCell className="font-medium">{row.materialName}</TableCell>
                            <TableCell className="text-right">{row.allocated} {row.unit}</TableCell>
                            <TableCell className="text-right">{row.actual} {row.unit}</TableCell>
                            <TableCell className={`text-right font-medium ${row.variance < 0 ? 'text-destructive' : row.variance > 0 ? 'text-success' : ''}`}>
                              {row.variance > 0 ? '+' : ''}{row.variance} {row.unit}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 3. Spent vs Allocated */}
            <TabsContent value="spent">
              <Card>
                <CardHeader>
                  <CardTitle>Spent vs Allocated per Scope</CardTitle>
                  <CardDescription>Financial breakdown of materials and labor allocated vs actuals.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scope</TableHead>
                        <TableHead className="text-right">Allocated Materials</TableHead>
                        <TableHead className="text-right">Allocated Labor</TableHead>
                        <TableHead className="text-right border-r">Total Allocated</TableHead>
                        <TableHead className="text-right bg-muted/30">Actual Materials</TableHead>
                        <TableHead className="text-right bg-muted/30">Actual Labor</TableHead>
                        <TableHead className="text-right bg-muted/30">Total Actual</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scopeSpendingData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            No scope data available.
                          </TableCell>
                        </TableRow>
                      ) : (
                        scopeSpendingData.map((row: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{row.scopeName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.allocatedMatCost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.allocatedLabCost)}</TableCell>
                            <TableCell className="text-right font-bold text-primary border-r">{formatCurrency(row.totalAllocated)}</TableCell>
                            <TableCell className={`text-right bg-muted/10 font-medium ${row.actualMatCost > row.allocatedMatCost ? 'text-destructive' : ''}`}>
                              {formatCurrency(row.actualMatCost)}
                            </TableCell>
                            <TableCell className={`text-right bg-muted/10 font-medium ${row.actualLabCost > row.allocatedLabCost ? 'text-destructive' : ''}`}>
                              {formatCurrency(row.actualLabCost)}
                            </TableCell>
                            <TableCell className={`text-right bg-muted/10 font-bold ${row.totalActual > row.totalAllocated ? 'text-destructive' : 'text-primary'}`}>
                              {formatCurrency(row.totalActual)}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 4. OCM (Out of BOM Materials) */}
            <TabsContent value="ocm">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-warning" />
                    Overhead & Contingency Materials (OCM)
                  </CardTitle>
                  <CardDescription>Materials consumed on site that were not included in the original BOM for their respective scopes.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date Used</TableHead>
                        <TableHead>Scope</TableHead>
                        <TableHead>Material</TableHead>
                        <TableHead className="text-right">Qty Used</TableHead>
                        <TableHead className="text-right">Total Cost</TableHead>
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ocmData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                            No OCM materials detected. All usage matches BOM.
                          </TableCell>
                        </TableRow>
                      ) : (
                        ocmData.map((row: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">{row.scopeName}</TableCell>
                            <TableCell className="font-medium">{row.materialName}</TableCell>
                            <TableCell className="text-right font-bold text-warning">{row.quantity} {row.unit}</TableCell>
                            <TableCell className="text-right font-medium">{formatCurrency(row.cost)}</TableCell>
                            <TableCell className="text-sm italic">{row.remarks || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5. Visual Analytics */}
            <TabsContent value="visual">
              <div className="space-y-6">
                {/* Cost Burn Rate */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      Cumulative Cost Burn Rate
                    </CardTitle>
                    <CardDescription>Track how project costs accumulate over time</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {visualAnalyticsData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No cost data available yet. Start logging site activities to see trends.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={visualAnalyticsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                          <Legend />
                          <Line type="monotone" dataKey="cumulativeCost" stroke="#8884d8" strokeWidth={2} name="Cumulative Cost" />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Daily Material Consumption */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Package className="h-5 w-5 text-primary" />
                      Daily Material Consumption Cost
                    </CardTitle>
                    <CardDescription>Material costs consumed each day</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {visualAnalyticsData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No material consumption data available.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={visualAnalyticsData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value: any) => formatCurrency(Number(value))} />
                          <Legend />
                          <Bar dataKey="materialCost" fill="#82ca9d" name="Material Cost" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>

                {/* Overall Progress Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-primary" />
                      Overall Project Progress
                    </CardTitle>
                    <CardDescription>Track overall completion percentage over time based on scope updates</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {progressChartData.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No progress updates available yet.
                      </div>
                    ) : (
                      <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={progressChartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" />
                          <YAxis domain={[0, 100]} tickFormatter={(val) => `${val}%`} />
                          <Tooltip formatter={(value: any) => [`${value}%`, 'Overall Completion']} />
                          <Line type="monotone" dataKey="completion" stroke="#22c55e" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        )}
      </div>
    </Layout>
  );
}