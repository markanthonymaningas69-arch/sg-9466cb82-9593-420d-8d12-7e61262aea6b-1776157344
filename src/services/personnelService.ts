import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Personnel = Database["public"]["Tables"]["personnel"]["Row"];
type PersonnelInsert = Database["public"]["Tables"]["personnel"]["Insert"];
type Attendance = Database["public"]["Tables"]["attendance"]["Row"];
type AttendanceInsert = Database["public"]["Tables"]["attendance"]["Insert"];
type LeaveRequest = Database["public"]["Tables"]["leave_requests"]["Row"];
type LeaveRequestInsert = Database["public"]["Tables"]["leave_requests"]["Insert"];
type Payroll = Database["public"]["Tables"]["payroll"]["Row"];
type PayrollInsert = Database["public"]["Tables"]["payroll"]["Insert"];
type Visa = Database["public"]["Tables"]["personnel_visas"]["Row"];
type VisaInsert = Database["public"]["Tables"]["personnel_visas"]["Insert"];

export const personnelService = {
  // Personnel CRUD
  async getAll() {
    const { data, error } = await supabase
      .from("personnel")
      .select("*, projects(name)")
      .order("created_at", { ascending: false });
    
    console.log("Personnel query:", { data, error });
    return { data: data || [], error };
  },

  async getByProject(projectId: string) {
    const { data, error } = await supabase
      .from("personnel")
      .select("*")
      .eq("project_id", projectId);
    
    console.log("Personnel by project:", { data, error });
    return { data: data || [], error };
  },

  async create(personnel: PersonnelInsert) {
    const { data, error } = await supabase
      .from("personnel")
      .insert({ ...personnel, created_source: 'Human Resources', updated_source: 'Human Resources' })
      .select()
      .single();
    
    console.log("Create personnel:", { data, error });
    return { data, error };
  },

  async update(id: string, updates: Partial<PersonnelInsert>) {
    const { data, error } = await supabase
      .from("personnel")
      .update({ ...updates, updated_source: 'Human Resources' })
      .eq("id", id)
      .select()
      .single();
    
    console.log("Update personnel:", { data, error });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("personnel")
      .delete()
      .eq("id", id);
    
    console.log("Delete personnel:", { error });
    return { error };
  },

  // Attendance Management
  async getAttendance(startDate: string, endDate: string) {
    const { data, error } = await supabase
      .from("site_attendance")
      .select("*, personnel(name, role, worker_type)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });
    
    return { data: data || [], error };
  },

  async markAttendance(attendance: any) {
    const { data, error } = await supabase
      .from("site_attendance")
      .upsert(attendance)
      .select()
      .single();
    
    return { data, error };
  },

  async updateAttendance(id: string, updates: any) {
    const { data, error } = await supabase
      .from("site_attendance")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  // Leave Management
  async getLeaveRequests() {
    const { data, error } = await supabase
      .from("leave_requests")
      .select("*, personnel(name, role, worker_type)")
      .order("created_at", { ascending: false });
    
    return { data: data || [], error };
  },

  async createLeaveRequest(leave: LeaveRequestInsert) {
    const { data, error } = await supabase
      .from("leave_requests")
      .insert(leave)
      .select()
      .single();
    
    return { data, error };
  },

  async updateLeaveStatus(id: string, status: string, notes?: string) {
    const { data, error } = await supabase
      .from("leave_requests")
      .update({ status, notes })
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  async deleteLeaveRequest(id: string) {
    const { error } = await supabase
      .from("leave_requests")
      .delete()
      .eq("id", id);
    
    return { error };
  },

  // Payroll Management
  async getPayroll(periodStart: string) {
    const { data, error } = await supabase
      .from("payroll")
      .select("*, personnel(name, role, hourly_rate, worker_type)")
      .eq("pay_period_start", periodStart)
      .order("created_at", { ascending: false });
    
    return { data: data || [], error };
  },

  async generatePayroll(payroll: PayrollInsert) {
    const { data, error } = await supabase
      .from("payroll")
      .insert(payroll)
      .select()
      .single();
    
    return { data, error };
  },

  async updatePayrollStatus(id: string, status: string) {
    const { data, error } = await supabase
      .from("payroll")
      .update({ status })
      .eq("id", id)
      .select()
      .single();
    
    return { data, error };
  },

  // Visa Records
  async getVisas(personnelId?: string) {
    let query = supabase
      .from("personnel_visas")
      .select("*, personnel(name, role, worker_type)")
      .order("expiry_date", { ascending: true });
    
    if (personnelId) {
      query = query.eq("personnel_id", personnelId);
    }
    
    const { data, error } = await query;
    return { data: data || [], error };
  },

  async addVisa(visa: VisaInsert) {
    const { data, error } = await supabase
      .from("personnel_visas")
      .insert(visa)
      .select()
      .single();
    
    return { data, error };
  }
};