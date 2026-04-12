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
import { ClipboardList, Package, DollarSign, AlertCircle, Truck } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

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
      const [bomData, consumptionData, attendanceData, deliveriesData] = await Promise.all([
        bomService.getByProjectId(projectId),
        siteService.getMaterialConsumption(projectId),
        siteService.getSiteAttendance(projectId),
        siteService.getDeliveries(projectId)
      ]);

      setBom(bomData.data || null);
      setConsumption(consumptionData.data || []);
      setAttendance(attendanceData.data || []);
      setDeliveries(deliveriesData.data || []);
    } catch (err) {
      console.error("Error loading project data:", err);
      setBom(null);
      setConsumption([]);
      setAttendance([]);
      setDeliveries([]);
    } finally {
      setLoading(false);
    }
  };

  // 1. SWA Data
  const swaData = useMemo(() => {
    if (!bom?.bom_scope_of_work || !Array.isArray(bom.bom_scope_of_work)) return [];
    // Spread into a new array to prevent "Cannot assign to read only property" in strict mode sorting
    return [...bom.bom_scope_of_work].sort((a: any, b: any) => (a.order_number || 0) - (b.order_number || 0));
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

      const name = cons.material_name || "Unknown";
      const key = `${cons.bom_scope_id}_${name}`;
      const scope = bom.bom_scope_of_work.find((s: any) => s.id === cons.bom_scope_id);
      
      if (!usageMap[key]) {
        usageMap[key] = { allocated: 0, actual: 0, unit: cons.unit || "", scopeName: scope?.name || "Unknown Scope" };
      }
      usageMap[key].actual += Number(cons.quantity_used || 0);
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
        ? scope.bom_labor.reduce((sum: number, l: any) => sum + (Number(l.no_of_workers || 0) * Number(l.daily_rate || 0) * Number(l.duration_days || 0)), 0)
        : 0;

      // Actual Materials
      const actualMatCost = (consumption || [])
        .filter(c => c.bom_scope_id === scope.id)
        .reduce((sum: number, c: any) => {
          const bomMat = Array.isArray(scope.bom_materials)
            ? scope.bom_materials.find((m: any) => m.material_name === c.material_name)
            : null;
          const unitCost = bomMat ? Number(bomMat.unit_cost || 0) : 0;
          return sum + (Number(c.quantity_used || 0) * unitCost);
        }, 0);

      return {
        scopeName: scope.name || "Unknown Scope",
        allocatedMatCost,
        allocatedLabCost,
        totalAllocated: allocatedMatCost + allocatedLabCost,
        actualMatCost,
        totalActual: actualMatCost
      };
    });
  }, [bom, consumption]);

  // 4. OCM (Materials used but not in BOM)
  const ocmData = useMemo(() => {
    if (!bom?.bom_scope_of_work || !Array.isArray(bom.bom_scope_of_work)) return [];
    
    const ocmList: any[] = [];

    (consumption || []).forEach((cons: any) => {
      const scope = bom.bom_scope_of_work.find((s: any) => s.id === cons.bom_scope_id);
      if (scope) {
        const consName = cons.material_name?.toLowerCase() || "";
        const isInBom = Array.isArray(scope.bom_materials) && scope.bom_materials.some((m: any) => 
          (m.material_name?.toLowerCase() || "") === consName
        );
        
        if (!isInBom) {
          ocmList.push({
            date: cons.date_used,
            scopeName: scope.name || "Unknown Scope",
            materialName: cons.material_name || "Unknown Material",
            quantity: cons.quantity_used || 0,
            unit: cons.unit || "",
            remarks: cons.remarks || "-"
          });
        }
      }
    });

    return ocmList;
  }, [bom, consumption]);

  // 5. Warehouse Deployment vs Site Received
  const deliveryData = useMemo(() => {
    return (deliveries || []).map(d => {
      let items = [];
      try {
        if (typeof d.items === 'string') {
          items = JSON.parse(d.items);
        } else if (Array.isArray(d.items)) {
          items = d.items;
        }
      } catch (e) {
        // ignore
      }

      return {
        id: d.id,
        date: d.delivery_date,
        supplier: d.supplier || "Warehouse",
        status: d.status,
        receiptNumber: d.receipt_number,
        itemsCount: items.length,
        items
      };
    });
  }, [deliveries]);

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
            <TabsList className="grid grid-cols-2 md:grid-cols-5 w-full h-auto gap-2 bg-transparent">
              <TabsTrigger value="swa" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
                <ClipboardList className="h-4 w-4" />
                <span className="hidden lg:inline">SWA Accomplishment</span>
                <span className="lg:hidden">SWA</span>
              </TabsTrigger>
              <TabsTrigger value="materials" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
                <Package className="h-4 w-4" />
                <span className="hidden lg:inline">Material Usage</span>
                <span className="lg:hidden">Usage</span>
              </TabsTrigger>
              <TabsTrigger value="spent" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
                <DollarSign className="h-4 w-4" />
                <span className="hidden lg:inline">Spent vs Allocated</span>
                <span className="lg:hidden">Spending</span>
              </TabsTrigger>
              <TabsTrigger value="ocm" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
                <AlertCircle className="h-4 w-4" />
                <span className="hidden lg:inline">OCM Materials</span>
                <span className="lg:hidden">OCM</span>
              </TabsTrigger>
              <TabsTrigger value="warehouse" className="flex items-center gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground border bg-card py-2">
                <Truck className="h-4 w-4" />
                <span className="hidden lg:inline">Warehouse Deployment</span>
                <span className="lg:hidden">Deliveries</span>
              </TabsTrigger>
            </TabsList>

            {/* 1. SWA */}
            <TabsContent value="swa">
              <Card>
                <CardHeader>
                  <CardTitle>Statement of Work Accomplishment (SWA)</CardTitle>
                  <CardDescription>Progress and completion status per scope of work.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Scope of Work</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="w-[30%]">Progress</TableHead>
                        <TableHead className="text-right">Completed %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {swaData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                            No scopes defined in BOM.
                          </TableCell>
                        </TableRow>
                      ) : (
                        swaData.map((scope: any) => (
                          <TableRow key={scope.id}>
                            <TableCell className="font-medium">{scope.name}</TableCell>
                            <TableCell>
                              <Badge variant={scope.completion_percentage >= 100 ? "default" : scope.completion_percentage > 0 ? "secondary" : "outline"}>
                                {scope.completion_percentage >= 100 ? "Completed" : scope.completion_percentage > 0 ? "In Progress" : "Not Started"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Progress value={scope.completion_percentage || 0} className="h-2" />
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {Number(scope.completion_percentage || 0).toFixed(1)}%
                            </TableCell>
                          </TableRow>
                        ))
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
                        <TableHead className="text-right">Total Allocated</TableHead>
                        <TableHead className="text-right border-l">Actual Materials</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scopeSpendingData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No scope data available.
                          </TableCell>
                        </TableRow>
                      ) : (
                        scopeSpendingData.map((row: any, idx: number) => (
                          <TableRow key={idx}>
                            <TableCell className="font-medium">{row.scopeName}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.allocatedMatCost)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.allocatedLabCost)}</TableCell>
                            <TableCell className="text-right font-bold text-primary">{formatCurrency(row.totalAllocated)}</TableCell>
                            <TableCell className={`text-right border-l font-medium ${row.actualMatCost > row.allocatedMatCost ? 'text-destructive' : ''}`}>
                              {formatCurrency(row.actualMatCost)}
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
                        <TableHead>Remarks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ocmData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
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
                            <TableCell className="text-sm italic">{row.remarks || "-"}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            {/* 5. Warehouse vs Site Received */}
            <TabsContent value="warehouse">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck className="h-5 w-5 text-primary" />
                    Warehouse Deployment vs Site Received
                  </CardTitle>
                  <CardDescription>Track deliveries deployed from warehouse against what was actually received at the site.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Source/Supplier</TableHead>
                        <TableHead>Receipt No.</TableHead>
                        <TableHead>Items Count</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {deliveryData.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                            No deployment or delivery records found.
                          </TableCell>
                        </TableRow>
                      ) : (
                        deliveryData.map((row: any) => (
                          <TableRow key={row.id}>
                            <TableCell>{new Date(row.date).toLocaleDateString()}</TableCell>
                            <TableCell className="font-medium">{row.supplier}</TableCell>
                            <TableCell>{row.receiptNumber || "-"}</TableCell>
                            <TableCell>{row.itemsCount} items</TableCell>
                            <TableCell>
                              <Badge variant={row.status === "received" ? "default" : "secondary"}>
                                {row.status === "received" ? "Received at Site" : "Pending/In Transit"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

          </Tabs>
        )}
      </div>
    </Layout>
  );
}