import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SiteAttendance = Database["public"]["Tables"]["site_attendance"]["Row"];
type SiteAttendanceInsert = Database["public"]["Tables"]["site_attendance"]["Insert"];
type Delivery = Database["public"]["Tables"]["deliveries"]["Row"] & { receipt_number?: string };
type DeliveryInsert = Database["public"]["Tables"]["deliveries"]["Insert"] & { receipt_number?: string };
type ScopeOfWork = Database["public"]["Tables"]["bom_scope_of_work"]["Row"];
type ScopeOfWorkInsert = Database["public"]["Tables"]["bom_scope_of_work"]["Insert"];
type ProgressUpdate = Database["public"]["Tables"]["progress_updates"]["Row"];
type ProgressUpdateInsert = Database["public"]["Tables"]["progress_updates"]["Insert"];

export const siteService = {
  // Site Attendance Management
  async getProjectPersonnel(projectId: string) {
    const { data, error } = await supabase
      .from("personnel")
      .select("*")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("name");
    return { data: data || [], error };
  },

  async enrollPersonnel(personnel: any) {
    const { data, error } = await supabase
      .from("personnel")
      .insert({ ...personnel, created_source: 'Site Personnel', updated_source: 'Site Personnel' })
      .select()
      .single();
    return { data, error };
  },

  async updatePersonnel(id: string, updates: any) {
    const { data, error } = await supabase
      .from("personnel")
      .update({ ...updates, updated_source: 'Site Personnel' })
      .eq("id", id)
      .select()
      .single();
    return { data, error };
  },

  async deletePersonnel(id: string) {
    const { error } = await supabase
      .from("personnel")
      .update({ is_archived: true } as any)
      .eq("id", id);
    return { error };
  },

  async upsertAttendance(attendance: any) {
    const { data, error } = await supabase
      .from("site_attendance")
      .upsert(attendance, { onConflict: 'project_id, personnel_id, date' })
      .select()
      .single();
    return { data, error };
  },

  async getSiteAttendance(projectId: string, date?: string) {
    let query = supabase
      .from("site_attendance")
      .select("*, personnel(name, role, daily_rate, overtime_rate), projects(name)")
      .eq("project_id", projectId)
      .order("date", { ascending: false });
    
    if (date) {
      query = query.eq("date", date);
    }
    
    const { data, error } = await query;
    return { data: data || [], error };
  },

  async markAttendance(attendance: SiteAttendanceInsert) {
    const { data, error } = await supabase
      .from("site_attendance")
      .insert(attendance)
      .select()
      .single();
    
    return { data, error };
  },

  async updateAttendance(id: string, updates: Partial<SiteAttendanceInsert>) {
    const { data, error } = await supabase
      .from("site_attendance")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteAttendance(id: string) {
    const { error } = await supabase
      .from("site_attendance")
      .delete()
      .eq("id", id);
    
    return { error };
  },

  // Deliveries Management
  async getDeliveries(projectId: string, dateFilter?: string) {
    let query = supabase
      .from("deliveries")
      .select("*, projects(name)")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("delivery_date", { ascending: false });
      
    if (dateFilter) {
      query = query.eq("delivery_date", dateFilter);
    }
    
    const { data, error } = await query;
    return { data: data || [], error };
  },

  async createDelivery(delivery: DeliveryInsert) {
    const { data, error } = await supabase
      .from("deliveries")
      .insert(delivery)
      .select()
      .single();
    
    return { data, error };
  },

  async updateDelivery(id: string, updates: Partial<DeliveryInsert>) {
    const { data, error } = await supabase
      .from("deliveries")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteDelivery(id: string) {
    const { error } = await supabase
      .from("deliveries")
      .update({ is_archived: true } as any)
      .eq("id", id);
    
    return { error };
  },

  // Material Consumption
  async getMaterialConsumption(projectId: string, dateFilter?: string) {
    let query = supabase
      .from("material_consumption")
      .select("*, bom_scope_of_work(name)")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("date_used", { ascending: false });
      
    if (dateFilter) {
      query = query.eq("date_used", dateFilter);
    }
    
    const { data, error } = await query;
    return { data: data || [], error };
  },

  async createMaterialConsumption(record: any) {
    const { data, error } = await supabase
      .from("material_consumption")
      .insert(record)
      .select()
      .single();
    
    return { data, error };
  },

  async updateMaterialConsumption(id: string, updates: any) {
    const { data, error } = await supabase
      .from("material_consumption")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteMaterialConsumption(id: string) {
    const { error } = await supabase
      .from("material_consumption")
      .update({ is_archived: true } as any)
      .eq("id", id);
    
    return { error };
  },

  async getBomMaterials(projectId: string) {
    const { data: bom } = await supabase
      .from("bill_of_materials")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();
      
    if (!bom) return { data: [], error: null };

    const { data: scopes } = await supabase
      .from("bom_scope_of_work")
      .select("id")
      .eq("bom_id", bom.id);
      
    if (!scopes || scopes.length === 0) return { data: [], error: null };
    
    const scopeIds = scopes.map(s => s.id);

    const { data, error } = await supabase
      .from("bom_materials")
      .select("id, material_name, unit, scope_id")
      .in("scope_id", scopeIds)
      .order("material_name", { ascending: true });
    
    const formattedData = data?.map(m => ({
      id: m.id,
      name: m.material_name || "Unknown Material",
      unit: m.unit || "",
      scope_id: m.scope_id
    })) || [];
    
    return { data: formattedData as any, error };
  },

  // Scope of Works Management
  async getScopeOfWorks(projectId: string) {
    const { data: bom } = await supabase
      .from("bill_of_materials")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();
      
    if (!bom) return { data: [], error: null };

    const { data, error } = await supabase
      .from("bom_scope_of_work")
      .select("*")
      .eq("bom_id", bom.id)
      .order("order_number", { ascending: true });
    
    return { data: data || [], error };
  },

  async createScopeOfWork(scope: any) {
    return { data: null, error: null };
  },

  async updateScopeOfWork(id: string, updates: any) {
    const { data, error } = await supabase
      .from("bom_scope_of_work")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteScopeOfWork(id: string) {
    return { error: null };
  },

  // Progress Updates Management
  async getProgressUpdates(scopeId: string) {
    const { data, error } = await supabase
      .from("bom_progress_updates")
      .select("*, bom_scope_of_work(name)")
      .eq("bom_scope_id", scopeId)
      .order("update_date", { ascending: false });
    
    return { data: data || [], error };
  },

  async createProgressUpdate(update: any) {
    const { data, error } = await supabase
      .from("bom_progress_updates")
      .insert(update)
      .select()
      .single();
    
    if (data && update.bom_scope_id && update.percentage_completed !== undefined) {
      let status = 'in_progress';
      if (update.percentage_completed >= 100) status = 'completed';
      if (update.percentage_completed <= 0) status = 'not_started';

      await supabase
        .from("bom_scope_of_work")
        .update({ 
          completion_percentage: update.percentage_completed,
          status: status
        } as any)
        .eq("id", update.bom_scope_id);
    }
    
    return { data, error };
  },

  async updateProgressUpdate(id: string, updates: any) {
    const { data, error } = await supabase
      .from("bom_progress_updates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteProgressUpdate(id: string) {
    const { error } = await supabase
      .from("bom_progress_updates")
      .delete()
      .eq("id", id);
    
    return { error };
  },

  // Cash Advances
  async getCashAdvances(projectId: string) {
    const { data, error } = await supabase
      .from("cash_advance_requests")
      .select("*, personnel(name, role)")
      .eq("project_id", projectId)
      .eq("is_archived", false)
      .order("request_date", { ascending: false });
    return { data: data || [], error };
  },

  async createCashAdvance(record: any) {
    const { data, error } = await supabase
      .from("cash_advance_requests")
      .insert(record)
      .select()
      .single();
    return { data, error };
  },

  async updateCashAdvance(id: string, updates: any) {
    const { data, error } = await supabase
      .from("cash_advance_requests")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    return { data, error };
  },

  async deleteCashAdvance(id: string) {
    const { error } = await supabase
      .from("cash_advance_requests")
      .update({ is_archived: true } as any)
      .eq("id", id);
    return { error };
  }
};