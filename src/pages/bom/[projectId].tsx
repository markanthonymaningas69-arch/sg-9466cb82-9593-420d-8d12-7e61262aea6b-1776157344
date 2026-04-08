import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { bomService } from "@/services/bomService";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2, Save, ArrowLeft, Check, X, Printer } from "lucide-react";
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
  const [showIndirectCosts, setShowIndirectCosts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [indirectDialogOpen, setIndirectDialogOpen] = useState(false);

  // Inline scope creation
  const [showScopeInput, setShowScopeInput] = useState(false);
  const [newScopeName, setNewScopeName] = useState("");

  // Dialog / inline states
  const [laborDialogOpen, setLaborDialogOpen] = useState(false);
  const [selectedScopeId, setSelectedScopeId] = useState<string>("");
  const [editingLabor, setEditingLabor] = useState<Labor | null>(null);

  // Form states
  const [materialForm, setMaterialForm] = useState({
    name: "",
    description: "",
    quantity: "",
    unit: "",
    unit_selection: "",
    unit_cost: ""
  });

  const [laborForm, setLaborForm] = useState({
    calculation_method: "unit_cost" as "percentage" | "unit_cost",
    percentage: "",
    role: "",
    description: "",
    hours: "",
    rate: ""
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

    const { data: projectData } = await projectService.getById(projectId);
    setProject(projectData);

    const { data: bomData, error } = await bomService.getByProjectId(projectId);

    if (error && error.code === "PGRST116") {
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
      setShowIndirectCosts((bomData.bom_indirect_costs || []).length > 0);

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

  // Calculate material total for a scope
  const calculateScopeMaterialTotal = (scope: ScopeOfWork) => {
    const materials = scope.bom_materials || [];
    return materials.reduce((sum, m) => sum + (m.total_cost || 0), 0);
  };

  // Calculate labor total for a scope
  const calculateScopeLaborTotal = (scope: ScopeOfWork) => {
    const labor = scope.bom_labor || [];
    return labor.reduce((sum, l) => sum + (l.total_cost || 0), 0);
  };

  // Calculate direct cost for a scope (materials + labor)
  const calculateScopeDirectCost = (scope: ScopeOfWork) => {
    return calculateScopeMaterialTotal(scope) + calculateScopeLaborTotal(scope);
  };

  // Calculate total direct cost (all scopes)
  const calculateTotalDirectCost = () => {
    return scopes.reduce((sum, scope) => sum + calculateScopeDirectCost(scope), 0);
  };

  const calculateIndirectCost = () => {
    const directCost = calculateTotalDirectCost();
    const vat = parseFloat(indirectForm.vat || "0");
    const tax = parseFloat(indirectForm.tax || "0");
    const ocm = parseFloat(indirectForm.ocm || "0");
    const profit = parseFloat(indirectForm.profit || "0");
    const others = parseFloat(indirectForm.others_amount || "0");

    return directCost * (vat + tax + ocm + profit) / 100 + others;
  };

  const calculateGrandTotal = () => {
    return calculateTotalDirectCost() + calculateIndirectCost();
  };

  // Inline scope creation
  const handleAddScopeClick = () => {
    setShowScopeInput(true);
    setNewScopeName("");
  };

  const handleSaveScopeInline = async () => {
    if (!newScopeName.trim()) {
      alert("Please enter a Scope of Work name before adding.");
      return;
    }

    if (!bom) {
      alert("The Bill of Materials record is not loaded yet. Please reload the page and try again.");
      console.log("Cannot save scope because BOM is null:", { bom, newScopeName });
      return;
    }

    console.log("Creating scope with:", {
      bom_id: bom.id,
      name: newScopeName.trim(),
      description: "",
      order_number: scopes.length + 1
    });

    const { data, error } = await bomService.createScope({
      bom_id: bom.id,
      name: newScopeName.trim(),
      description: "",
      order_number: scopes.length + 1
    });

    if (error) {
      console.error("Error creating scope:", error);
      alert("Error creating scope: " + error.message);
      return;
    }

    console.log("Scope created successfully:", data);
    setShowScopeInput(false);
    setNewScopeName("");
    loadData();
  };

  const handleCancelScopeInline = () => {
    setShowScopeInput(false);
    setNewScopeName("");
  };

  const handleDeleteScope = async (id: string) => {
    if (confirm("Delete this scope of work? All materials and labor will be deleted.")) {
      await bomService.deleteScope(id);
      loadData();
    }
  };

  // Material operations
  const handleMaterialSubmitInline = async () => {
    if (!selectedScopeId) return;

    const quantity = parseFloat(materialForm.quantity || "0");
    const unitCost = parseFloat(materialForm.unit_cost || "0");

    const materialData = {
      scope_id: selectedScopeId,
      material_name: materialForm.description || materialForm.name || "Material",
      description: materialForm.description,
      quantity,
      unit: materialForm.unit,
      unit_cost: unitCost
      // total_cost is computed by the database; do not send it here to avoid errors
    };

    const { error } = await bomService.createMaterial(materialData as any);
    if (error) {
      console.error("Error creating material:", error);
      alert("Error creating material: " + error.message);
      return;
    }

    resetMaterialForm();
    setSelectedScopeId("");
    loadData();
  };

  const handleDeleteMaterial = async (id: string) => {
    if (confirm("Delete this material?")) {
      await bomService.deleteMaterial(id);
      loadData();
    }
  };

  const resetMaterialForm = () => {
    setMaterialForm({
      name: "",
      description: "",
      quantity: "",
      unit: "",
      unit_selection: "",
      unit_cost: ""
    });
  };

  // Labor operations
  const handleLaborSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedScopeId) return;

    const scope = scopes.find((s) => s.id === selectedScopeId);
    const materialTotal = scope ? calculateScopeMaterialTotal(scope) : 0;

    let totalCost = 0;
    if (laborForm.calculation_method === "percentage") {
      totalCost = materialTotal * (parseFloat(laborForm.percentage) / 100);
    } else {
      totalCost = parseFloat(laborForm.hours) * parseFloat(laborForm.rate);
    }

    const laborData = {
      scope_id: selectedScopeId,
      labor_type: laborForm.role || "Labor",
      description: laborForm.description,
      hours: laborForm.calculation_method === "unit_cost" ? parseFloat(laborForm.hours) : 0,
      hourly_rate: laborForm.calculation_method === "unit_cost" ? parseFloat(laborForm.rate) : 0,
      total_cost: totalCost
    };

    if (editingLabor) {
      await bomService.updateLabor(editingLabor.id, laborData);
    } else {
      await bomService.createLabor(laborData);
    }

    setLaborDialogOpen(false);
    resetLaborForm();
    loadData();
  };

  const handleEditLabor = (labor: Labor) => {
    setEditingLabor(labor);
    setLaborForm({
      calculation_method: labor.hours && labor.hourly_rate ? "unit_cost" : "percentage",
      percentage: "",
      role: labor.labor_type || "",
      description: labor.description || "",
      hours: labor.hours?.toString() || "",
      rate: labor.hourly_rate?.toString() || ""
    });
    setLaborDialogOpen(true);
  };

  const handleDeleteLabor = async (id: string) => {
    if (confirm("Delete this labor entry?")) {
      await bomService.deleteLabor(id);
      loadData();
    }
  };

  const resetLaborForm = () => {
    setLaborForm({
      calculation_method: "unit_cost",
      percentage: "",
      role: "",
      description: "",
      hours: "",
      rate: ""
    });
    setEditingLabor(null);
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

    await bomService.update(bom.id, {
      total_direct_cost: calculateTotalDirectCost(),
      total_indirect_cost: calculateIndirectCost(),
      grand_total: calculateGrandTotal()
    });

    loadData();
  };

  // Save entire BOM
  const handleSaveBOM = async () => {
    if (!bom) return;

    setSaving(true);

    // Update BOM totals
    await bomService.update(bom.id, {
      total_direct_cost: calculateTotalDirectCost(),
      total_indirect_cost: calculateIndirectCost(),
      grand_total: calculateGrandTotal()
    });

    // Update indirect costs if present
    if (showIndirectCosts) {
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
    }

    setSaving(false);
    loadData();
  };

  const handlePrintPDF = async () => {
    if (bom) {
      await handleSaveBOM();
    }
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </Layout>);

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

        {/* Initial Scope of Work form and Add Scope button */}
        {scopes.length === 0 ?
        <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Input
                placeholder="Enter the scope name"
                value={newScopeName}
                onChange={(e) => setNewScopeName(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleSaveScopeInline()}
                autoFocus
                className="flex-1" />
              
              </div>
              <div className="flex justify-end mt-3">
                <Button
                  onClick={handleSaveScopeInline}
                  disabled={!newScopeName.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scope of Work
                </Button>
              </div>
            </CardContent>
          </Card> :

        <>
            {!showScopeInput ?
          <div className="flex justify-end">
                <Button
                  onClick={handleAddScopeClick}
                  style={{ lineHeight: "1" }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scope of Work
                </Button>
              </div> :

          <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2">
                    <Input
                  placeholder="Enter the scope name"
                  value={newScopeName}
                  onChange={(e) => setNewScopeName(e.target.value)}
                  onKeyPress={(e) => e.key === "Enter" && handleSaveScopeInline()}
                  autoFocus
                  className="flex-1" />
                 
                  </div>
                  <div className="flex justify-end mt-3 gap-2">
                    <Button
                      onClick={handleSaveScopeInline}
                      disabled={!newScopeName.trim()}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Scope of Work
                    </Button>
                    <Button
                      variant="outline"
                      className="border-red-600 text-red-700 hover:bg-red-50"
                      onClick={handleCancelScopeInline}
                    >
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
          }
          </>
        }

        {/* Scopes List */}
        {scopes.map((scope) =>
        <Card key={scope.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <CardTitle className="text-xl">{scope.name}</CardTitle>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-red-600 hover:text-red-700"
                  onClick={() => handleDeleteScope(scope.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Materials Section */}
              {((scope.bom_materials || []).length > 0 || selectedScopeId === scope.id) &&
            <div className="mt-4">
                  <h3 className="font-semibold text-lg mb-3">Materials</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material Description</TableHead>
                        <TableHead className="w-24 text-right">Qty</TableHead>
                        <TableHead className="w-32">Unit</TableHead>
                        <TableHead className="w-32 text-right">Unit Cost</TableHead>
                        <TableHead className="w-32 text-right">Amount</TableHead>
                        <TableHead className="w-20 text-right"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(scope.bom_materials || []).map((material: Material) =>
                  <TableRow key={material.id}>
                          <TableCell>
                            <div className="font-medium">
                              {material.description || material.material_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {material.quantity}
                          </TableCell>
                          <TableCell>
                            {material.unit}
                          </TableCell>
                          <TableCell className="text-right">
                            ${((material.unit_cost ?? 0) as number).toFixed(2)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {(() => {
                              const quantity = material.quantity || 0;
                              const unitCost = material.unit_cost || 0;
                              const total =
                                material.total_cost != null
                                  ? material.total_cost
                                  : quantity * unitCost;
                              return `$${(total as number).toFixed(2)}`;
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700"
                              onClick={() => handleDeleteMaterial(material.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                  )}

                      {selectedScopeId === scope.id &&
                  <TableRow>
                          <TableCell>
                            <Input
                        placeholder="Material description"
                        value={materialForm.description}
                        onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          description: e.target.value
                        })
                        } />
                      
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                        type="number"
                        step="0.01"
                        value={materialForm.quantity}
                        onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          quantity: e.target.value
                        })
                        } />
                      
                          </TableCell>
                          <TableCell>
                            <div className="space-y-2">
                              <Select
                          value={materialForm.unit_selection}
                          onValueChange={(value) =>
                          setMaterialForm({
                            ...materialForm,
                            unit: value === "Other" ? "" : value,
                            unit_selection: value
                          })
                          }>
                          
                                <SelectTrigger>
                                  <SelectValue placeholder="Select unit" />
                                </SelectTrigger>
                                <SelectContent>
                                  {["Cu.m", "Sq.m", "Lin.m", "Pc", "Kg", "Box", "Other"].map((unitOption) =>
                            <SelectItem key={unitOption} value={unitOption}>
                                      {unitOption === "Other" ? "Other (specify)" : unitOption}
                                    </SelectItem>
                            )}
                                </SelectContent>
                              </Select>
                              {materialForm.unit_selection === "Other" &&
                        <Input
                          placeholder="Enter unit"
                          value={materialForm.unit}
                          onChange={(e) =>
                          setMaterialForm({
                            ...materialForm,
                            unit: e.target.value
                          })
                          } />

                        }
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <Input
                        type="number"
                        step="0.01"
                        value={materialForm.unit_cost}
                        onChange={(e) =>
                        setMaterialForm({
                          ...materialForm,
                          unit_cost: e.target.value
                        })
                        } />
                      
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {(() => {
                        const quantity = parseFloat(materialForm.quantity || "0");
                        const unitCost = parseFloat(materialForm.unit_cost || "0");
                        const amount = quantity * unitCost;
                        return `$${amount.toFixed(2)}`;
                      })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white"
                                onClick={handleMaterialSubmitInline}
                              >
                                Add
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="border-red-600 text-red-700 hover:bg-red-50"
                                onClick={() => {
                                  resetMaterialForm();
                                  setSelectedScopeId("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                  }
                    </TableBody>
                  </Table>
                  <div className="flex justify-end pt-2 border-t mt-2">
                    <div className="text-lg font-semibold">
                      Material Total: ${calculateScopeMaterialTotal(scope).toFixed(2)}
                    </div>
                  </div>
                </div>
            }

              {/* Add Materials Button under last material */}
              <div className="flex justify-center">
                <Button
                size="lg"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => {
                  setSelectedScopeId(scope.id);
                  resetMaterialForm();
                }}>
                
                  <Plus className="h-5 w-5 mr-2" />
                  Add Materials
                </Button>
              </div>
              <div className="flex justify-end pt-2 border-t mt-2">
                <div className="text-lg font-semibold">
                  Material Total: ${calculateScopeMaterialTotal(scope).toFixed(2)}
                </div>
              </div>

              {/* Labor Section */}
              {(scope.bom_materials || []).length > 0 &&
            <div>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-semibold text-lg">Labor Cost</h3>
                    <div className="flex gap-2">
                      <Button
                    size="sm"
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setSelectedScopeId(scope.id);
                      resetLaborForm();
                      setLaborForm((prev) => ({
                        ...prev,
                        calculation_method: "percentage"
                      }));
                      setLaborDialogOpen(true);
                    }}>
                    
                        % of Materials
                      </Button>
                      <Button
                    size="sm"
                    variant="outline"
                    className="border-green-600 text-green-700 hover:bg-green-50"
                    onClick={() => {
                      setSelectedScopeId(scope.id);
                      resetLaborForm();
                      setLaborForm((prev) => ({
                        ...prev,
                        calculation_method: "unit_cost"
                      }));
                      setLaborDialogOpen(true);
                    }}>
                    
                        By Unit Cost
                      </Button>
                    </div>
                  </div>

                  <Dialog
                open={laborDialogOpen && selectedScopeId === scope.id}
                onOpenChange={setLaborDialogOpen}>
                
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>{editingLabor ? "Edit Labor Cost" : "Add Labor Cost"}</DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleLaborSubmit} className="space-y-4">
                        <div className="space-y-2">
                          <Label>Calculation Method *</Label>
                          <Select
                        value={laborForm.calculation_method}
                        onValueChange={(value: "percentage" | "unit_cost") =>
                        setLaborForm({ ...laborForm, calculation_method: value })
                        }>
                        
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">By Percentage of Materials</SelectItem>
                              <SelectItem value="unit_cost">By Unit Cost</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {laborForm.calculation_method === "percentage" ?
                    <>
                            <div className="space-y-2">
                              <Label>Percentage of Material Cost *</Label>
                              <Input
                          type="number"
                          step="0.01"
                          value={laborForm.percentage}
                          onChange={(e) => setLaborForm({ ...laborForm, percentage: e.target.value })}
                          placeholder="e.g., 35 for 35%"
                          required />
                        
                              <p className="text-sm text-muted-foreground">
                                Material Total: ${calculateScopeMaterialTotal(scope).toFixed(2)}
                              </p>
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Input
                          value={laborForm.description}
                          onChange={(e) => setLaborForm({ ...laborForm, description: e.target.value })}
                          placeholder="Labor description" />
                        
                            </div>
                          </> :

                    <>
                            <div className="space-y-2">
                              <Label>Role/Type *</Label>
                              <Input
                          value={laborForm.role}
                          onChange={(e) => setLaborForm({ ...laborForm, role: e.target.value })}
                          placeholder="Carpenter, Mason, etc."
                          required />
                        
                            </div>
                            <div className="space-y-2">
                              <Label>Description</Label>
                              <Input
                          value={laborForm.description}
                          onChange={(e) => setLaborForm({ ...laborForm, description: e.target.value })} />
                        
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label>Hours *</Label>
                                <Input
                            type="number"
                            step="0.01"
                            value={laborForm.hours}
                            onChange={(e) => setLaborForm({ ...laborForm, hours: e.target.value })}
                            required />
                          
                              </div>
                              <div className="space-y-2">
                                <Label>Rate ($/hr) *</Label>
                                <Input
                            type="number"
                            step="0.01"
                            value={laborForm.rate}
                            onChange={(e) => setLaborForm({ ...laborForm, rate: e.target.value })}
                            required />
                          
                              </div>
                            </div>
                          </>
                    }

                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            className="border-red-600 text-red-700 hover:bg-red-50"
                            onClick={() => {
                              setLaborDialogOpen(false);
                              resetLaborForm();
                            }}>
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className="bg-green-600 hover:bg-green-700 text-white"
                          >
                            {editingLabor ? "Update" : "Add"} Labor Cost
                          </Button>
                        </div>
                      </form>
                    </DialogContent>
                  </Dialog>

                  {(scope.bom_labor || []).length > 0 ?
              <div className="space-y-2">
                      {(scope.bom_labor || []).map((labor: Labor) =>
                <div key={labor.id} className="flex justify-between items-center p-3 bg-muted/50 rounded-lg">
                          <div className="flex-1">
                            <div className="font-medium">{labor.labor_type}</div>
                            {labor.description && <div className="text-sm text-muted-foreground">{labor.description}</div>}
                            {labor.hours && labor.hourly_rate &&
                    <div className="text-sm text-muted-foreground mt-1">
                                {labor.hours} hrs × ${labor.hourly_rate?.toFixed(2)}/hr
                              </div>
                    }
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right font-semibold">
                              ${labor.total_cost?.toFixed(2)}
                            </div>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-green-600 hover:text-green-700"
                                onClick={() => {
                                  setSelectedScopeId(scope.id);
                                  handleEditLabor(labor);
                                }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="text-red-600 hover:text-red-700"
                                onClick={() => handleDeleteLabor(labor.id)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </div>
                )}
                      <div className="flex justify-end pt-2 border-t">
                        <div className="text-lg font-semibold">
                          Labor Total: ${calculateScopeLaborTotal(scope).toFixed(2)}
                        </div>
                      </div>
                    </div> :

              <p className="text-sm text-muted-foreground py-4">No labor costs added yet</p>
              }
                </div>
            }

              {/* Direct Cost Total */}
              {(scope.bom_materials || []).length > 0 &&
            <div className="pt-4 border-t-2 border-primary">
                  <div className="flex justify-end">
                    <div className="text-xl font-bold text-primary">
                      Direct Cost: ${calculateScopeDirectCost(scope).toFixed(2)}
                    </div>
                  </div>
                </div>
            }
            </CardContent>
          </Card>
        )}

        {/* Indirect Costs using a dialog, no full inline form */}
        {scopes.length > 0 &&
        <>
            <div className="flex justify-center">
              <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                setShowIndirectCosts(true);
                setIndirectDialogOpen(true);
              }}>
              
                <Plus className="h-5 w-5 mr-2" />
                Add Indirect Cost
              </Button>
            </div>

            <Dialog open={indirectDialogOpen} onOpenChange={setIndirectDialogOpen}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Indirect Costs</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>VAT (%)</Label>
                      <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.vat}
                      onChange={(e) => setIndirectForm({ ...indirectForm, vat: e.target.value })} />
                    
                    </div>
                    <div className="space-y-2">
                      <Label>Tax (%)</Label>
                      <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.tax}
                      onChange={(e) => setIndirectForm({ ...indirectForm, tax: e.target.value })} />
                    
                    </div>
                    <div className="space-y-2">
                      <Label>OCM (%)</Label>
                      <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.ocm}
                      onChange={(e) => setIndirectForm({ ...indirectForm, ocm: e.target.value })} />
                    
                    </div>
                    <div className="space-y-2">
                      <Label>Profit (%)</Label>
                      <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.profit}
                      onChange={(e) => setIndirectForm({ ...indirectForm, profit: e.target.value })} />
                    
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Others - Description</Label>
                    <Input
                    value={indirectForm.others_description}
                    onChange={(e) =>
                    setIndirectForm({ ...indirectForm, others_description: e.target.value })
                    }
                    placeholder="Specify other costs" />
                  
                  </div>
                  <div className="space-y-2">
                    <Label>Others - Amount ($)</Label>
                    <Input
                    type="number"
                    step="0.01"
                    value={indirectForm.others_amount}
                    onChange={(e) =>
                    setIndirectForm({ ...indirectForm, others_amount: e.target.value })
                    } />
                  
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Total Indirect Cost:</span>
                      <span className="text-2xl font-bold">
                        ${calculateIndirectCost().toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }

        {/* Grand Total */}
        {showIndirectCosts &&
        <>
            <Card className="bg-primary text-primary-foreground">
              <CardContent className="pt-6">
                <div className="flex justify-between items-center">
                  <h2 className="text-2xl font-bold">Grand Total</h2>
                  <div className="text-4xl font-bold">
                    ${calculateGrandTotal().toFixed(2)}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Print to PDF Button */}
            <div className="flex justify-center">
              <Button
              size="lg"
              onClick={handlePrintPDF}
              className="min-w-[200px]">
              
                <Printer className="h-5 w-5 mr-2" />
                Print to PDF
              </Button>
            </div>
          </>
        }
      </div>
    </Layout>);

}