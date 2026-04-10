import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue } from
"@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from
"@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSettings } from "@/contexts/SettingsProvider";
import { bomService } from "@/services/bomService";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type BOM = Database["public"]["Tables"]["bill_of_materials"]["Row"];
type ScopeOfWork = Database["public"]["Tables"]["bom_scope_of_work"]["Row"] & {
  bom_materials?: Material[];
  bom_labor?: Labor[];
};
type Material = Database["public"]["Tables"]["bom_materials"]["Row"];
type Labor = Database["public"]["Tables"]["bom_labor"]["Row"];
type IndirectCost = Database["public"]["Tables"]["bom_indirect_costs"]["Row"];

type LaborCalculationMethod = "percentage" | "unit_cost";

// Scope cards use default neutral background (no custom colors).

export default function BillOfMaterials() {
  const { formatCurrency } = useSettings();
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

  const [showScopeInput, setShowScopeInput] = useState(false);
  const [newScopeName, setNewScopeName] = useState("");

  const [selectedScopeId, setSelectedScopeId] = useState<string>("");
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingLabor, setEditingLabor] = useState<Labor | null>(null);
  const [collapsedScopes, setCollapsedScopes] = useState<Record<string, boolean>>({});
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null);
  const [editingScopeName, setEditingScopeName] = useState<string>("");

  const [materialForm, setMaterialForm] = useState({
    name: "",
    description: "",
    quantity: "",
    unit: "",
    unit_selection: "",
    unit_cost: ""
  });

  const [laborForm, setLaborForm] = useState<{
    calculation_method: LaborCalculationMethod;
    percentage: string;
    role: string;
    description: string;
    hours: string;
    rate: string;
    unit: string;
    unit_selection: string;
  }>({
    calculation_method: "unit_cost",
    percentage: "",
    role: "",
    description: "",
    hours: "",
    rate: "",
    unit: "",
    unit_selection: ""
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
    if (projectId && typeof projectId === "string") {
      void loadData(projectId);
    }
  }, [projectId]);

  const loadData = async (id: string) => {
    setLoading(true);

    const { data: projectData } = await projectService.getById(id);
    setProject(projectData);

    const { data: bomData, error } = await bomService.getByProjectId(id);

    if (error && (error as any).code === "PGRST116") {
      const { data: newBom } = await bomService.create({
        project_id: id,
        bom_number: `BOM-${id.substring(0, 6).toUpperCase()}`,
        title: `${projectData?.name || "Project"} BOM`,
        total_direct_cost: 0,
        total_indirect_cost: 0,
        grand_total: 0
      });
      setBom(newBom);
      setScopes([]);
      setIndirectCosts([]);
    } else if (bomData) {
      setBom(bomData as BOM);
      setScopes((bomData as any).bom_scope_of_work || []);
      setIndirectCosts((bomData as any).bom_indirect_costs || []);
      const hasIndirect = (bomData as any).bom_indirect_costs?.length > 0;
      setShowIndirectCosts(hasIndirect);

      if (hasIndirect) {
        const indirect = (bomData as any).bom_indirect_costs[0] as IndirectCost;
        const otherCosts: any = indirect.other_costs || { amount: 0, description: "" };
        setIndirectForm({
          vat: indirect.vat_percentage?.toString() || "",
          tax: indirect.tax_percentage?.toString() || "",
          ocm: indirect.ocm_percentage?.toString() || "",
          profit: indirect.profit_percentage?.toString() || "",
          others_amount: otherCosts.amount?.toString() || "",
          others_description: otherCosts.description || ""
        });
      } else {
        setIndirectForm({
          vat: "",
          tax: "",
          ocm: "",
          profit: "",
          others_amount: "",
          others_description: ""
        });
      }
    }

    setLoading(false);
  };

  const calculateScopeMaterialTotal = (scope: ScopeOfWork): number => {
    const materials = scope.bom_materials || [];
    return materials.reduce((sum, m) => {
      const quantity =
        typeof m.quantity === "number" && Number.isFinite(m.quantity) ? m.quantity : 0;
      const unitCost =
        typeof m.unit_cost === "number" && Number.isFinite(m.unit_cost) ? m.unit_cost : 0;
      const storedTotal =
        typeof m.total_cost === "number" && Number.isFinite(m.total_cost)
          ? m.total_cost
          : null;
      const materialTotal = storedTotal != null ? storedTotal : quantity * unitCost;
      return sum + materialTotal;
    }, 0);
  };

  const calculateScopeLaborTotal = (scope: ScopeOfWork): number => {
    const labor = scope.bom_labor || [];
    return labor.reduce((sum, l) => {
      const total =
        (l.total_cost as number | null) ??
        (((l.hours || 0) as number) * ((l.hourly_rate || 0) as number));
      const numericTotal = typeof total === "number" && Number.isFinite(total) ? total : 0;
      return sum + numericTotal;
    }, 0);
  };

  const calculateScopeDirectCost = (scope: ScopeOfWork): number => {
    return calculateScopeMaterialTotal(scope) + calculateScopeLaborTotal(scope);
  };

  const calculateTotalDirectCost = (): number => {
    return scopes.reduce((sum, scope) => sum + calculateScopeDirectCost(scope), 0);
  };

  const calculateIndirectCost = (): number => {
    const directCost = calculateTotalDirectCost();
    const vat = parseFloat(indirectForm.vat || "0");
    const tax = parseFloat(indirectForm.tax || "0");
    const ocm = parseFloat(indirectForm.ocm || "0");
    const profit = parseFloat(indirectForm.profit || "0");
    const others = parseFloat(indirectForm.others_amount || "0");

    return directCost * (vat + tax + ocm + profit) / 100 + others;
  };

  const calculateGrandTotal = (): number => {
    return calculateTotalDirectCost() + calculateIndirectCost();
  };

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
      alert("Bill of Materials record is not loaded yet. Please reload and try again.");
      return;
    }

    const { error } = await bomService.createScope({
      bom_id: bom.id,
      name: newScopeName.trim(),
      description: "",
      order_number: scopes.length + 1
    } as Database["public"]["Tables"]["bom_scope_of_work"]["Insert"]);

    if (error) {
      alert("Error creating scope: " + error.message);
      return;
    }

    setShowScopeInput(false);
    setNewScopeName("");
    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleCancelScopeInline = () => {
    setShowScopeInput(false);
    setNewScopeName("");
  };

  const handleDeleteScope = async (id: string) => {
    if (!confirm("Delete this scope of work? All materials and labor will be deleted.")) {
      return;
    }
    const { error } = await bomService.deleteScope(id);
    if (error) {
      alert("Error deleting scope: " + error.message);
      return;
    }
    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleStartEditScope = (scope: ScopeOfWork) => {
    setEditingScopeId(scope.id as string);
    setEditingScopeName(scope.name || "");
  };

  const handleCancelEditScope = () => {
    setEditingScopeId(null);
    setEditingScopeName("");
  };

  const handleSaveEditScope = async () => {
    if (!editingScopeId) return;

    const trimmedName = editingScopeName.trim();
    if (!trimmedName) {
      alert("Scope name cannot be empty.");
      return;
    }

    const { error } = await bomService.updateScope(editingScopeId, {
      name: trimmedName
    } as Database["public"]["Tables"]["bom_scope_of_work"]["Update"]);

    if (error) {
      alert("Error updating scope: " + error.message);
      return;
    }

    setEditingScopeId(null);
    setEditingScopeName("");

    if (bom?.project_id) {
      await loadData(bom.project_id as string);
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
    setEditingMaterial(null);
  };

  const handleMaterialSubmitInline = async () => {
    if (!selectedScopeId) return;

    const quantity = parseFloat(materialForm.quantity || "0");
    const unitCost = parseFloat(materialForm.unit_cost || "0");

    const materialData: Database["public"]["Tables"]["bom_materials"]["Insert"] = {
      scope_id: selectedScopeId,
      material_name: materialForm.description || materialForm.name || "Material",
      description: materialForm.description || materialForm.name || "Material",
      quantity,
      unit: materialForm.unit,
      unit_cost: unitCost
    };

    let error;
    if (editingMaterial) {
      const { error: updateError } = await bomService.updateMaterial(
        editingMaterial.id as string,
        materialData
      );
      error = updateError;
    } else {
      const { error: createError } = await bomService.createMaterial(materialData);
      error = createError;
    }

    if (error) {
      alert("Error saving material: " + error.message);
      return;
    }

    resetMaterialForm();
    setSelectedScopeId("");
    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleEditMaterial = (material: Material) => {
    setSelectedScopeId(material.scope_id as string);
    const knownUnits = ["Cu.m", "Sq.m", "Lin.m", "Pc", "Kg", "Box"];
    const unit = material.unit || "";
    const isKnown = knownUnits.includes(unit);

    setMaterialForm({
      name: material.material_name || "",
      description: material.description || material.material_name || "",
      quantity: material.quantity != null ? material.quantity.toString() : "",
      unit,
      unit_selection: isKnown ? unit : unit ? "Other" : "",
      unit_cost: material.unit_cost != null ? (material.unit_cost as number).toString() : ""
    });
    setEditingMaterial(material);
  };

  const handleDeleteMaterial = async (id: string) => {
    if (!confirm("Delete this material?")) return;
    const { error } = await bomService.deleteMaterial(id);
    if (error) {
      alert("Error deleting material: " + error.message);
      return;
    }
    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const resetLaborForm = () => {
    setLaborForm({
      calculation_method: "unit_cost",
      percentage: "",
      role: "",
      description: "",
      hours: "",
      rate: "",
      unit: "",
      unit_selection: ""
    });
    setEditingLabor(null);
  };

  const handleLaborSubmit = async (scopeId: string) => {
    const scope = scopes.find((s) => s.id === scopeId);
    const materialTotal = scope ? calculateScopeMaterialTotal(scope) : 0;

    const isPercentage = laborForm.calculation_method === "percentage";

    let percentageValue = 0;
    let hoursValue = 0;
    let rateValue = 0;

    if (isPercentage) {
      percentageValue = parseFloat(laborForm.percentage || "0");
      if (!percentageValue || percentageValue <= 0) {
        alert("Please enter a valid percentage for labor.");
        return;
      }

      const laborTotal = materialTotal * (percentageValue / 100);
      hoursValue = 1;
      rateValue = laborTotal;
    } else {
      hoursValue = parseFloat(laborForm.hours || "0");
      rateValue = parseFloat(laborForm.rate || "0");

      if (!hoursValue || !rateValue) {
        alert("Please enter a valid quantity and rate for labor.");
        return;
      }

      if (!laborForm.unit && laborForm.unit_selection !== "") {
        alert("Please enter or select a unit for labor.");
        return;
      }
    }

    const description = isPercentage
      ? `${percentageValue || 0}% of materials`
      : laborForm.unit || laborForm.description || "Labor";

    const laborData: Database["public"]["Tables"]["bom_labor"]["Insert"] = {
      scope_id: scopeId,
      labor_type: laborForm.role || "Labor",
      description,
      hours: hoursValue,
      hourly_rate: rateValue
    };

    const existingScope = scopes.find((s) => s.id === scopeId);
    const existingLabor =
      existingScope &&
      Array.isArray(existingScope.bom_labor) &&
      existingScope.bom_labor.length > 0
        ? existingScope.bom_labor[0]
        : null;

    let error;
    if (editingLabor && editingLabor.scope_id === scopeId) {
      const { error: updateError } = await bomService.updateLabor(
        editingLabor.id as string,
        laborData
      );
      error = updateError;
    } else if (existingLabor) {
      const { error: updateError } = await bomService.updateLabor(
        existingLabor.id as string,
        laborData
      );
      error = updateError;
    } else {
      const { error: createError } = await bomService.createLabor(laborData);
      error = createError;
    }

    if (error) {
      console.error("Error saving labor:", error);
      alert("Error saving labor: " + error.message);
      return;
    }

    resetLaborForm();
    setEditingLabor(null);

    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleEditLabor = (labor: Labor) => {
    const knownUnits = ["Cu.m", "Sq.m", "Lin.m", "Kg", "lot"];
    const desc = labor.description || "";

    const percentageMatch = desc.match(/(\d+(\.\d+)?)\s*%/);
    const isPercentage = !!percentageMatch;
    const percentageValue = isPercentage && percentageMatch ? percentageMatch[1] : "";
    const isKnownUnit = !isPercentage && knownUnits.includes(desc);

    setEditingLabor(labor);
    setLaborForm({
      calculation_method: isPercentage ? "percentage" : "unit_cost",
      percentage: isPercentage ? percentageValue : "",
      role: labor.labor_type || "",
      description: desc,
      hours: isPercentage ? "" : labor.hours?.toString() || "",
      rate: isPercentage ? "" : labor.hourly_rate?.toString() || "",
      unit: isPercentage ? "" : isKnownUnit ? desc : desc || "",
      unit_selection: isPercentage ? "" : isKnownUnit ? desc : desc ? "Other" : ""
    });
  };

  const handleDeleteLabor = async (id: string) => {
    if (!confirm("Delete this labor entry?")) return;
    const { error } = await bomService.deleteLabor(id);
    if (error) {
      alert("Error deleting labor: " + error.message);
      return;
    }
    resetLaborForm();
    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleSaveIndirectCosts = async () => {
    if (!bom) return;

    const indirectData: Database["public"]["Tables"]["bom_indirect_costs"]["Insert"] = {
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
      await bomService.updateIndirectCost(indirectCosts[0].id as string, indirectData);
    } else {
      await bomService.createIndirectCost(indirectData);
    }

    await bomService.update(bom.id as string, {
      total_direct_cost: calculateTotalDirectCost(),
      total_indirect_cost: calculateIndirectCost(),
      grand_total: calculateGrandTotal()
    });

    if (bom.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleSaveBOM = async () => {
    if (!bom) return;
    setSaving(true);

    await bomService.update(bom.id as string, {
      total_direct_cost: calculateTotalDirectCost(),
      total_indirect_cost: calculateIndirectCost(),
      grand_total: calculateGrandTotal()
    });

    if (showIndirectCosts) {
      const indirectData: Database["public"]["Tables"]["bom_indirect_costs"]["Insert"] = {
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
        await bomService.updateIndirectCost(indirectCosts[0].id as string, indirectData);
      } else {
        await bomService.createIndirectCost(indirectData);
      }
    }

    setSaving(false);
    if (bom.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-heading font-bold">Bill of Materials</h1>
            <p className="text-muted-foreground mt-1">{project?.name}</p>
          </div>
        </div>

        {scopes.length === 0 ?
        <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2">
                <Input
                placeholder="Enter the scope name"
                value={newScopeName}
                onChange={(e) => setNewScopeName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    void handleSaveScopeInline();
                  }
                }}
                autoFocus
                className="flex-1" />
              
              </div>
              <div className="flex justify-end mt-3">
                <Button
                size="sm"
                onClick={() => void handleSaveScopeInline()}
                disabled={!newScopeName.trim()}
                className="bg-green-600 hover:bg-green-700 text-white">
                
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
              size="sm"
              onClick={handleAddScopeClick}
              style={{ lineHeight: "1" }}
              className="bg-green-600 hover:bg-green-700 text-white">
              
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scope of Work
                </Button>
              </div> :

          <Card>
                <CardContent className="pt-4">
                  <div className="flex items-center gap-2">
                    <Input
                  placeholder="Enter the scope name"
                  value={newScopeName}
                  onChange={(e) => setNewScopeName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      void handleSaveScopeInline();
                    }
                  }}
                  autoFocus
                  className="flex-1" />
                
                  </div>
                  <div className="flex justify-end mt-3 gap-2">
                    <Button
                  size="sm"
                  onClick={() => void handleSaveScopeInline()}
                  disabled={!newScopeName.trim()}
                  className="bg-green-600 hover:bg-green-700 text-white">
                  
                      <Plus className="h-4 w-4 mr-2" />
                      Add Scope of Work
                    </Button>
                    <Button
                  size="sm"
                  variant="outline"
                  className="border-red-600 text-red-700 hover:bg-red-50"
                  onClick={handleCancelScopeInline}>
                  
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
          }
          </>
        }

        {scopes.map((scope) => {
          const scopeKey = scope.id as string;
          const isCollapsed = collapsedScopes[scopeKey] ?? false;
          return (
            <Card
              key={scope.id}
              className="text-foreground"
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-2">
                    {editingScopeId === scope.id ? (
                      <>
                        <Input
                          value={editingScopeName}
                          onChange={(e) => setEditingScopeName(e.target.value)}
                          placeholder="Scope name"
                          className="h-8 max-w-xs"
                        />
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => void handleSaveEditScope()}
                        >
                          Save
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-700 hover:bg-red-50"
                          onClick={handleCancelEditScope}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <>
                        <CardTitle className="text-xl">{scope.name}</CardTitle>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-green-700 hover:text-green-800"
                          onClick={() => handleStartEditScope(scope)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={() =>
                        setCollapsedScopes((prev) => ({
                          ...prev,
                          [scopeKey]: !isCollapsed
                        }))
                      }
                    >
                      {isCollapsed ? "Show content" : "Hide content"}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-600 hover:text-red-700"
                      onClick={() => void handleDeleteScope(scope.id as string)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {!isCollapsed && (
                <CardContent className="space-y-4 pt-3">
                  {(scope.bom_materials || []).length > 0 || selectedScopeId === scope.id ?
            <div className="mt-2">
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-lg">Materials</h3>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Material Description</TableHead>
                        <TableHead className="w-24 text-right">Qty</TableHead>
                        <TableHead className="w-32">Unit</TableHead>
                        <TableHead className="w-32 text-right">Unit Cost</TableHead>
                        <TableHead className="w-32 text-right">Amount</TableHead>
                        <TableHead className="w-28 text-right" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(scope.bom_materials || []).map((material) =>
                  <TableRow key={material.id}>
                          <TableCell>
                            <div className="font-medium">
                              {material.description || material.material_name}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {material.quantity}
                          </TableCell>
                          <TableCell>{material.unit}</TableCell>
                          <TableCell className="text-right">
                            {formatCurrency(material.unit_cost as number ?? 0)}
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {(() => {
                        const total =
                        material.total_cost as number ??
                        (material.quantity || 0) * (
                        material.unit_cost as number || 0);
                        return formatCurrency(total);
                      })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                          size="icon"
                          variant="ghost"
                          className="text-green-600 hover:text-green-700"
                          onClick={() => handleEditMaterial(material)}>
                          
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                          size="icon"
                          variant="ghost"
                          className="text-red-600 hover:text-red-700"
                          onClick={() => void handleDeleteMaterial(material.id as string)}>
                          
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
                                  {["Cu.m", "Sq.m", "Lin.m", "Pc", "Kg", "Box", "Other"].map(
                              (unitOption) =>
                              <SelectItem key={unitOption} value={unitOption}>
                                        {unitOption === "Other" ?
                                "Other (specify)" :
                                unitOption}
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
                        return formatCurrency(amount);
                      })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end items-center gap-2">
                              <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => void handleMaterialSubmitInline()}>
                          
                                {editingMaterial ? "Update" : "Add"}
                              </Button>
                              <Button
                          size="sm"
                          variant="outline"
                          className="border-red-600 text-red-700 hover:bg-red-50"
                          onClick={() => {
                            resetMaterialForm();
                            setSelectedScopeId("");
                          }}>
                          
                                Cancel
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                  }
                    </TableBody>
                  </Table>
                </div> :
            null}

                  <div className="flex justify-end pt-2 border-t mt-2">
                    <div className="text-right text-sm space-y-1">
                      <div className="font-semibold">
                        Material Total: {formatCurrency(calculateScopeMaterialTotal(scope))}
                      </div>
                      <div>
                        Labor Total: {formatCurrency(calculateScopeLaborTotal(scope))}
                      </div>
                      <div className="font-semibold">
                        Subtotal: {formatCurrency(calculateScopeDirectCost(scope))}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        setSelectedScopeId(scope.id as string);
                        resetMaterialForm();
                      }}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Materials
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-600 text-red-700 hover:bg-red-50"
                      onClick={() => {
                        resetLaborForm();
                        setSelectedScopeId(scope.id as string);
                      }}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Add Labor
                    </Button>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}

        {scopes.length > 0 &&
        <Card className="bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Total Direct Cost</h2>
                <div className="text-3xl font-bold text-primary">
                  {formatCurrency(calculateTotalDirectCost())}
                </div>
              </div>
            </CardContent>
          </Card>
        }

        {scopes.length > 0 &&
        <>
            <div className="flex justify-center mt-4">
              <Button
              size="lg"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                setShowIndirectCosts(true);
                setIndirectDialogOpen(true);
              }}
              style={{ lineHeight: "1" }}>
              
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
                      onChange={(e) =>
                      setIndirectForm({ ...indirectForm, vat: e.target.value })
                      } />
                    
                    </div>
                    <div className="space-y-2">
                      <Label>Tax (%)</Label>
                      <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.tax}
                      onChange={(e) =>
                      setIndirectForm({ ...indirectForm, tax: e.target.value })
                      } />
                    
                    </div>
                    <div className="space-y-2">
                      <Label>OCM (%)</Label>
                      <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.ocm}
                      onChange={(e) =>
                      setIndirectForm({ ...indirectForm, ocm: e.target.value })
                      } />
                    
                    </div>
                    <div className="space-y-2">
                      <Label>Profit (%)</Label>
                      <Input
                      type="number"
                      step="0.01"
                      value={indirectForm.profit}
                      onChange={(e) =>
                      setIndirectForm({ ...indirectForm, profit: e.target.value })
                      } />
                    
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Others - Description</Label>
                    <Input
                    value={indirectForm.others_description}
                    onChange={(e) =>
                    setIndirectForm({
                      ...indirectForm,
                      others_description: e.target.value
                    })
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
                    setIndirectForm({
                      ...indirectForm,
                      others_amount: e.target.value
                    })
                    } />
                  
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center mb-4">
                      <span className="text-lg font-semibold">Total Indirect Cost:</span>
                      <span className="text-2xl font-bold">
                        {formatCurrency(calculateIndirectCost())}
                      </span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                      variant="outline"
                      className="border-red-600 text-red-700 hover:bg-red-50"
                      onClick={() => setIndirectDialogOpen(false)}>
                      
                        Cancel
                      </Button>
                      <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => {
                        void handleSaveIndirectCosts();
                        setIndirectDialogOpen(false);
                      }}>
                      
                        Save Indirect Costs
                      </Button>
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }

        {showIndirectCosts &&
        <Card className="bg-primary text-primary-foreground">
            <CardContent className="pt-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">Grand Total</h2>
                <div className="text-4xl font-bold">
                  {formatCurrency(calculateGrandTotal())}
                </div>
              </div>
            </CardContent>
          </Card>
        }
      </div>
    </Layout>);

}