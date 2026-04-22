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
  SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useSettings } from "@/contexts/SettingsProvider";
import { bomService } from "@/services/bomService";
import { projectService } from "@/services/projectService";
import { Plus, Pencil, Trash2, ArrowLeft, ArrowUp, ArrowDown } from "lucide-react";
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
  const { formatCurrency, formatNumber, isLocked } = useSettings();
  const router = useRouter();
  const { projectId } = router.query;

  const [project, setProject] = useState<any>(null);
  const [bom, setBom] = useState<BOM | null>(null);
  const [scopes, setScopes] = useState<ScopeOfWork[]>([]);
  const [indirectCosts, setIndirectCosts] = useState<IndirectCost[]>([]);
  const [masterItems, setMasterItems] = useState<any[]>([]);
  const [masterScopes, setMasterScopes] = useState<any[]>([]);
  const [isManualMaterial, setIsManualMaterial] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showIndirectCosts, setShowIndirectCosts] = useState(false);
  const [saving, setSaving] = useState(false);
  const [indirectDialogOpen, setIndirectDialogOpen] = useState(false);
  const [indirectCollapsed, setIndirectCollapsed] = useState(false);
  const [reorderMode, setReorderMode] = useState(false);

  const [showScopeInput, setShowScopeInput] = useState(false);
  const [newScopeName, setNewScopeName] = useState("");
  const [newScopeQuantity, setNewScopeQuantity] = useState("1");
  const [newScopeUnit, setNewScopeUnit] = useState("Cu.m");
  const [newScopeUnitSelection, setNewScopeUnitSelection] = useState("Cu.m");

  const [selectedScopeId, setSelectedScopeId] = useState<string>("");
  const [activeLaborScopeId, setActiveLaborScopeId] = useState<string | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingLabor, setEditingLabor] = useState<Labor | null>(null);
  const [collapsedScopes, setCollapsedScopes] = useState<Record<string, boolean>>({});
  const [editingScopeId, setEditingScopeId] = useState<string | null>(null);
  const [editingScopeName, setEditingScopeName] = useState<string>("");
  const [editingScopeQuantity, setEditingScopeQuantity] = useState<string>("1");
  const [editingScopeUnit, setEditingScopeUnit] = useState<string>("Cu.m");
  const [editingScopeUnitSelection, setEditingScopeUnitSelection] = useState<string>("Cu.m");

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

  type UnifiedIndirectCost = {
    id: string;
    type: string;
    description: string;
    value: string;
  };
  const [indirectCostsList, setIndirectCostsList] = useState<UnifiedIndirectCost[]>([]);
  const [indirectRowForm, setIndirectRowForm] = useState<UnifiedIndirectCost>({
    id: '',
    type: 'VAT',
    description: '',
    value: ''
  });

  useEffect(() => {
    if (projectId && typeof projectId === "string") {
      void loadData(projectId);
    }
  }, [projectId]);

  // Auto-sync BOM totals and Project Contract Amount
  useEffect(() => {
    if (loading || !project || !bom) return;

    const directCost = scopes.reduce((sum, scope) => {
      const matTotal = (scope.bom_materials || []).reduce((mSum, m) => {
        const qty = typeof m.quantity === "number" && Number.isFinite(m.quantity) ? m.quantity : 0;
        const cost = typeof m.unit_cost === "number" && Number.isFinite(m.unit_cost) ? m.unit_cost : 0;
        const storedTotal =
        typeof m.total_cost === "number" && Number.isFinite(m.total_cost)
          ? m.total_cost
          : null;
        const materialTotal = storedTotal != null ? storedTotal : qty * cost;
        return mSum + materialTotal;
      }, 0);
      
      const labTotal = (scope.bom_labor || []).reduce((lSum, l) => {
        const lTotal = l.total_cost ?? ((l.hours as number || 0) * (l.hourly_rate as number || 0));
        return lSum + (typeof lTotal === "number" && Number.isFinite(lTotal) ? lTotal : 0);
      }, 0);
      
      return sum + matTotal + labTotal;
    }, 0);

    let indirectCost = 0;
    indirectCostsList.forEach(c => {
      const val = parseFloat(c.value.replace(/,/g, "") || "0");
      if (['VAT', 'Tax', 'OCM', 'Profit'].includes(c.type)) {
        indirectCost += directCost * (val / 100);
      } else {
        indirectCost += val;
      }
    });

    const grandTotal = directCost + indirectCost;

    const syncToDB = async () => {
      const bomNeedsUpdate = Math.abs((bom.grand_total || 0) - grandTotal) > 0.01 || 
                             Math.abs((bom.total_direct_cost || 0) - directCost) > 0.01;
      const projectNeedsUpdate = Math.abs((project.budget || 0) - grandTotal) > 0.01;

      if (bomNeedsUpdate) {
        await bomService.update(bom.id as string, {
          total_direct_cost: directCost,
          total_indirect_cost: indirectCost,
          grand_total: grandTotal
        });
        setBom(prev => prev ? { ...prev, total_direct_cost: directCost, total_indirect_cost: indirectCost, grand_total: grandTotal } : prev);
      }

      if (projectNeedsUpdate) {
        await projectService.update(project.id as string, { budget: grandTotal });
        setProject(prev => prev ? { ...prev, budget: grandTotal } : prev);
      }
    };

    void syncToDB();
  }, [scopes, indirectCostsList, bom, project, loading]);

  const loadData = async (id: string) => {
    setLoading(true);

    const [{ data: projectData }, { data: masterData }, { data: masterScopesData }] = await Promise.all([
      projectService.getById(id),
      projectService.getMasterItems(),
      bomService.getMasterScopes()
    ]);
    setMasterItems(masterData || []);
    setMasterScopes(masterScopesData || []);
    setProject(projectData);

    let returnedScopes: any[] = [];

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
      setIndirectCostsList([]);
    } else if (bomData) {
      setBom(bomData as BOM);
      
      const sortedScopes = ((bomData as any).bom_scope_of_work || []).sort((a: any, b: any) => (a.order_number || 0) - (b.order_number || 0));
      setScopes(sortedScopes);
      returnedScopes = sortedScopes;
      
      const rawIndirect = (bomData as any).bom_indirect_costs || [];
      setIndirectCosts(rawIndirect);

      if (rawIndirect.length > 0) {
        const indirect = rawIndirect[0];
        const loadedList: UnifiedIndirectCost[] = [];
        
        if (indirect.vat_percentage) loadedList.push({ id: 'vat', type: 'VAT', description: 'VAT', value: Number(indirect.vat_percentage).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
        if (indirect.tax_percentage) loadedList.push({ id: 'tax', type: 'Tax', description: 'Tax', value: Number(indirect.tax_percentage).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
        if (indirect.ocm_percentage) loadedList.push({ id: 'ocm', type: 'OCM', description: 'OCM', value: Number(indirect.ocm_percentage).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
        if (indirect.profit_percentage) loadedList.push({ id: 'profit', type: 'Profit', description: 'Profit', value: Number(indirect.profit_percentage).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });

        try {
          const rawOtherCosts = indirect.other_costs;
          if (Array.isArray(rawOtherCosts)) {
            rawOtherCosts.forEach((oc: any, index: number) => {
              loadedList.push({
                id: oc.id || `loaded-${index}`,
                type: 'Others',
                description: oc.description || "",
                value: Number(oc.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
              });
            });
          }
        } catch (e) {
          console.error("Error parsing other costs", e);
        }
        setIndirectCostsList(loadedList);
      } else {
        setIndirectCostsList([]);
      }
    }

    setLoading(false);
    return returnedScopes;
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
    let total = 0;
    indirectCostsList.forEach(c => {
      const val = parseFloat(c.value.replace(/,/g, "") || "0");
      if (['VAT', 'Tax', 'OCM', 'Profit'].includes(c.type)) {
        total += directCost * (val / 100);
      } else {
        total += val;
      }
    });
    return total;
  };

  const saveIndirectCostsToDB = async (newList: UnifiedIndirectCost[]) => {
    if (!bom) return;

    let vat = 0, tax = 0, ocm = 0, profit = 0;
    const other_costs: any[] = [];
    
    const directCost = calculateTotalDirectCost();
    let totalIndirect = 0;

    newList.forEach(c => {
      const val = parseFloat(c.value.replace(/,/g, "") || "0");
      if (['VAT', 'Tax', 'OCM', 'Profit'].includes(c.type)) {
        totalIndirect += directCost * (val / 100);
      } else {
        totalIndirect += val;
      }

      if (c.type === 'VAT') vat += val;
      else if (c.type === 'Tax') tax += val;
      else if (c.type === 'OCM') ocm += val;
      else if (c.type === 'Profit') profit += val;
      else if (c.type === 'Others') other_costs.push({ id: c.id, description: c.description, amount: val });
    });

    const indirectData: Database["public"]["Tables"]["bom_indirect_costs"]["Insert"] = {
      bom_id: bom.id,
      vat_percentage: vat,
      tax_percentage: tax,
      ocm_percentage: ocm,
      profit_percentage: profit,
      other_costs: other_costs as any,
      total_indirect: totalIndirect
    };

    if (indirectCosts.length > 0) {
      await bomService.updateIndirectCost(indirectCosts[0].id as string, indirectData);
    } else {
      await bomService.createIndirectCost(indirectData);
    }

    await bomService.update(bom.id as string, {
      total_direct_cost: directCost,
      total_indirect_cost: totalIndirect,
      grand_total: directCost + totalIndirect
    });

    if (bom.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleAddOrUpdateIndirect = async () => {
    const val = parseFloat(indirectRowForm.value.replace(/,/g, "") || "0");
    if (val <= 0 && indirectRowForm.type !== 'Others') {
      alert("Please enter a valid amount or percentage.");
      return;
    }

    const rowToSave = { ...indirectRowForm, description: indirectRowForm.type === 'Others' ? 'Others' : indirectRowForm.description };

    let newList;
    if (indirectRowForm.id) {
      newList = indirectCostsList.map(c => c.id === indirectRowForm.id ? rowToSave : c);
    } else {
      newList = [...indirectCostsList, { ...rowToSave, id: Math.random().toString(36).substr(2, 9) }];
    }
    
    setIndirectCostsList(newList);
    setIndirectRowForm({ id: '', type: 'VAT', description: '', value: '' });
    
    await saveIndirectCostsToDB(newList);
  };

  const handleEditIndirect = (cost: UnifiedIndirectCost) => {
    setIndirectRowForm(cost);
  };

  const handleDeleteIndirect = async (id: string) => {
    const newList = indirectCostsList.filter(c => c.id !== id);
    setIndirectCostsList(newList);
    await saveIndirectCostsToDB(newList);
  };

  const calculateGrandTotal = (): number => {
    return calculateTotalDirectCost() + calculateIndirectCost();
  };

  const handleHideAllScopes = () => {
    const allCollapsed: Record<string, boolean> = {};
    scopes.forEach(s => { allCollapsed[s.id as string] = true; });
    setCollapsedScopes(allCollapsed);
    setIndirectCollapsed(true);
  };

  const handleToggleReorder = () => {
    if (!reorderMode) {
      handleHideAllScopes();
    }
    setReorderMode(!reorderMode);
  };

  const moveScope = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const newScopes = [...scopes];
      const temp = newScopes[index];
      newScopes[index] = newScopes[index - 1];
      newScopes[index - 1] = temp;
      setScopes(newScopes);
    } else if (direction === 'down' && index < scopes.length - 1) {
      const newScopes = [...scopes];
      const temp = newScopes[index];
      newScopes[index] = newScopes[index + 1];
      newScopes[index + 1] = temp;
      setScopes(newScopes);
    }
  };

  const handleSaveOrder = async () => {
    const updates = scopes.map((s, idx) => ({ id: s.id as string, order_number: idx + 1 }));
    const { error } = await bomService.updateScopeOrder(updates);
    if (error) {
      alert("Error saving order: " + error.message);
      return;
    }
    setReorderMode(false);
    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleAddScopeClick = () => {
    setShowScopeInput(true);
    setNewScopeName("");
    setNewScopeQuantity("1");
    setNewScopeUnit("Cu.m");
    setNewScopeUnitSelection("Cu.m");
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
      order_number: scopes.length + 1,
      quantity: parseFloat(newScopeQuantity) || 1,
      unit: newScopeUnit
    } as any);

    if (error) {
      alert("Error creating scope: " + error.message);
      return;
    }

    setShowScopeInput(false);
    setNewScopeName("");
    if (bom?.project_id) {
      const newScopes = await loadData(bom.project_id as string);
      
      // Auto-hide all scope contents so the user sees a clean high-level list
      const allCollapsed: Record<string, boolean> = {};
      if (newScopes) {
        newScopes.forEach((s: any) => { allCollapsed[s.id as string] = true; });
      }
      setCollapsedScopes(allCollapsed);
      setIndirectCollapsed(true);
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
    setEditingScopeQuantity((scope as any).quantity != null ? String((scope as any).quantity) : "1");
    const u = (scope as any).unit || "Cu.m";
    setEditingScopeUnit(u);
    setEditingScopeUnitSelection(["Cu.m", "Sq.m", "Lin.m", "Kg"].includes(u) ? u : "Other");
  };

  const handleCancelEditScope = () => {
    setEditingScopeId(null);
    setEditingScopeName("");
    setEditingScopeQuantity("1");
    setEditingScopeUnit("Cu.m");
    setEditingScopeUnitSelection("Cu.m");
  };

  const handleSaveEditScope = async () => {
    if (!editingScopeId) return;

    const trimmedName = editingScopeName.trim();
    if (!trimmedName) {
      alert("Scope name cannot be empty.");
      return;
    }

    const { error } = await bomService.updateScope(editingScopeId, {
      name: trimmedName,
      quantity: parseFloat(editingScopeQuantity) || 1,
      unit: editingScopeUnit
    } as any);

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
    setIsManualMaterial(false);
  };

  const handleMaterialChange = (materialName: string) => {
    if (materialName === "custom") {
      setIsManualMaterial(true);
      setMaterialForm(prev => ({
        ...prev,
        name: "",
        description: "",
        unit: "",
        unit_selection: "",
        unit_cost: ""
      }));
      return;
    }
    
    setIsManualMaterial(false);
    const selectedMaster = masterItems.find(m => m.name === materialName);
    
    if (selectedMaster) {
      const knownUnits = [
        "Bag", "Bd.ft", "Box", "Cu.m", "Gal", "Kg", "Length", "Lin.m", "Liter", 
        "Lot", "M", "Pail", "Pair", "Pc", "Roll", "Set", "Sq.m", "Unit"
      ];
      const unit = selectedMaster.unit || "";
      const isKnown = knownUnits.includes(unit);
      const existsInMaster = masterItems.some(m => m.name.toLowerCase() === (material.description || material.material_name).toLowerCase());

      setMaterialForm({
        name: selectedMaster.name,
        description: selectedMaster.name,
        quantity: selectedMaster.quantity != null ? Number(selectedMaster.quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
        unit,
        unit_selection: isKnown ? unit : unit ? "Other" : "",
        unit_cost: selectedMaster.default_cost ? Number(selectedMaster.default_cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
      });
    } else {
      setMaterialForm(prev => ({
        ...prev,
        name: materialName,
        description: materialName
      }));
    }
  };

  const getSelectableScopeMaterials = (scope: ScopeOfWork, includeMaterialName?: string) => {
    const normalizedIncludedName = includeMaterialName?.trim().toLowerCase() || "";
    const addedMaterialNames = new Set(
      (scope.bom_materials || [])
        .map((material) =>
          (material.material_name || material.description || "").trim().toLowerCase()
        )
        .filter(Boolean)
    );

    if (normalizedIncludedName) {
      addedMaterialNames.delete(normalizedIncludedName);
    }

    return masterItems
      .filter((item) => {
        const linkedScopes = Array.isArray(item.associated_scopes) ? item.associated_scopes : [];
        return Boolean(scope.name) && linkedScopes.includes(scope.name);
      })
      .filter((item) => {
        const normalizedName = (item.name || "").trim().toLowerCase();
        return Boolean(normalizedName) && !addedMaterialNames.has(normalizedName);
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  };

  const handleMaterialSubmitInline = async () => {
    if (!selectedScopeId) return;

    const quantity = parseFloat(materialForm.quantity.replace(/,/g, "") || "0");
    const unitCost = parseFloat(materialForm.unit_cost.replace(/,/g, "") || "0");

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

    if (isManualMaterial && materialData.material_name) {
      const exists = masterItems.some(m => m.name.toLowerCase() === materialData.material_name.toLowerCase());
      if (!exists) {
        const currentScope = scopes.find(s => s.id === selectedScopeId);
        const associated_scopes = currentScope?.name ? [currentScope.name] : [];

        const { data: newMasterItem } = await projectService.createMasterItem({
          name: materialData.material_name,
          category: "Construction Materials",
          unit: materialData.unit || "Other",
          default_cost: unitCost,
          associated_scopes
        });
        
        if (newMasterItem) {
          setMasterItems(prev => {
            const updated = [...prev, newMasterItem];
            return updated.sort((a, b) => a.name.localeCompare(b.name));
          });
        }
      }
    }

    resetMaterialForm();
    setSelectedScopeId("");
    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleEditMaterial = (material: Material) => {
    setSelectedScopeId(material.scope_id as string);
    const knownUnits = [
      "Bag", "Bd.ft", "Box", "Cu.m", "Gal", "Kg", "Length", "Lin.m", "Liter", 
      "Lot", "M", "Pail", "Pair", "Pc", "Roll", "Set", "Sq.m", "Unit"
    ];
    const unit = material.unit || "";
    const isKnown = knownUnits.includes(unit);
    
    const existsInMaster = masterItems.some(m => m.name.toLowerCase() === (material.description || material.material_name).toLowerCase());
    setIsManualMaterial(!existsInMaster && !!(material.description || material.material_name));

    setMaterialForm({
      name: material.material_name || "",
      description: material.description || material.material_name || "",
      quantity: material.quantity != null ? Number(material.quantity).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "",
      unit,
      unit_selection: isKnown ? unit : unit ? "Other" : "",
      unit_cost: material.unit_cost != null ? Number(material.unit_cost).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""
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
      percentageValue = parseFloat(laborForm.percentage.replace(/,/g, "") || "0");
      if (!percentageValue || percentageValue <= 0) {
        alert("Please enter a valid percentage for labor.");
        return;
      }

      const laborTotal = materialTotal * (percentageValue / 100);
      hoursValue = 1;
      rateValue = laborTotal;
    } else {
      hoursValue = parseFloat(laborForm.hours.replace(/,/g, "") || "0");
      rateValue = parseFloat(laborForm.rate.replace(/,/g, "") || "0");

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
    setActiveLaborScopeId(null);

    if (bom?.project_id) {
      await loadData(bom.project_id as string);
    }
  };

  const handleEditLabor = (labor: Labor) => {
    const knownUnits = ["Cu.m", "Kg", "Lin.m", "Lot", "Sq.m"];
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
      hours: isPercentage ? "" : (labor.hours != null ? Number(labor.hours).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""),
      rate: isPercentage ? "" : (labor.hourly_rate != null ? Number(labor.hourly_rate).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ""),
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
      <div className="space-y-1.5">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => router.push("/projects")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-heading font-bold">Bill of Materials</h1>
            <p className="text-muted-foreground mt-1">{project?.name}</p>
          </div>
        </div>

        {scopes.length === 0 ?
        <Card>
            <CardContent className="pt-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-2">
                  <Select
                    value={newScopeName}
                    onValueChange={(val) => setNewScopeName(val)}
                  >
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder="Select scope from catalog" />
                    </SelectTrigger>
                    <SelectContent>
                      {masterScopes.map(scope => (
                        <SelectItem key={scope.id} value={scope.name}>{scope.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input placeholder="Or enter custom scope name" value={newScopeName} onChange={(e) => setNewScopeName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { void handleSaveScopeInline(); } }} className="flex-1" />
                      <Input placeholder="Qty" type="number" value={newScopeQuantity} onChange={(e) => setNewScopeQuantity(e.target.value)} className="w-16" />
                      <Select value={newScopeUnitSelection} onValueChange={(val) => { setNewScopeUnitSelection(val); if (val !== "Other") setNewScopeUnit(val); else setNewScopeUnit(""); }}>
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Cu.m", "Sq.m", "Lin.m", "Kg", "Other"].map((u) => (
                            <SelectItem key={u} value={u}>{u === "Other" ? "Others/Input" : u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newScopeUnitSelection === "Other" && (
                        <Input placeholder="Unit" value={newScopeUnit} onChange={(e) => setNewScopeUnit(e.target.value)} className="w-20" />
                      )}
                </div>
              </div>
              <div className="flex justify-end mt-1 gap-2">
                <Button
                  size="sm"
                  onClick={() => void handleSaveScopeInline()}
                  disabled={!newScopeName.trim() || isLocked}
                  className="bg-green-600 hover:bg-green-700 text-white">
                  
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scope of Work
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-red-600 dark:border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={handleCancelScopeInline}>
                  
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card> :

        <>
            {!showScopeInput ?
          <div className="flex justify-end gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleHideAllScopes}
                >
                  Hide Contents
                </Button>
                {reorderMode ? (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                    onClick={() => void handleSaveOrder()}
                    disabled={isLocked}
                  >
                    Save Order
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleToggleReorder}
                    disabled={isLocked}
                  >
                    Reorder Scopes
                  </Button>
                )}
                <Button
              size="sm"
              onClick={handleAddScopeClick}
              disabled={isLocked}
              style={{ lineHeight: "1" }}
              className="bg-green-600 hover:bg-green-700 text-white">
              
                  <Plus className="h-4 w-4 mr-2" />
                  Add Scope of Work
                </Button>
              </div> :

          <Card>
                <CardContent className="pt-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 flex gap-2">
                      <Select
                        value={newScopeName}
                        onValueChange={(val) => setNewScopeName(val)}
                      >
                        <SelectTrigger className="flex-1">
                          <SelectValue placeholder="Select scope from catalog" />
                        </SelectTrigger>
                        <SelectContent>
                          {masterScopes.map(scope => (
                            <SelectItem key={scope.id} value={scope.name}>{scope.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input placeholder="Or enter custom scope name" value={newScopeName} onChange={(e) => setNewScopeName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { void handleSaveScopeInline(); } }} className="flex-1" />
                      <Input placeholder="Qty" type="number" value={newScopeQuantity} onChange={(e) => setNewScopeQuantity(e.target.value)} className="w-16" />
                      <Select value={newScopeUnitSelection} onValueChange={(val) => { setNewScopeUnitSelection(val); if (val !== "Other") setNewScopeUnit(val); else setNewScopeUnit(""); }}>
                        <SelectTrigger className="w-24">
                          <SelectValue placeholder="Unit" />
                        </SelectTrigger>
                        <SelectContent>
                          {["Cu.m", "Sq.m", "Lin.m", "Kg", "Other"].map((u) => (
                            <SelectItem key={u} value={u}>{u === "Other" ? "Others/Input" : u}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {newScopeUnitSelection === "Other" && (
                        <Input placeholder="Unit" value={newScopeUnit} onChange={(e) => setNewScopeUnit(e.target.value)} className="w-20" />
                      )}
                    </div>
                  </div>
                  <div className="flex justify-end mt-1 gap-2">
                    <Button
                  size="sm"
                  onClick={() => void handleSaveScopeInline()}
                  disabled={!newScopeName.trim() || isLocked}
                  className="bg-green-600 hover:bg-green-700 text-white">
                  
                      <Plus className="h-4 w-4 mr-2" />
                      Add Scope of Work
                    </Button>
                    <Button
                  size="sm"
                  variant="outline"
                  className="border-red-600 dark:border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={handleCancelScopeInline}>
                  
                      Cancel
                    </Button>
                  </div>
                </CardContent>
              </Card>
          }
          </>
        }

        {/* Hide all existing scopes and totals if the user is currently adding a new scope */}
        {!showScopeInput && (
          <>
            {scopes.map((scope, index) => {
              const scopeKey = scope.id as string;
              const isCollapsed = collapsedScopes[scopeKey] ?? false;
              const scopeQuantity = Number((scope as { quantity?: number }).quantity || 0);
              const scopeUnit = ((scope as { unit?: string }).unit || "").trim();

              return (
                <Card key={scope.id} className="text-foreground">
                  <CardHeader className={isCollapsed || reorderMode ? "py-1 px-4" : "pt-2 px-6 pb-1"}>
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div className="flex items-center gap-2">
                        {reorderMode && (
                          <div className="flex items-center gap-1">
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => moveScope(index, "up")}
                              disabled={index === 0 || isLocked}
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="outline"
                              className="h-7 w-7"
                              onClick={() => moveScope(index, "down")}
                              disabled={index === scopes.length - 1 || isLocked}
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        )}

                        {editingScopeId === scope.id ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              value={editingScopeName}
                              onChange={(e) => setEditingScopeName(e.target.value)}
                              placeholder="Scope name"
                              className="h-7 min-w-[220px]"
                            />
                            <Input
                              type="number"
                              value={editingScopeQuantity}
                              onChange={(e) => setEditingScopeQuantity(e.target.value)}
                              placeholder="Qty"
                              className="h-7 w-20"
                            />
                            <Select
                              value={editingScopeUnitSelection}
                              onValueChange={(val) => {
                                setEditingScopeUnitSelection(val);
                                if (val !== "Other") {
                                  setEditingScopeUnit(val);
                                } else {
                                  setEditingScopeUnit("");
                                }
                              }}
                            >
                              <SelectTrigger className="h-7 w-24">
                                <SelectValue placeholder="Unit" />
                              </SelectTrigger>
                              <SelectContent>
                                {["Cu.m", "Sq.m", "Lin.m", "Kg", "Other"].map((u) => (
                                  <SelectItem key={u} value={u}>
                                    {u === "Other" ? "Others/Input" : u}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {editingScopeUnitSelection === "Other" && (
                              <Input
                                placeholder="Unit"
                                value={editingScopeUnit}
                                onChange={(e) => setEditingScopeUnit(e.target.value)}
                                className="h-7 w-24"
                              />
                            )}
                          </div>
                        ) : (
                          <div>
                            <CardTitle className="text-base">{scope.name || "Untitled Scope"}</CardTitle>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {formatNumber(scopeQuantity)} {scopeUnit || "Unit"}
                            </p>
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {editingScopeId === scope.id ? (
                          <>
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white"
                              onClick={() => void handleSaveEditScope()}
                              disabled={isLocked}
                            >
                              Save
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleCancelEditScope}
                            >
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            {!reorderMode && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  setCollapsedScopes((prev) => ({
                                    ...prev,
                                    [scopeKey]: !isCollapsed
                                  }))
                                }
                              >
                                {isCollapsed ? "Show content" : "Hide content"}
                              </Button>
                            )}
                            {!reorderMode && (
                              <>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-green-700 hover:text-green-800"
                                  onClick={() => handleStartEditScope(scope)}
                                  disabled={isLocked}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-8 w-8 text-red-600 hover:text-red-700"
                                  onClick={() => void handleDeleteScope(scope.id as string)}
                                  disabled={isLocked}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {!isCollapsed && !reorderMode && (
                    <CardContent className="space-y-3">
                      {(scope.bom_materials || []).length > 0 || selectedScopeId === scope.id ? (
                        <div className="mt-0.5">
                          <div className="flex justify-between items-center mb-0.5">
                            <h3 className="font-semibold text-base">Materials</h3>
                          </div>
                          <Table>
                            <TableHeader>
                              <TableRow className="h-7 text-xs hover:bg-transparent border-b">
                                <TableHead className="py-1">Material</TableHead>
                                <TableHead className="py-1 text-right w-24">Qty</TableHead>
                                <TableHead className="py-1 w-28">Unit</TableHead>
                                <TableHead className="py-1 text-right w-28">Unit Cost</TableHead>
                                <TableHead className="py-1 text-right w-28">Amount</TableHead>
                                <TableHead className="py-1 text-right w-20"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(scope.bom_materials || []).map((material) =>
                                editingMaterial?.id === material.id ? (
                                  <TableRow key={material.id} className="h-7 bg-muted/20 border-y border-primary/20">
                                    <TableCell className="py-1">
                                      <div className="flex flex-col gap-1">
                                        <Select value={materialForm.name} onValueChange={(val) => handleMaterialChange(val)}>
                                          <SelectTrigger className="h-6 text-xs">
                                            <SelectValue placeholder="Select material" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            <SelectItem value="custom">-- Custom Material --</SelectItem>
                                            {getSelectableScopeMaterials(scope, material.material_name || material.description || "").map((m) => (
                                              <SelectItem key={m.id} value={m.name}>
                                                {m.name}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {isManualMaterial && (
                                          <Input
                                            placeholder="Description"
                                            className="h-6 text-xs"
                                            value={materialForm.description}
                                            onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                                          />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-1 text-right">
                                      <Input
                                        placeholder="Qty"
                                        value={materialForm.quantity}
                                        onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                                        className="h-6 text-xs text-right"
                                      />
                                    </TableCell>
                                    <TableCell className="py-1">
                                      <div className="flex flex-col gap-1">
                                        <Select
                                          value={materialForm.unit_selection}
                                          onValueChange={(v) => setMaterialForm({ ...materialForm, unit: v === "Other" ? "" : v, unit_selection: v })}
                                        >
                                          <SelectTrigger className="h-6 text-xs">
                                            <SelectValue placeholder="Unit" />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {["Bag", "Bd.ft", "Box", "Cu.m", "Gal", "Kg", "Length", "Lin.m", "Liter", "Lot", "M", "Pail", "Pair", "Pc", "Roll", "Set", "Sq.m", "Unit", "Other"].map((u) => (
                                              <SelectItem key={u} value={u}>
                                                {u === "Other" ? "Others/Input" : u}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {materialForm.unit_selection === "Other" && (
                                          <Input
                                            placeholder="Unit"
                                            className="h-6 text-xs"
                                            value={materialForm.unit}
                                            onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                                          />
                                        )}
                                      </div>
                                    </TableCell>
                                    <TableCell className="py-1 text-right">
                                      <Input
                                        placeholder="Cost"
                                        value={materialForm.unit_cost}
                                        onChange={(e) => setMaterialForm({ ...materialForm, unit_cost: e.target.value })}
                                        className="h-6 text-xs text-right"
                                      />
                                    </TableCell>
                                    <TableCell className="py-1 text-right font-semibold text-sm">
                                      {formatCurrency((parseFloat(materialForm.quantity.replace(/,/g, "")) || 0) * (parseFloat(materialForm.unit_cost.replace(/,/g, "")) || 0))}
                                    </TableCell>
                                    <TableCell className="py-1 text-right">
                                      <div className="flex justify-end items-center gap-1">
                                        <Button
                                          size="sm"
                                          className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-xs"
                                          onClick={() => void handleMaterialSubmitInline()}
                                          disabled={isLocked}
                                        >
                                          Update
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
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
                                ) : (
                                  <TableRow key={material.id} className="h-7">
                                    <TableCell className="py-0.5">
                                      <div className="font-medium text-sm">
                                        {material.description || material.material_name}
                                      </div>
                                    </TableCell>
                                    <TableCell className="text-right py-0.5 text-sm">
                                      {formatNumber((material.quantity as number) || 0)}
                                    </TableCell>
                                    <TableCell className="py-0.5 text-sm">{material.unit}</TableCell>
                                    <TableCell className="text-right py-0.5 text-sm">
                                      {formatCurrency((material.unit_cost as number) || 0)}
                                    </TableCell>
                                    <TableCell className="text-right font-semibold py-0.5 text-sm">
                                      {formatCurrency(
                                        (material.total_cost as number) ??
                                          (((material.quantity as number) || 0) * ((material.unit_cost as number) || 0))
                                      )}
                                    </TableCell>
                                    <TableCell className="text-right py-0.5">
                                      <div className="flex justify-end items-center gap-1">
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-green-700 hover:text-green-800"
                                          onClick={() => handleEditMaterial(material)}
                                          disabled={isLocked}
                                        >
                                          <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-6 w-6 text-red-600 hover:text-red-700"
                                          onClick={() => void handleDeleteMaterial(material.id as string)}
                                          disabled={isLocked}
                                        >
                                          <Trash2 className="h-3 w-3" />
                                        </Button>
                                      </div>
                                    </TableCell>
                                  </TableRow>
                                )
                              )}

                              {selectedScopeId === scope.id && !editingMaterial && (
                                <TableRow className="h-7 bg-muted/20 border-y border-primary/20">
                                  <TableCell className="py-1">
                                    <div className="flex flex-col gap-1">
                                      <Select value={materialForm.name} onValueChange={(val) => handleMaterialChange(val)}>
                                        <SelectTrigger className="h-6 text-xs">
                                          <SelectValue placeholder="Select material" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="custom">-- Custom Material --</SelectItem>
                                          {getSelectableScopeMaterials(scope).map((m) => (
                                            <SelectItem key={m.id} value={m.name}>
                                              {m.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {isManualMaterial && (
                                        <Input
                                          placeholder="Description"
                                          className="h-6 text-xs"
                                          value={materialForm.description}
                                          onChange={(e) => setMaterialForm({ ...materialForm, description: e.target.value })}
                                        />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    <Input
                                      placeholder="Qty"
                                      value={materialForm.quantity}
                                      onChange={(e) => setMaterialForm({ ...materialForm, quantity: e.target.value })}
                                      className="h-6 text-xs text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1">
                                    <div className="flex flex-col gap-1">
                                      <Select
                                        value={materialForm.unit_selection}
                                        onValueChange={(v) => setMaterialForm({ ...materialForm, unit: v === "Other" ? "" : v, unit_selection: v })}
                                      >
                                        <SelectTrigger className="h-6 text-xs">
                                          <SelectValue placeholder="Unit" />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {["Bag", "Bd.ft", "Box", "Cu.m", "Gal", "Kg", "Length", "Lin.m", "Liter", "Lot", "M", "Pail", "Pair", "Pc", "Roll", "Set", "Sq.m", "Unit", "Other"].map((u) => (
                                            <SelectItem key={u} value={u}>
                                              {u === "Other" ? "Others/Input" : u}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                      {materialForm.unit_selection === "Other" && (
                                        <Input
                                          placeholder="Unit"
                                          className="h-6 text-xs"
                                          value={materialForm.unit}
                                          onChange={(e) => setMaterialForm({ ...materialForm, unit: e.target.value })}
                                        />
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    <Input
                                      placeholder="Cost"
                                      value={materialForm.unit_cost}
                                      onChange={(e) => setMaterialForm({ ...materialForm, unit_cost: e.target.value })}
                                      className="h-6 text-xs text-right"
                                    />
                                  </TableCell>
                                  <TableCell className="py-1 text-right font-semibold text-sm">
                                    {formatCurrency((parseFloat(materialForm.quantity.replace(/,/g, "")) || 0) * (parseFloat(materialForm.unit_cost.replace(/,/g, "")) || 0))}
                                  </TableCell>
                                  <TableCell className="py-1 text-right">
                                    <div className="flex justify-end items-center gap-1">
                                      <Button
                                        size="sm"
                                        className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-xs"
                                        onClick={() => void handleMaterialSubmitInline()}
                                        disabled={isLocked}
                                      >
                                        Add
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-6 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
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
                              )}
                            </TableBody>
                          </Table>

                          {selectedScopeId !== scope.id && (
                            <div className="flex justify-end mt-1 pr-2">
                              <Button
                                size="sm"
                                className="bg-green-600 hover:bg-green-700 text-white h-6 text-xs"
                                disabled={isLocked}
                                onClick={() => {
                                  setSelectedScopeId(scope.id as string);
                                  resetMaterialForm();
                                }}
                              >
                                <Plus className="h-3 w-3 mr-1" />
                                Add Materials
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-xs text-muted-foreground italic mt-0.5 ml-1">
                          No materials added yet.
                          <div className="flex justify-start mt-1">
                            <Button
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white h-6 text-xs"
                              disabled={isLocked}
                              onClick={() => {
                                setSelectedScopeId(scope.id as string);
                                resetMaterialForm();
                              }}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Add Materials
                            </Button>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-between items-start pt-2 border-t mt-2">
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-3 mb-0.5">
                            <h3 className="font-semibold text-sm">Labor Cost</h3>
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-green-600 dark:border-green-500 text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950/30 h-6 text-[10px] px-2"
                              disabled={isLocked}
                              onClick={() => {
                                if (activeLaborScopeId === scope.id) {
                                  setActiveLaborScopeId(null);
                                  resetLaborForm();
                                } else {
                                  setActiveLaborScopeId(scope.id as string);
                                  if (scope.bom_labor && scope.bom_labor.length > 0) {
                                    handleEditLabor(scope.bom_labor[0] as Labor);
                                  } else {
                                    resetLaborForm();
                                  }
                                }
                              }}
                            >
                              <Pencil className="h-3 w-3 mr-1" />
                              {scope.bom_labor && scope.bom_labor.length > 0 ? "Edit Labor" : "Add Labor"}
                            </Button>
                          </div>

                          {activeLaborScopeId === scope.id ? (
                            <div className="mt-1">
                              <div className="flex flex-wrap items-center gap-2 md:gap-3">
                                <span className="text-[11px] font-medium">Method:</span>
                                <div className="inline-flex rounded-md border border-green-600 dark:border-green-500 bg-muted p-0.5">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      laborForm.calculation_method === "percentage" ? "default" : "ghost"
                                    }
                                    className={
                                      laborForm.calculation_method === "percentage"
                                        ? "bg-green-600 text-white hover:bg-green-700 h-6 text-xs"
                                        : "text-green-700 dark:text-green-400 hover:bg-transparent h-6 text-xs"
                                    }
                                    onClick={() =>
                                      setLaborForm((prev) => ({
                                        ...prev,
                                        calculation_method: "percentage"
                                      }))
                                    }
                                  >
                                    %
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                      laborForm.calculation_method === "unit_cost" ? "default" : "ghost"
                                    }
                                    className={
                                      laborForm.calculation_method === "unit_cost"
                                        ? "bg-green-600 text-white hover:bg-green-700 h-6 text-xs"
                                        : "text-green-700 dark:text-green-400 hover:bg-transparent h-6 text-xs"
                                    }
                                    onClick={() =>
                                      setLaborForm((prev) => ({
                                        ...prev,
                                        calculation_method: "unit_cost"
                                      }))
                                    }
                                  >
                                    Unit
                                  </Button>
                                </div>

                                {laborForm.calculation_method === "percentage" ? (
                                  <Input
                                    type="number"
                                    step="0.01"
                                    value={laborForm.percentage}
                                    onChange={(e) => setLaborForm({ ...laborForm, percentage: e.target.value })}
                                    placeholder="%"
                                    className="h-6 w-16 text-xs"
                                  />
                                ) : (
                                  <>
                                    <Input
                                      type="text"
                                      value={laborForm.hours}
                                      onChange={(e) => setLaborForm({ ...laborForm, hours: e.target.value.replace(/[^0-9.,]/g, "") })}
                                      onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val) {
                                          const num = parseFloat(val.replace(/,/g, ""));
                                          if (!isNaN(num)) {
                                            setLaborForm({ ...laborForm, hours: num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
                                          }
                                        }
                                      }}
                                      placeholder="Qty"
                                      className="h-6 w-24 text-xs"
                                    />
                                    <Select
                                      value={laborForm.unit_selection}
                                      onValueChange={(value) =>
                                        setLaborForm({
                                          ...laborForm,
                                          unit: value === "Other" ? "" : value,
                                          unit_selection: value
                                        })
                                      }
                                    >
                                      <SelectTrigger className="h-6 w-20 text-xs">
                                        <SelectValue placeholder="Unit" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        {["Cu.m", "Kg", "Lin.m", "Lot", "Sq.m", "Other"].map((unitOption) => (
                                          <SelectItem key={unitOption} value={unitOption} className="text-xs">
                                            {unitOption === "Other" ? "Other" : unitOption}
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {laborForm.unit_selection === "Other" && (
                                      <Input
                                        placeholder="Unit"
                                        value={laborForm.unit}
                                        onChange={(e) => setLaborForm({ ...laborForm, unit: e.target.value })}
                                        className="h-6 w-20 text-xs"
                                      />
                                    )}
                                    <Input
                                      type="text"
                                      value={laborForm.rate}
                                      onChange={(e) => setLaborForm({ ...laborForm, rate: e.target.value.replace(/[^0-9.,]/g, "") })}
                                      onBlur={(e) => {
                                        const val = e.target.value;
                                        if (val) {
                                          const num = parseFloat(val.replace(/,/g, ""));
                                          if (!isNaN(num)) {
                                            setLaborForm({ ...laborForm, rate: num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
                                          }
                                        }
                                      }}
                                      placeholder="$/u"
                                      className="h-6 w-32 text-xs"
                                    />
                                  </>
                                )}

                                <div className="flex items-center gap-1">
                                  <Button
                                    size="sm"
                                    className="bg-green-600 hover:bg-green-700 text-white h-6 px-2 text-xs"
                                    onClick={() => void handleLaborSubmit(scope.id as string)}
                                    disabled={isLocked}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-6 w-6 text-xs"
                                    onClick={() => {
                                      setActiveLaborScopeId(null);
                                      resetLaborForm();
                                    }}
                                    disabled={isLocked}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-1">
                              {scope.bom_labor && scope.bom_labor.length > 0 ? (
                                <div className="flex flex-wrap items-center gap-2 md:gap-3 text-muted-foreground">
                                  {(() => {
                                    const laborEntry = scope.bom_labor[0] as Labor;
                                    const desc = laborEntry.description || "";
                                    const percentageMatch = desc.match(/(\d+(\.\d+)?)\s*%/);
                                    const isPercentage = !!percentageMatch;
                                    const percentageValue = isPercentage && percentageMatch ? percentageMatch[1] : "";

                                    if (isPercentage) {
                                      return (
                                        <span className="text-[11px] font-semibold text-green-700">
                                          {percentageValue}% of Materials
                                        </span>
                                      );
                                    }

                                    return (
                                      <span className="text-[11px] font-semibold text-green-700">
                                        {formatNumber((laborEntry.hours as number) || 0)} {desc || "Units"} × {formatCurrency((laborEntry.hourly_rate as number) || 0)}
                                      </span>
                                    );
                                  })()}
                                </div>
                              ) : (
                                <div className="text-[11px] text-muted-foreground italic">
                                  No labor added yet.
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="text-right text-sm space-y-1 bg-muted/30 p-2 rounded-md min-w-[200px]">
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Materials:</span>
                            <span className="font-semibold text-foreground">
                              {formatCurrency(calculateScopeMaterialTotal(scope))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-muted-foreground">
                            <span>Labor:</span>
                            <span className="font-semibold text-foreground">
                              {formatCurrency(calculateScopeLaborTotal(scope))}
                            </span>
                          </div>
                          <div className="flex justify-between items-center pt-1 mt-1 border-t border-border/50">
                            <span className="font-semibold text-primary">Subtotal:</span>
                            <span className="font-bold text-primary">
                              {formatCurrency(calculateScopeDirectCost(scope))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  )}
                </Card>
              );
            })}

            {scopes.length > 0 &&
            <Card className="bg-primary/5">
                <CardContent className="pt-2">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold">Total Direct Cost</h2>
                    <div className="text-2xl font-bold text-primary">
                      {formatCurrency(calculateTotalDirectCost())}
                    </div>
                  </div>
                </CardContent>
              </Card>
            }

            {scopes.length > 0 && (
              <Card className="mt-2">
                <CardHeader className={indirectCollapsed ? "py-1 px-4 flex flex-row items-center justify-between space-y-0" : "pt-2 px-6 pb-1 flex flex-row items-center justify-between space-y-0"}>
                  <CardTitle className="text-lg mt-0">Indirect Costs</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setIndirectCollapsed(!indirectCollapsed)}
                  >
                    {indirectCollapsed ? "Show content" : "Hide content"}
                  </Button>
                </CardHeader>
                {!indirectCollapsed && (
                <CardContent className="space-y-1.5">
                  <Table>
                    <TableHeader>
                      <TableRow className="h-7 text-xs hover:bg-transparent border-b">
                        <TableHead className="h-6 py-0.5 text-[10px]">Type</TableHead>
                        <TableHead className="text-right h-6 py-0.5 text-[10px]">Value</TableHead>
                        <TableHead className="text-right h-6 py-0.5 text-[10px]">Amount</TableHead>
                        <TableHead className="text-right h-6 py-0.5 w-24"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {indirectCostsList.map((cost) => (
                        <TableRow key={cost.id} className="h-7">
                          <TableCell className="py-0.5 font-medium text-sm">{cost.type}</TableCell>
                          <TableCell className="text-right py-0.5 text-sm">
                            {cost.type !== 'Others' ? `${cost.value}%` : formatCurrency(parseFloat(cost.value.replace(/,/g, "") || "0"))}
                          </TableCell>
                          <TableCell className="text-right font-semibold py-0.5 text-sm text-muted-foreground">
                            {formatCurrency(
                              ['VAT', 'OCM', 'Profit', 'Tax'].includes(cost.type)
                              ? calculateTotalDirectCost() * (parseFloat(cost.value.replace(/,/g, "") || "0") / 100)
                              : parseFloat(cost.value.replace(/,/g, "") || "0")
                            )}
                          </TableCell>
                          <TableCell className="text-right py-0.5">
                            <div className="flex justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:text-green-700" onClick={() => handleEditIndirect(cost)} disabled={isLocked}>
                                <Pencil className="w-3 h-3" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:text-red-700" onClick={() => void handleDeleteIndirect(cost.id)} disabled={isLocked}>
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}

                      <TableRow className="h-7 bg-muted/20">
                        <TableCell className="py-0.5">
                          <Select value={indirectRowForm.type} onValueChange={(val) => setIndirectRowForm({...indirectRowForm, type: val, description: val !== 'Others' ? '' : indirectRowForm.description})}>
                            <SelectTrigger className="h-6 text-xs"><SelectValue/></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="VAT">VAT</SelectItem>
                              <SelectItem value="Tax">Tax</SelectItem>
                              <SelectItem value="OCM">OCM</SelectItem>
                              <SelectItem value="Profit">Profit</SelectItem>
                              <SelectItem value="Others">Others/Input</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="py-0.5 text-right">
                          <Input 
                            className="h-6 text-xs text-right w-full"
                            placeholder={indirectRowForm.type !== 'Others' ? '%' : 'Amount'}
                            value={indirectRowForm.value}
                            onChange={e => setIndirectRowForm({...indirectRowForm, value: e.target.value.replace(/[^0-9.,]/g, '')})}
                            onBlur={e => {
                                const val = e.target.value;
                                if (val) {
                                  const num = parseFloat(val.replace(/,/g, ""));
                                  if (!isNaN(num)) {
                                    setIndirectRowForm({ ...indirectRowForm, value: num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) });
                                  }
                                }
                            }}
                          />
                        </TableCell>
                        <TableCell className="text-right font-semibold py-0.5 text-sm text-muted-foreground">
                            {formatCurrency(
                              ['VAT', 'OCM', 'Profit', 'Tax'].includes(indirectRowForm.type)
                              ? calculateTotalDirectCost() * (parseFloat(indirectRowForm.value.replace(/,/g, "") || "0") / 100)
                              : parseFloat(indirectRowForm.value.replace(/,/g, "") || "0")
                            )}
                        </TableCell>
                        <TableCell className="text-right py-0.5">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" className="h-6 px-2 text-xs bg-green-600 hover:bg-green-700 text-white" onClick={() => void handleAddOrUpdateIndirect()} disabled={isLocked}>
                                {indirectRowForm.id ? 'Update' : 'Add'}
                            </Button>
                            {indirectRowForm.id && (
                                <Button size="sm" variant="outline" className="h-6 px-2 text-xs border-red-600 dark:border-red-500 text-red-700 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => setIndirectRowForm({id: '', type: 'VAT', description: '', value: ''})} disabled={isLocked}>Cancel</Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    </TableBody>
                  </Table>

                  <div className="pt-2 border-t">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-base font-semibold">Total Indirect Cost:</span>
                      <span className="text-xl font-bold">
                        {formatCurrency(calculateIndirectCost())}
                      </span>
                    </div>
                  </div>
                </CardContent>
                )}
              </Card>
            )}
          </>
        )}

        {scopes.length > 0 && (
          <Card className="bg-primary text-primary-foreground mt-2">
            <CardContent className="pt-2">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold">Grand Total</h2>
                <div className="text-2xl font-bold">
                  {formatCurrency(calculateGrandTotal())}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}