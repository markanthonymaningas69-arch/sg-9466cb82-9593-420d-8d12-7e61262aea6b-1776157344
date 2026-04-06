import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { bomService } from "@/services/bomService";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2, Save, ArrowLeft } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type BOM = Database["public"]["Tables"]["bill_of_materials"]["Row"];
type ScopeOfWork = Database["public"]["Tables"]["bom_scope_of_work"]["Row"] & {
  bom_materials?: any[];
  bom_labor?: any[];
};
type Material = Database["public"]["Tables"]["bom_materials"]["Row"];
type Labor = Database["public"]["Tables"]["bom_labor"]["Row"];
type IndirectCost = Database["public"]["Tables"]["bom_indirect_costs"]["Row"];

export default function BillOfMaterials() {
  const router = useRouter();
  const { projectId } = router.query;
  const [project, setProject] = useState<any>(null);
  const [bom, setBom] = useState<BOM | null>(null);
  const [scopes, setScopes] = useState<ScopeOfWork[]>([]);
  const [indirectCosts, setIndirectCosts] = useState<IndirectCost[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Dialog states
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [laborDialogOpen, setLaborDialogOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<ScopeOfWork | null>(null);
  const [selectedScopeId, setSelectedScopeId] = useState<string>("");
  
  // Form states
  const [scopeForm, setScopeForm] = useState({
    name: "",
    description: ""
  });
  
  const [materialForm, setMaterialForm] = useState({
    name: "",
    description: "",
    quantity: "",
    unit: "",
    unit_cost: "",
    total_cost: ""
  });
  
  const [laborForm, setLaborForm] = useState({
    role: "",
    description: "",
    hours: "",
    rate: "",
    total_cost: ""
  });
  
  const [indirectForm, setIndirectForm] = useState({
    vat: "",
    tax: "",
    ocm: "",
    profit: "",
    others_amount: "",
    others_description: ""
  });

  useEffect(() => {
    if (projectId) {
      loadData();
    }
  }, [projectId]);

  const loadData = async () => {
    if (!projectId || typeof projectId !== "string") return;
    
    // Load project
    const { data: projectData } = await projectService.getById(projectId);
    setProject(projectData);
    
    // Load or create BOM
    const { data: bomData, error } = await bomService.getByProjectId(projectId);
    
    if (error && error.code === "PGRST116") {
      // Create new BOM
      const { data: newBom } = await bomService.create({
        project_id: projectId,
        bom_number: `BOM-${projectId.substring(0, 6).toUpperCase()}`,
        title: `${projectData?.name || 'Project'} BOM`,
        total_direct_cost: 0,
        total_indirect_cost: 0,
        grand_total: 0
      });
      setBom(newBom);
    } else if (bomData) {
      setBom(bomData);
      setScopes(bomData.bom_scope_of_work || []);
      setIndirectCosts(bomData.bom_indirect_costs || []);
      
      // Load indirect costs into form
      if (bomData.bom_indirect_costs && bomData.bom_indirect_costs.length > 0) {
        const indirect = bomData.bom_indirect_costs[0];
        const otherCosts: any = indirect.other_costs || { amount: 0, description: "" };
        setIndirectForm({
          vat: indirect.vat_percentage?.toString() || "",
          tax: indirect.tax_percentage?.toString() || "",
          ocm: indirect.ocm_percentage?.toString() || "",
          profit: indirect.profit_percentage?.toString() || "",
          others_amount: otherCosts.amount?.toString() || "",
          others_description: otherCosts.description || ""
        });
      }
    }
    
    setLoading(false);
  };

  // Calculate totals
  const calculateDirectCost = () => {
    let total = 0;
    scopes.forEach(scope => {
      const materials = scope.bom_materials || [];
      const labor = scope.bom_labor || [];
      
      materials.forEach(m => total += m.total_cost || 0);
      labor.forEach(l => total += l.total_cost || 0);
    });
    return total;
  };

  const calculateIndirectCost = () => {
    const directCost = calculateDirectCost();
    const vat = parseFloat(indirectForm.vat || "0");
    const tax = parseFloat(indirectForm.tax || "0");
    const ocm = parseFloat(indirectForm.ocm || "0");
    const profit = parseFloat(indirectForm.profit || "0");
    const others = parseFloat(indirectForm.others_amount || "0");
    
    return (directCost * (vat + tax + ocm + profit) / 100) + others;
  };

  const calculateGrandTotal = () => {
    return calculateDirectCost() + calculateIndirectCost();
  };

  // Scope operations
  const handleScopeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bom) return;
    
    const scopeData = {
      bom_id: bom.id,
      name: scopeForm.name,
      description: scopeForm.description,
      order_number: scopes.length + 1
    };
    
    if (editingScope) {
      await bomService.updateScope(editingScope.id, scopeData);
    } else {
      await bomService.createScope(scopeData);
    }
    
    setScopeDialogOpen(false);
    resetScopeForm();
    loadData();
  };

  const handleDeleteScope = async (id: string) => {
    if (confirm("Delete this scope of work? All materials and labor will be deleted.")) {
      await bomService.deleteScope(id);
      loadData();
    }
  };

  const resetScopeForm = () => {
    setScopeForm({ name: "", description: "" });
    setEditingScope(null);
  };

  // Material operations
  const handleMaterialSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScopeId) return;
    
    const materialData = {
      scope_id: selectedScopeId,
      material_name: materialForm.name,
      description: materialForm.description,
      quantity: parseFloat(materialForm.quantity),
      unit: materialForm.unit,
      unit_cost: parseFloat(materialForm.unit_cost),
      total_cost: parseFloat(materialForm.quantity) * parseFloat(materialForm.unit_cost)
    };
    
    await bomService.createMaterial(materialData);
    setMaterialDialogOpen(false);
    resetMaterialForm();
    loadData();
  };

  const handleDeleteMaterial = async (id: string) => {
    if (confirm("Delete this material?")) {
      await bomService.deleteMaterial(id);
      loadData();
    }
  };

  const resetMaterialForm = () => {
    setMaterialForm({ name: "", description: "", quantity: "", unit: "", unit_cost: "", total_cost: "" });
  };

  // Labor operations
  const handleLaborSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScopeId) return;
    
    const laborData = {
      scope_id: selectedScopeId,
      labor_type: laborForm.role,
      description: laborForm.description,
      hours: parseFloat(laborForm.hours),
      hourly_rate: parseFloat(laborForm.rate),
      total_cost: parseFloat(laborForm.hours) * parseFloat(laborForm.rate)
    };
    
    await bomService.createLabor(laborData);
    setLaborDialogOpen(false);
    resetLaborForm();
    loadData();
  };

  const handleDeleteLabor = async (id: string) => {
    if (confirm("Delete this labor entry?")) {
      await bomService.deleteLabor(id);
      loadData();
    }
  };

  const resetLaborForm = () => {
    setLaborForm({ role: "", description: "", hours: "", rate: "", total_cost: "" });
  };

  // Save indirect costs
  const handleSaveIndirectCosts = async () => {
    if (!bom) return;
    
    const indirectData = {
      bom_id: bom.id,
      vat_percentage: parseFloat(indirectForm.vat || "0"),
      tax_percentage: parseFloat(indirectForm.tax || "0"),
      ocm_percentage: parseFloat(indirectForm.ocm || "0"),
      profit_percentage: parseFloat(indirectForm.profit || "0"),
      other_costs: {
        amount: parseFloat(indirectForm.others_amount || "0"),
        description: indirectForm.others_description
      },
      total_indirect: calculateIndirectCost()
    };
    
    if (indirectCosts.length > 0) {
      await bomService.updateIndirectCost(indirectCosts[0].id, indirectData);
    } else {
      await bomService.createIndirectCost(indirectData);
    }
    
    // Update BOM totals
    await bomService.update(bom.id, {
      total_direct_cost: calculateDirectCost(),
      total_indirect_cost: calculateIndirectCost(),
      grand_total: calculateGrandTotal()
    });
    
    loadData();
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
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-heading font-bold">Bill of Materials</h1>
            <p className="text-muted-foreground mt-1">{project?.name}</p>
          </div>
        </div>

        {/* Cost Summary */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Direct Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${calculateDirectCost().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Indirect Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">${calculateIndirectCost().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Grand Total</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">${calculateGrandTotal().toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="scope" className="space-y-4">
          <TabsList>
            <TabsTrigger value="scope">Scope of Work</TabsTrigger>
            <TabsTrigger value="indirect">Indirect Costs</TabsTrigger>
          </TabsList>

          <TabsContent value="scope" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Scope of Work</h2>
              <Dialog open={scopeDialogOpen} onOpenChange={setScopeDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={resetScopeForm}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Scope
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingScope ? "Edit Scope" : "Add Scope of Work"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleScopeSubmit} className="space-y-4">
                    <div className="space-y-2">
                      <Label>Name *</Label>
                      <Input
                        value={scopeForm.name}
                        onChange={(e) => setScopeForm({ ...scopeForm, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Description</Label>
                      <Input
                        value={scopeForm.description}
                        onChange={(e) => setScopeForm({ ...scopeForm, description: e.target.value })}
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" onClick={() => setScopeDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">Save</Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {scopes.map((scope) => (
              <Card key={scope.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>{scope.name}</CardTitle>
                      {scope.description && <p className="text-sm text-muted-foreground mt-1">{scope.description}</p>}
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => handleDeleteScope(scope.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Materials */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold">Materials</h3>
                      <Dialog open={materialDialogOpen && selectedScopeId === scope.id} onOpenChange={setMaterialDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedScopeId(scope.id); resetMaterialForm(); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Material
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Material</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleMaterialSubmit} className="space-y-4">
                            <div className="space-y-2">
                              <Label>Name *</Label>
                              <Input
                                value={materialForm.name}
                                onChange={(e) => setMaterialForm({ ...materialForm, name: e.target.value })}
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Input
                                value={materialForm.description}
                                onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Quantity *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={materialForm.quantity}
                                  onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Unit</Label>
                                <Input
                                  value={materialForm.unit}
                                  onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label>Unit Cost *</Label>
                              <Input
                                type="number"
                                step="0.01"
                                value={materialForm.unit_cost}
                                onChange={(e) => setMaterialForm({ ...materialForm, unit_cost: e.target.value })}
                                required
                              />
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" onClick={() => setMaterialDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button type="submit">Save</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>Unit Cost</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(scope.bom_materials || []).map((material: Material) => (
                          <TableRow key={material.id}>
                            <TableCell>{material.material_name}</TableCell>
                            <TableCell>{material.description}</TableCell>
                            <TableCell>{material.quantity} {material.unit}</TableCell>
                            <TableCell>${material.unit_cost?.toFixed(2)}</TableCell>
                            <TableCell>${material.total_cost?.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteMaterial(material.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Labor */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="font-semibold">Labor</h3>
                      <Dialog open={laborDialogOpen && selectedScopeId === scope.id} onOpenChange={setLaborDialogOpen}>
                        <DialogTrigger asChild>
                          <Button size="sm" variant="outline" onClick={() => { setSelectedScopeId(scope.id); resetLaborForm(); }}>
                            <Plus className="h-4 w-4 mr-2" />
                            Add Labor
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Labor</DialogTitle>
                          </DialogHeader>
                          <form onSubmit={handleLaborSubmit} className="space-y-4">
                            <div className="space-y-2">
                              <Label>Role *</Label>
                              <Input
                                value={laborForm.role}
                                onChange={(e) => setLaborForm({ ...laborForm, role: e.target.value })}
                                placeholder="Carpenter, Mason, etc."
                                required
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Input
                                value={laborForm.description}
                                onChange={(e) => setLaborForm({ ...laborForm, description: e.target.value })}
                              />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Hours *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={laborForm.hours}
                                  onChange={(e) => setLaborForm({ ...laborForm, hours: e.target.value })}
                                  required
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Rate ($/hr) *</Label>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={laborForm.rate}
                                  onChange={(e) => setLaborForm({ ...laborForm, rate: e.target.value })}
                                  required
                                />
                              </div>
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button type="button" variant="outline" onClick={() => setLaborDialogOpen(false)}>
                                Cancel
                              </Button>
                              <Button type="submit">Save</Button>
                            </div>
                          </form>
                        </DialogContent>
                      </Dialog>
                    </div>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Role</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Hours</TableHead>
                          <TableHead>Rate</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead className="w-[50px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(scope.bom_labor || []).map((labor: Labor) => (
                          <TableRow key={labor.id}>
                            <TableCell>{labor.labor_type}</TableCell>
                            <TableCell>{labor.description}</TableCell>
                            <TableCell>{labor.hours} hrs</TableCell>
                            <TableCell>${labor.hourly_rate?.toFixed(2)}/hr</TableCell>
                            <TableCell>${labor.total_cost?.toFixed(2)}</TableCell>
                            <TableCell>
                              <Button size="icon" variant="ghost" onClick={() => handleDeleteLabor(labor.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="indirect" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Indirect Costs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>VAT (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.vat}
                      onChange={(e) => setIndirectForm({ ...indirectForm, vat: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tax (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.tax}
                      onChange={(e) => setIndirectForm({ ...indirectForm, tax: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>OCM (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.ocm}
                      onChange={(e) => setIndirectForm({ ...indirectForm, ocm: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Profit (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.profit}
                      onChange={(e) => setIndirectForm({ ...indirectForm, profit: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Others - Description</Label>
                  <Input
                    value={indirectForm.others_description}
                    onChange={(e) => setIndirectForm({ ...indirectForm, others_description: e.target.value })}
                    placeholder="Specify other costs"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Others - Amount ($)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={indirectForm.others_amount}
                    onChange={(e) => setIndirectForm({ ...indirectForm, others_amount: e.target.value })}
                  />
                </div>
                <Button onClick={handleSaveIndirectCosts} className="w-full">
                  <Save className="h-4 w-4 mr-2" />
                  Save Indirect Costs
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}