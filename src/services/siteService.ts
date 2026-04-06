import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SiteAttendance = Database["public"]["Tables"]["site_attendance"]["Row"];
type SiteAttendanceInsert = Database["public"]["Tables"]["site_attendance"]["Insert"];
type Delivery = Database["public"]["Tables"]["deliveries"]["Row"];
type DeliveryInsert = Database["public"]["Tables"]["deliveries"]["Insert"];
type ScopeOfWork = Database["public"]["Tables"]["scope_of_works"]["Row"];
type ScopeOfWorkInsert = Database["public"]["Tables"]["scope_of_works"]["Insert"];
type ProgressUpdate = Database["public"]["Tables"]["progress_updates"]["Row"];
type ProgressUpdateInsert = Database["public"]["Tables"]["progress_updates"]["Insert"];

export const siteService = {
  // Site Attendance Management
  async getSiteAttendance(projectId: string, date?: string) {
    let query = supabase
      .from("site_attendance")
      .select("*, personnel(name, role), projects(name)")
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
  async getDeliveries(projectId: string) {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*, projects(name)")
      .eq("project_id", projectId)
      .order("delivery_date", { ascending: false });
    
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
      .delete()
      .eq("id", id);
    
    return { error };
  },

  // Scope of Works Management
  async getScopeOfWorks(projectId: string) {
    const { data, error } = await supabase
      .from("scope_of_works")
      .select("*")
      .eq("project_id", projectId)
      .order("order_number", { ascending: true });
    
    return { data: data || [], error };
  },

  async createScopeOfWork(scope: ScopeOfWorkInsert) {
    const { data, error } = await supabase
      .from("scope_of_works")
      .insert(scope)
      .select()
      .single();
    
    return { data, error };
  },

  async updateScopeOfWork(id: string, updates: Partial<ScopeOfWorkInsert>) {
    const { data, error } = await supabase
      .from("scope_of_works")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteScopeOfWork(id: string) {
    const { error } = await supabase
      .from("scope_of_works")
      .delete()
      .eq("id", id);
    
    return { error };
  },

  // Progress Updates Management
  async getProgressUpdates(scopeId: string) {
    const { data, error } = await supabase
      .from("progress_updates")
      .select("*, scope_of_works(description)")
      .eq("scope_id", scopeId)
      .order("update_date", { ascending: false });
    
    return { data: data || [], error };
  },

  async createProgressUpdate(update: ProgressUpdateInsert) {
    const { data, error } = await supabase
      .from("progress_updates")
      .insert(update)
      .select()
      .single();
    
    return { data, error };
  },

  async updateProgressUpdate(id: string, updates: Partial<ProgressUpdateInsert>) {
    const { data, error } = await supabase
      .from("progress_updates")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteProgressUpdate(id: string) {
    const { error } = await supabase
      .from("progress_updates")
      .delete()
      .eq("id", id);
    
    return { error };
  }
};