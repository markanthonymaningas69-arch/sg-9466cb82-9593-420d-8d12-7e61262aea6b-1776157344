import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { cacheManager, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

type BOM = Database["public"]["Tables"]["bill_of_materials"]["Row"];
type ScopeOfWork = Database["public"]["Tables"]["bom_scope_of_work"]["Row"];
type Material = Database["public"]["Tables"]["bom_materials"]["Row"];
type Labor = Database["public"]["Tables"]["bom_labor"]["Row"];
type IndirectCost = Database["public"]["Tables"]["bom_indirect_costs"]["Row"];

export const bomService = {
  // Get BOM with all related data
  async getByProjectId(projectId: string) {
    const cacheKey = CACHE_KEYS.bomSummary(projectId);
    const cached = cacheManager.get<any>(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from("bill_of_materials")
      .select(`
        *,
        bom_scope_of_work(*),
        bom_indirect_costs(*)
      `)
      .eq("project_id", projectId)
      .single();

    if (error) {
      console.log("BOM Query Error:", error);
      return { data, error };
    }

    // If we have scopes, fetch their materials and labor separately
    if (data && data.bom_scope_of_work) {
      const scopeIds = data.bom_scope_of_work.map((s: any) => s.id);
      
      // Fetch materials for all scopes
      const { data: materials } = await supabase
        .from("bom_materials")
        .select("*")
        .in("scope_id", scopeIds);
      
      // Fetch labor for all scopes
      const { data: labor } = await supabase
        .from("bom_labor")
        .select("*")
        .in("scope_id", scopeIds);
      
      // Attach materials and labor to their respective scopes
      data.bom_scope_of_work = data.bom_scope_of_work.map((scope: any) => ({
        ...scope,
        bom_materials: materials?.filter((m: any) => m.scope_id === scope.id) || [],
        bom_labor: labor?.filter((l: any) => l.scope_id === scope.id) || []
      }));
    }

    console.log("BOM Query:", { data, error });
    const result = { data, error };
    if (!error) cacheManager.set(cacheKey, result, CACHE_TTL.DASHBOARD);
    return result;
  },

  // Create BOM
  async create(bomData: Database["public"]["Tables"]["bill_of_materials"]["Insert"]) {
    const { data, error } = await supabase
      .from("bill_of_materials")
      .insert(bomData)
      .select()
      .single();

    if (bomData.project_id) cacheManager.invalidate(CACHE_KEYS.bomSummary(bomData.project_id));
    console.log("Create BOM:", { data, error });
    return { data, error };
  },

  // Get Master Scopes
  async getMasterScopes() {
    const { data, error } = await supabase
      .from("master_scopes")
      .select("*")
      .order("name");
    return { data, error };
  },

  // Update BOM
  async update(id: string, bomData: Database["public"]["Tables"]["bill_of_materials"]["Update"]) {
    const { data, error } = await supabase
      .from("bill_of_materials")
      .update(bomData)
      .eq("id", id)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    console.log("Update BOM:", { data, error });
    return { data, error };
  },

  // Scope of Work operations
  async createScope(scopeData: Database["public"]["Tables"]["bom_scope_of_work"]["Insert"]) {
    const { data, error } = await supabase
      .from("bom_scope_of_work")
      .insert(scopeData)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    console.log("Create Scope:", { data, error });
    return { data, error };
  },

  async updateScope(id: string, scopeData: Database["public"]["Tables"]["bom_scope_of_work"]["Update"]) {
    const { data, error } = await supabase
      .from("bom_scope_of_work")
      .update(scopeData)
      .eq("id", id)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    return { data, error };
  },

  async updateScopeOrder(updates: { id: string, order_number: number }[]) {
    const promises = updates.map(u => 
      supabase.from("bom_scope_of_work").update({ order_number: u.order_number }).eq("id", u.id)
    );
    const results = await Promise.all(promises);
    const error = results.find(r => r.error)?.error;
    
    cacheManager.invalidatePattern("BOMSummary");
    return { error };
  },

  async deleteScope(id: string) {
    const { error } = await supabase
      .from("bom_scope_of_work")
      .delete()
      .eq("id", id);

    cacheManager.invalidatePattern("BOMSummary");
    return { error };
  },

  // Material operations
  async createMaterial(materialData: Database["public"]["Tables"]["bom_materials"]["Insert"]) {
    const { data, error } = await supabase
      .from("bom_materials")
      .insert(materialData)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    cacheManager.invalidatePattern("CompanyDashboard");
    return { data, error };
  },

  async updateMaterial(id: string, materialData: Database["public"]["Tables"]["bom_materials"]["Update"]) {
    const { data, error } = await supabase
      .from("bom_materials")
      .update(materialData)
      .eq("id", id)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    cacheManager.invalidatePattern("CompanyDashboard");
    return { data, error };
  },

  async deleteMaterial(id: string) {
    const { error } = await supabase
      .from("bom_materials")
      .delete()
      .eq("id", id);

    cacheManager.invalidatePattern("BOMSummary");
    cacheManager.invalidatePattern("CompanyDashboard");
    return { error };
  },

  // Labor operations
  async createLabor(laborData: Database["public"]["Tables"]["bom_labor"]["Insert"]) {
    const { data, error } = await supabase
      .from("bom_labor")
      .insert(laborData)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    cacheManager.invalidatePattern("CompanyDashboard");
    return { data, error };
  },

  async updateLabor(id: string, laborData: Database["public"]["Tables"]["bom_labor"]["Update"]) {
    const { data, error } = await supabase
      .from("bom_labor")
      .update(laborData)
      .eq("id", id)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    cacheManager.invalidatePattern("CompanyDashboard");
    return { data, error };
  },

  async deleteLabor(id: string) {
    const { error } = await supabase
      .from("bom_labor")
      .delete()
      .eq("id", id);

    cacheManager.invalidatePattern("BOMSummary");
    cacheManager.invalidatePattern("CompanyDashboard");
    return { error };
  },

  // Indirect cost operations
  async createIndirectCost(costData: Database["public"]["Tables"]["bom_indirect_costs"]["Insert"]) {
    const { data, error } = await supabase
      .from("bom_indirect_costs")
      .insert(costData)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    return { data, error };
  },

  async updateIndirectCost(id: string, costData: Database["public"]["Tables"]["bom_indirect_costs"]["Update"]) {
    const { data, error } = await supabase
      .from("bom_indirect_costs")
      .update(costData)
      .eq("id", id)
      .select()
      .single();

    cacheManager.invalidatePattern("BOMSummary");
    return { data, error };
  },

  // AI Generation
  async generateMaterialsWithAI(scopeId: string, scopeName: string, quantity: number, unit: string, description: string) {
    try {
      // 1. Call AI Endpoint
      const response = await fetch('/api/ai/generate-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeName, description, quantity, unit })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate materials");
      }

      const { materials } = await response.json();
      
      // 2. Fetch existing master items
      const { data: masterItems } = await supabase.from("master_items").select("*");
      const existingMasters = masterItems || [];

      // 3. Process each generated material
      const generatedMaterialsData = [];
      
      for (const mat of materials) {
        let masterId = null;
        
        // Find existing match by name
        const match = existingMasters.find(m => m.name.toLowerCase() === mat.name.toLowerCase());
        
        if (match) {
          masterId = match.id;
          // Optionally link scope to master item if not already linked
          const associated = match.associated_scopes || [];
          if (Array.isArray(associated) && !associated.includes(scopeName)) {
            await supabase.from("master_items").update({
              associated_scopes: [...associated, scopeName]
            }).eq("id", masterId);
          }
        } else {
          // Create new master item
          const { data: newMaster } = await supabase.from("master_items").insert({
            name: mat.name,
            category: mat.category || "Construction Materials",
            unit: mat.unit || "Other",
            default_cost: mat.unit_cost || 0,
            associated_scopes: [scopeName]
          }).select().single();
          
          if (newMaster) {
            masterId = newMaster.id;
            existingMasters.push(newMaster); // add to local cache for subsequent loop iterations
          }
        }

        // Prepare BOM material record
        generatedMaterialsData.push({
          scope_id: scopeId,
          material_name: mat.name,
          description: mat.name,
          quantity: mat.quantity,
          unit: mat.unit,
          unit_cost: mat.unit_cost,
          total_cost: (mat.quantity * mat.unit_cost)
        });
      }

      // 4. Insert generated materials into the BOM
      if (generatedMaterialsData.length > 0) {
        const { error: insertError } = await supabase.from("bom_materials").insert(generatedMaterialsData);
        if (insertError) throw insertError;
      }

      cacheManager.invalidatePattern("BOMSummary");
      return { success: true, count: generatedMaterialsData.length };
    } catch (error) {
      console.error("Error generating materials with AI:", error);
      return { error: error instanceof Error ? error.message : "An error occurred" };
    }
  }
};