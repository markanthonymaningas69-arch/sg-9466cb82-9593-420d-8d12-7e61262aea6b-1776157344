/* eslint-disable @typescript-eslint/no-empty-object-type */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      accounting_transactions: {
        Row: {
          account_name: string
          amount: number
          category: string
          created_at: string | null
          date: string
          description: string
          id: string
          project_id: string | null
          tax_amount: number | null
          type: string
        }
        Insert: {
          account_name: string
          amount: number
          category: string
          created_at?: string | null
          date: string
          description: string
          id?: string
          project_id?: string | null
          tax_amount?: number | null
          type: string
        }
        Update: {
          account_name?: string
          amount?: number
          category?: string
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          project_id?: string | null
          tax_amount?: number | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "accounting_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string | null
          date: string
          hours_worked: number | null
          id: string
          notes: string | null
          overtime_hours: number | null
          personnel_id: string
          status: string
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          date: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          personnel_id: string
          status: string
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string | null
          date?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          personnel_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          bom_number: string
          created_at: string | null
          description: string | null
          grand_total: number | null
          id: string
          project_id: string
          revision: string | null
          status: string
          title: string
          total_direct_cost: number | null
          total_indirect_cost: number | null
          updated_at: string | null
        }
        Insert: {
          bom_number: string
          created_at?: string | null
          description?: string | null
          grand_total?: number | null
          id?: string
          project_id: string
          revision?: string | null
          status?: string
          title: string
          total_direct_cost?: number | null
          total_indirect_cost?: number | null
          updated_at?: string | null
        }
        Update: {
          bom_number?: string
          created_at?: string | null
          description?: string | null
          grand_total?: number | null
          id?: string
          project_id?: string
          revision?: string | null
          status?: string
          title?: string
          total_direct_cost?: number | null
          total_indirect_cost?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bill_of_materials_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_indirect_costs: {
        Row: {
          bom_id: string
          created_at: string | null
          id: string
          ocm_amount: number | null
          ocm_percentage: number | null
          other_costs: Json | null
          profit_amount: number | null
          profit_percentage: number | null
          tax_amount: number | null
          tax_percentage: number | null
          total_indirect: number | null
          updated_at: string | null
          vat_amount: number | null
          vat_percentage: number | null
        }
        Insert: {
          bom_id: string
          created_at?: string | null
          id?: string
          ocm_amount?: number | null
          ocm_percentage?: number | null
          other_costs?: Json | null
          profit_amount?: number | null
          profit_percentage?: number | null
          tax_amount?: number | null
          tax_percentage?: number | null
          total_indirect?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vat_percentage?: number | null
        }
        Update: {
          bom_id?: string
          created_at?: string | null
          id?: string
          ocm_amount?: number | null
          ocm_percentage?: number | null
          other_costs?: Json | null
          profit_amount?: number | null
          profit_percentage?: number | null
          tax_amount?: number | null
          tax_percentage?: number | null
          total_indirect?: number | null
          updated_at?: string | null
          vat_amount?: number | null
          vat_percentage?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_indirect_costs_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_labor: {
        Row: {
          created_at: string | null
          crew_size: number | null
          description: string | null
          hourly_rate: number
          hours: number
          id: string
          labor_type: string
          notes: string | null
          scope_id: string
          total_cost: number | null
        }
        Insert: {
          created_at?: string | null
          crew_size?: number | null
          description?: string | null
          hourly_rate: number
          hours: number
          id?: string
          labor_type: string
          notes?: string | null
          scope_id: string
          total_cost?: number | null
        }
        Update: {
          created_at?: string | null
          crew_size?: number | null
          description?: string | null
          hourly_rate?: number
          hours?: number
          id?: string
          labor_type?: string
          notes?: string | null
          scope_id?: string
          total_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_labor_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_materials: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          material_name: string
          notes: string | null
          quantity: number
          scope_id: string
          supplier: string | null
          total_cost: number | null
          unit: string
          unit_cost: number
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          material_name: string
          notes?: string | null
          quantity: number
          scope_id: string
          supplier?: string | null
          total_cost?: number | null
          unit: string
          unit_cost: number
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          material_name?: string
          notes?: string | null
          quantity?: number
          scope_id?: string
          supplier?: string | null
          total_cost?: number | null
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "bom_materials_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_scope_of_work: {
        Row: {
          bom_id: string
          completion_percentage: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          order_number: number
          status: string | null
          subtotal: number | null
          total_labor: number | null
          total_materials: number | null
        }
        Insert: {
          bom_id: string
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          order_number: number
          status?: string | null
          subtotal?: number | null
          total_labor?: number | null
          total_materials?: number | null
        }
        Update: {
          bom_id?: string
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          order_number?: number
          status?: string | null
          subtotal?: number | null
          total_labor?: number | null
          total_materials?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_scope_of_work_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_advance_requests: {
        Row: {
          amount: number
          created_at: string | null
          form_number: string | null
          id: string
          personnel_id: string | null
          project_id: string | null
          reason: string | null
          request_date: string | null
          status: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          form_number?: string | null
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          reason?: string | null
          request_date?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          form_number?: string | null
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          reason?: string | null
          request_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_advance_requests_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_advance_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      certifications: {
        Row: {
          certificate_number: string | null
          certification_name: string
          created_at: string | null
          document_url: string | null
          expiry_date: string | null
          id: string
          issue_date: string | null
          issuing_organization: string | null
          personnel_id: string
          status: string
        }
        Insert: {
          certificate_number?: string | null
          certification_name: string
          created_at?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          personnel_id: string
          status?: string
        }
        Update: {
          certificate_number?: string | null
          certification_name?: string
          created_at?: string | null
          document_url?: string | null
          expiry_date?: string | null
          id?: string
          issue_date?: string | null
          issuing_organization?: string | null
          personnel_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "certifications_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          created_at: string | null
          delivery_date: string
          id: string
          item_name: string
          notes: string | null
          project_id: string
          quantity: number | null
          receipt_number: string | null
          received_by: string | null
          status: string | null
          supplier: string
          unit: string | null
        }
        Insert: {
          created_at?: string | null
          delivery_date: string
          id?: string
          item_name: string
          notes?: string | null
          project_id: string
          quantity?: number | null
          receipt_number?: string | null
          received_by?: string | null
          status?: string | null
          supplier: string
          unit?: string | null
        }
        Update: {
          created_at?: string | null
          delivery_date?: string
          id?: string
          item_name?: string
          notes?: string | null
          project_id?: string
          quantity?: number | null
          receipt_number?: string | null
          received_by?: string | null
          status?: string | null
          supplier?: string
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory: {
        Row: {
          category: string
          created_at: string | null
          id: string
          last_restocked: string | null
          location: string | null
          name: string
          project_id: string | null
          quantity: number
          reorder_level: number | null
          unit: string
          unit_cost: number
        }
        Insert: {
          category: string
          created_at?: string | null
          id?: string
          last_restocked?: string | null
          location?: string | null
          name: string
          project_id?: string | null
          quantity?: number
          reorder_level?: number | null
          unit: string
          unit_cost: number
        }
        Update: {
          category?: string
          created_at?: string | null
          id?: string
          last_restocked?: string | null
          location?: string | null
          name?: string
          project_id?: string | null
          quantity?: number
          reorder_level?: number | null
          unit?: string
          unit_cost?: number
        }
        Relationships: [
          {
            foreignKeyName: "inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      leave_requests: {
        Row: {
          approved_by: string | null
          approved_date: string | null
          created_at: string | null
          days_requested: number
          end_date: string
          id: string
          leave_type: string
          notes: string | null
          personnel_id: string
          reason: string | null
          start_date: string
          status: string
        }
        Insert: {
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string | null
          days_requested: number
          end_date: string
          id?: string
          leave_type: string
          notes?: string | null
          personnel_id: string
          reason?: string | null
          start_date: string
          status?: string
        }
        Update: {
          approved_by?: string | null
          approved_date?: string | null
          created_at?: string | null
          days_requested?: number
          end_date?: string
          id?: string
          leave_type?: string
          notes?: string | null
          personnel_id?: string
          reason?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      liquidations: {
        Row: {
          actual_amount: number
          advance_amount: number
          created_at: string | null
          date: string
          id: string
          personnel_id: string | null
          project_id: string | null
          purpose: string
          receipt_attached: boolean | null
          status: string | null
          submitted_by: string
        }
        Insert: {
          actual_amount?: number
          advance_amount?: number
          created_at?: string | null
          date: string
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          purpose: string
          receipt_attached?: boolean | null
          status?: string | null
          submitted_by: string
        }
        Update: {
          actual_amount?: number
          advance_amount?: number
          created_at?: string | null
          date?: string
          id?: string
          personnel_id?: string | null
          project_id?: string | null
          purpose?: string
          receipt_attached?: boolean | null
          status?: string | null
          submitted_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "liquidations_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "liquidations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      master_items: {
        Row: {
          associated_scopes: Json | null
          category: string
          created_at: string | null
          default_cost: number | null
          id: string
          name: string
          unit: string
        }
        Insert: {
          associated_scopes?: Json | null
          category: string
          created_at?: string | null
          default_cost?: number | null
          id?: string
          name: string
          unit: string
        }
        Update: {
          associated_scopes?: Json | null
          category?: string
          created_at?: string | null
          default_cost?: number | null
          id?: string
          name?: string
          unit?: string
        }
        Relationships: []
      }
      master_scopes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      material_consumption: {
        Row: {
          bom_scope_id: string | null
          created_at: string | null
          date_used: string
          id: string
          item_name: string
          notes: string | null
          project_id: string
          quantity: number
          recorded_by: string | null
          unit: string
        }
        Insert: {
          bom_scope_id?: string | null
          created_at?: string | null
          date_used?: string
          id?: string
          item_name: string
          notes?: string | null
          project_id: string
          quantity: number
          recorded_by?: string | null
          unit: string
        }
        Update: {
          bom_scope_id?: string | null
          created_at?: string | null
          date_used?: string
          id?: string
          item_name?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          recorded_by?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "material_consumption_bom_scope_id_fkey"
            columns: ["bom_scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "material_consumption_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      payroll: {
        Row: {
          created_at: string | null
          deductions: number | null
          gross_pay: number
          hourly_rate: number
          id: string
          net_pay: number
          notes: string | null
          overtime_hours: number | null
          pay_period_end: string
          pay_period_start: string
          payment_date: string | null
          payment_method: string | null
          personnel_id: string
          regular_hours: number | null
          status: string
        }
        Insert: {
          created_at?: string | null
          deductions?: number | null
          gross_pay: number
          hourly_rate: number
          id?: string
          net_pay: number
          notes?: string | null
          overtime_hours?: number | null
          pay_period_end: string
          pay_period_start: string
          payment_date?: string | null
          payment_method?: string | null
          personnel_id: string
          regular_hours?: number | null
          status?: string
        }
        Update: {
          created_at?: string | null
          deductions?: number | null
          gross_pay?: number
          hourly_rate?: number
          id?: string
          net_pay?: number
          notes?: string | null
          overtime_hours?: number | null
          pay_period_end?: string
          pay_period_start?: string
          payment_date?: string | null
          payment_method?: string | null
          personnel_id?: string
          regular_hours?: number | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payroll_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel: {
        Row: {
          created_at: string | null
          created_source: string | null
          daily_rate: number | null
          email: string
          hire_date: string
          hourly_rate: number | null
          id: string
          name: string
          overtime_rate: number | null
          phone: string | null
          project_id: string | null
          role: string
          status: string
          updated_source: string | null
          worker_type: string | null
        }
        Insert: {
          created_at?: string | null
          created_source?: string | null
          daily_rate?: number | null
          email: string
          hire_date: string
          hourly_rate?: number | null
          id?: string
          name: string
          overtime_rate?: number | null
          phone?: string | null
          project_id?: string | null
          role: string
          status: string
          updated_source?: string | null
          worker_type?: string | null
        }
        Update: {
          created_at?: string | null
          created_source?: string | null
          daily_rate?: number | null
          email?: string
          hire_date?: string
          hourly_rate?: number | null
          id?: string
          name?: string
          overtime_rate?: number | null
          phone?: string | null
          project_id?: string | null
          role?: string
          status?: string
          updated_source?: string | null
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      personnel_visas: {
        Row: {
          country: string
          created_at: string | null
          expiry_date: string
          id: string
          issue_date: string
          passport_expiry_date: string | null
          passport_issue_date: string | null
          passport_number: string | null
          personnel_id: string | null
          status: string | null
          visa_expiry_date: string | null
          visa_issue_date: string | null
          visa_number: string
        }
        Insert: {
          country: string
          created_at?: string | null
          expiry_date: string
          id?: string
          issue_date: string
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_number?: string | null
          personnel_id?: string | null
          status?: string | null
          visa_expiry_date?: string | null
          visa_issue_date?: string | null
          visa_number: string
        }
        Update: {
          country?: string
          created_at?: string | null
          expiry_date?: string
          id?: string
          issue_date?: string
          passport_expiry_date?: string | null
          passport_issue_date?: string | null
          passport_number?: string | null
          personnel_id?: string | null
          status?: string | null
          visa_expiry_date?: string | null
          visa_issue_date?: string | null
          visa_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "personnel_visas_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      progress_updates: {
        Row: {
          bom_scope_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          percentage_completed: number | null
          quantity_completed: number | null
          scope_id: string | null
          update_date: string
          updated_by: string | null
        }
        Insert: {
          bom_scope_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          percentage_completed?: number | null
          quantity_completed?: number | null
          scope_id?: string | null
          update_date: string
          updated_by?: string | null
        }
        Update: {
          bom_scope_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          percentage_completed?: number | null
          quantity_completed?: number | null
          scope_id?: string | null
          update_date?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "progress_updates_bom_scope_id_fkey"
            columns: ["bom_scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "progress_updates_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "scope_of_works"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          budget: number
          client: string
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          location: string
          name: string
          spent: number | null
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          budget: number
          client: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location: string
          name: string
          spent?: number | null
          start_date: string
          status: string
          updated_at?: string | null
        }
        Update: {
          budget?: number
          client?: string
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          location?: string
          name?: string
          spent?: number | null
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          category: string
          created_at: string | null
          destination_type: string
          id: string
          item_name: string
          notes: string | null
          order_date: string
          order_number: string
          project_id: string | null
          quantity: number
          status: string
          supplier: string
          total_cost: number | null
          unit: string
          unit_cost: number
          voucher_number: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          destination_type: string
          id?: string
          item_name: string
          notes?: string | null
          order_date?: string
          order_number: string
          project_id?: string | null
          quantity: number
          status?: string
          supplier: string
          total_cost?: number | null
          unit: string
          unit_cost: number
          voucher_number?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          destination_type?: string
          id?: string
          item_name?: string
          notes?: string | null
          order_date?: string
          order_number?: string
          project_id?: string | null
          quantity?: number
          status?: string
          supplier?: string
          total_cost?: number | null
          unit?: string
          unit_cost?: number
          voucher_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      scope_of_works: {
        Row: {
          completed_quantity: number | null
          created_at: string | null
          description: string
          id: string
          order_number: number | null
          planned_quantity: number | null
          project_id: string
          status: string | null
          unit: string | null
        }
        Insert: {
          completed_quantity?: number | null
          created_at?: string | null
          description: string
          id?: string
          order_number?: number | null
          planned_quantity?: number | null
          project_id: string
          status?: string | null
          unit?: string | null
        }
        Update: {
          completed_quantity?: number | null
          created_at?: string | null
          description?: string
          id?: string
          order_number?: number | null
          planned_quantity?: number | null
          project_id?: string
          status?: string | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scope_of_works_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_attendance: {
        Row: {
          bom_scope_id: string | null
          created_at: string | null
          date: string
          hours_worked: number | null
          id: string
          notes: string | null
          overtime_hours: number | null
          personnel_id: string
          project_id: string
          status: string | null
        }
        Insert: {
          bom_scope_id?: string | null
          created_at?: string | null
          date: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          personnel_id: string
          project_id: string
          status?: string | null
        }
        Update: {
          bom_scope_id?: string | null
          created_at?: string | null
          date?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          personnel_id?: string
          project_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_attendance_bom_scope_id_fkey"
            columns: ["bom_scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_attendance_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_attendance_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      site_requests: {
        Row: {
          amount: number | null
          bom_scope_id: string | null
          created_at: string | null
          form_number: string | null
          id: string
          item_name: string
          notes: string | null
          project_id: string
          quantity: number
          request_date: string
          request_type: string | null
          requested_by: string
          status: string | null
          unit: string
        }
        Insert: {
          amount?: number | null
          bom_scope_id?: string | null
          created_at?: string | null
          form_number?: string | null
          id?: string
          item_name: string
          notes?: string | null
          project_id: string
          quantity: number
          request_date?: string
          request_type?: string | null
          requested_by: string
          status?: string | null
          unit: string
        }
        Update: {
          amount?: number | null
          bom_scope_id?: string | null
          created_at?: string | null
          form_number?: string | null
          id?: string
          item_name?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          request_date?: string
          request_type?: string | null
          requested_by?: string
          status?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "site_requests_bom_scope_id_fkey"
            columns: ["bom_scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "site_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          amount: number
          created_at: string | null
          end_date: string | null
          features: Json | null
          id: string
          plan: string
          start_date: string
          status: string
          user_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          end_date?: string | null
          features?: Json | null
          id?: string
          plan: string
          start_date: string
          status: string
          user_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          end_date?: string | null
          features?: Json | null
          id?: string
          plan?: string
          start_date?: string
          status?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          phone: string | null
          status: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          status?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
        }
        Relationships: []
      }
      training_records: {
        Row: {
          certificate_issued: boolean | null
          completion_status: string
          created_at: string | null
          duration_hours: number | null
          id: string
          notes: string | null
          personnel_id: string
          score: number | null
          trainer: string | null
          training_date: string
          training_title: string
          training_type: string | null
        }
        Insert: {
          certificate_issued?: boolean | null
          completion_status?: string
          created_at?: string | null
          duration_hours?: number | null
          id?: string
          notes?: string | null
          personnel_id: string
          score?: number | null
          trainer?: string | null
          training_date: string
          training_title: string
          training_type?: string | null
        }
        Update: {
          certificate_issued?: boolean | null
          completion_status?: string
          created_at?: string | null
          duration_hours?: number | null
          id?: string
          notes?: string | null
          personnel_id?: string
          score?: number | null
          trainer?: string | null
          training_date?: string
          training_title?: string
          training_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "training_records_personnel_id_fkey"
            columns: ["personnel_id"]
            isOneToOne: false
            referencedRelation: "personnel"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          amount: number
          category: string
          created_at: string | null
          date: string
          description: string
          id: string
          project_id: string | null
          reference_number: string | null
          type: string
          vendor: string | null
        }
        Insert: {
          amount: number
          category: string
          created_at?: string | null
          date: string
          description: string
          id?: string
          project_id?: string | null
          reference_number?: string | null
          type: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string | null
          date?: string
          description?: string
          id?: string
          project_id?: string | null
          reference_number?: string | null
          type?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          amount: number
          created_at: string | null
          date: string
          description: string | null
          id: string
          payee: string
          project_id: string | null
          status: string | null
          type: string
          voucher_number: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          payee: string
          project_id?: string | null
          status?: string | null
          type: string
          voucher_number: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          payee?: string
          project_id?: string | null
          status?: string | null
          type?: string
          voucher_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "vouchers_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
