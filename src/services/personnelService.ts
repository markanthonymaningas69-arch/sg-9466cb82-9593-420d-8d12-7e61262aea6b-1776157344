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
type TrainingRecord = Database["public"]["Tables"]["training_records"]["Row"];
type TrainingRecordInsert = Database["public"]["Tables"]["training_records"]["Insert"];

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
      .insert(personnel)
      .select()
      .single();
    
    console.log("Create personnel:", { data, error });
    return { data, error };
  },

  async update(id: string, updates: Partial<PersonnelInsert>) {
    const { data, error } = await supabase
      .from("personnel")
      .update(updates)
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
      .from("attendance")
      .select("*, personnel(name, role)")
      .gte("date", startDate)
      .lte("date", endDate)
      .order("date", { ascending: false });
    
    return { data: data || [], error };
  },

  async markAttendance(attendance: AttendanceInsert) {
    const { data, error } = await supabase
      .from("attendance")
      .insert(attendance)
      .select()
      .single();
    
    return { data, error };
  },

  async updateAttendance(id: string, updates: Partial<AttendanceInsert>) {
    const { data, error } = await supabase
      .from("attendance")
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
      .select("*, personnel(name, role)")
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

  // Payroll Management
  async getPayroll(month: string) {
    const { data, error } = await supabase
      .from("payroll")
      .select("*, personnel(name, role, hourly_rate)")
      .eq("month", month)
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

  // Training Records
  async getTrainingRecords(personnelId?: string) {
    let query = supabase
      .from("training_records")
      .select("*, personnel(name, role)")
      .order("completed_date", { ascending: false });
    
    if (personnelId) {
      query = query.eq("personnel_id", personnelId);
    }
    
    const { data, error } = await query;
    return { data: data || [], error };
  },

  async addTrainingRecord(training: TrainingRecordInsert) {
    const { data, error } = await supabase
      .from("training_records")
      .insert(training)
      .select()
      .single();
    
    return { data, error };
  }
};