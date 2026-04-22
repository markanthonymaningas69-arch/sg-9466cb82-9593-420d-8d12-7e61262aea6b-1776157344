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

  // AI Generation Preview
  async fetchAIPreview(scopeName: string, quantity: number, unit: string, description: string) {
    try {
      const response = await fetch('/api/ai/generate-bom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeName, description, quantity, unit })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate materials');
      }

      const data = await response.json();
      let materials = data.materials || data.items || data;
      
      if (typeof materials === 'string') {
        try { materials = JSON.parse(materials); } catch (e) {}
      }
      
      if (!Array.isArray(materials)) {
        if (typeof materials === 'object' && materials !== null) {
          const arr = Object.values(materials).find(Array.isArray);
          materials = arr || [];
        } else {
          materials = [];
        }
      }

      return { success: true, materials };
    } catch (error) {
      console.error('AI Fetch Error:', error);
      return { error: error instanceof Error ? error.message : 'An error occurred' };
    }
  },

  // Save AI Generated Materials
  async saveAIGeneratedMaterials(scopeId: string, scopeName: string, materials: any[]) {
    try {
      const { data: profile } = await supabase.from('profiles').select('company_id').single();
      const companyId = profile?.company_id;
      
      const { data: masterItems } = await supabase.from('master_items').select('*');
      const existingMasters = masterItems || [];
      const generatedMaterialsData = [];
      
      for (const mat of materials) {
        const matName = mat.name || mat.material_name || "Unknown Material";
        const matCategory = mat.category || "Construction Materials";
        const matUnit = mat.unit || "Lot";
        const matQty = Number(mat.quantity) || 1;
        // Bulletproof cost capturing regardless of AI's property name choices
        const matCost = Number(mat.unit_cost) || Number(mat.price) || Number(mat.cost) || Number(mat.unit_price) || 0;

        let masterId = null;
        const match = existingMasters.find(m => m.name.toLowerCase() === matName.toLowerCase());
        
        if (match) {
          masterId = match.id;
          const associated = match.associated_scopes || [];
          if (Array.isArray(associated) && !associated.includes(scopeName)) {
            await supabase.from('master_items').update({
              associated_scopes: [...associated, scopeName]
            }).eq('id', masterId);
          }
        } else {
          const { data: newMaster, error: masterError } = await supabase.from('master_items').insert({
            name: matName,
            category: matCategory,
            unit: matUnit,
            default_cost: matCost,
            associated_scopes: [scopeName],
            ...(companyId ? { company_id: companyId } : {})
          }).select().single();
          
          if (masterError) {
            console.error("Master Catalog Insert Error:", masterError);
          } else if (newMaster) {
            masterId = newMaster.id;
            existingMasters.push(newMaster);
          }
        }

        // Strictly format the payload to ONLY include schema-verified columns.
        // We explicitly omit 'total_cost' so the database auto-calculates it natively.
        generatedMaterialsData.push({
          scope_id: scopeId,
          material_name: matName,
          description: matName,
          quantity: matQty,
          unit: matUnit,
          unit_cost: matCost,
          ...(companyId ? { company_id: companyId } : {})
        });
      }

      if (generatedMaterialsData.length > 0) {
        const { error: insertError } = await supabase.from('bom_materials').insert(generatedMaterialsData);
        if (insertError) {
          console.error("BOM Materials Insert Error:", insertError);
          throw new Error(insertError.message || "Failed to insert materials into database.");
        }
      }

      cacheManager.invalidatePattern('BOMSummary');
      return { success: true, count: generatedMaterialsData.length };
    } catch (error: any) {
      console.error('Error saving generated materials:', error);
      return { error: error.message || 'An error occurred while saving' };
    }
  }
};