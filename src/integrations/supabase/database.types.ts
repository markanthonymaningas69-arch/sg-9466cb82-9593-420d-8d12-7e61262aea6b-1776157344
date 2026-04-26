 
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "accounting_transactions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accounting_transactions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_chat_threads: {
        Row: {
          created_at: string | null
          id: string
          messages: Json
          title: string
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          messages?: Json
          title: string
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          messages?: Json
          title?: string
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      approval_actions: {
        Row: {
          action_status: string
          actor_name: string
          actor_user_id: string | null
          approval_request_id: string
          comments: string | null
          company_id: string
          created_at: string
          id: string
        }
        Insert: {
          action_status: string
          actor_name: string
          actor_user_id?: string | null
          approval_request_id: string
          comments?: string | null
          company_id?: string
          created_at?: string
          id?: string
        }
        Update: {
          action_status?: string
          actor_name?: string
          actor_user_id?: string | null
          approval_request_id?: string
          comments?: string | null
          company_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_actions_actor_user_id_fkey"
            columns: ["actor_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_actions_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_notification_reads: {
        Row: {
          company_id: string
          id: string
          notification_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          company_id?: string
          id?: string
          notification_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          id?: string
          notification_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_notification_reads_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "approval_notifications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_notification_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_notifications: {
        Row: {
          approval_request_id: string | null
          audience_module: string
          company_id: string
          created_at: string
          event_type: string
          id: string
          message: string
          payload: Json
          target_surface: string
          title: string
        }
        Insert: {
          approval_request_id?: string | null
          audience_module: string
          company_id?: string
          created_at?: string
          event_type: string
          id?: string
          message: string
          payload?: Json
          target_surface: string
          title: string
        }
        Update: {
          approval_request_id?: string | null
          audience_module?: string
          company_id?: string
          created_at?: string
          event_type?: string
          id?: string
          message?: string
          payload?: Json
          target_surface?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_notifications_approval_request_id_fkey"
            columns: ["approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      approval_requests: {
        Row: {
          company_id: string
          completed_at: string | null
          created_at: string
          id: string
          latest_comment: string | null
          payload: Json
          processed_at: string | null
          project_id: string | null
          request_type: string
          requested_at: string
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          routed_at: string | null
          source_module: string
          source_record_id: string
          source_table: string
          status: string
          summary: string | null
          target_module: string | null
          updated_at: string
          workflow_status: string
        }
        Insert: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          latest_comment?: string | null
          payload?: Json
          processed_at?: string | null
          project_id?: string | null
          request_type: string
          requested_at?: string
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          routed_at?: string | null
          source_module: string
          source_record_id: string
          source_table: string
          status?: string
          summary?: string | null
          target_module?: string | null
          updated_at?: string
          workflow_status?: string
        }
        Update: {
          company_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          latest_comment?: string | null
          payload?: Json
          processed_at?: string | null
          project_id?: string | null
          request_type?: string
          requested_at?: string
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          routed_at?: string | null
          source_module?: string
          source_record_id?: string
          source_table?: string
          status?: string
          summary?: string | null
          target_module?: string | null
          updated_at?: string
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "approval_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "approval_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bill_of_materials: {
        Row: {
          bom_number: string
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "bill_of_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
          {
            foreignKeyName: "bom_indirect_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_labor: {
        Row: {
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "bom_labor_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "bom_materials_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_materials_scope_id_fkey"
            columns: ["scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_progress_updates: {
        Row: {
          bom_scope_id: string | null
          company_id: string | null
          created_at: string | null
          id: string
          notes: string | null
          percentage_completed: number | null
          update_date: string | null
          updated_by: string | null
        }
        Insert: {
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          percentage_completed?: number | null
          update_date?: string | null
          updated_by?: string | null
        }
        Update: {
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          id?: string
          notes?: string | null
          percentage_completed?: number | null
          update_date?: string | null
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_progress_updates_bom_scope_id_fkey"
            columns: ["bom_scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_progress_updates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      bom_scope_of_work: {
        Row: {
          bom_id: string
          company_id: string | null
          completion_percentage: number | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          order_number: number
          quantity: number | null
          status: string | null
          subtotal: number | null
          total_labor: number | null
          total_materials: number | null
          unit: string | null
        }
        Insert: {
          bom_id: string
          company_id?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          order_number: number
          quantity?: number | null
          status?: string | null
          subtotal?: number | null
          total_labor?: number | null
          total_materials?: number | null
          unit?: string | null
        }
        Update: {
          bom_id?: string
          company_id?: string | null
          completion_percentage?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          order_number?: number
          quantity?: number | null
          status?: string | null
          subtotal?: number | null
          total_labor?: number | null
          total_materials?: number | null
          unit?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bom_scope_of_work_bom_id_fkey"
            columns: ["bom_id"]
            isOneToOne: false
            referencedRelation: "bill_of_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bom_scope_of_work_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_advance_requests: {
        Row: {
          amount: number
          company_id: string | null
          created_at: string | null
          form_number: string | null
          id: string
          is_archived: boolean | null
          personnel_id: string | null
          project_id: string | null
          reason: string | null
          request_date: string | null
          status: string | null
        }
        Insert: {
          amount: number
          company_id?: string | null
          created_at?: string | null
          form_number?: string | null
          id?: string
          is_archived?: boolean | null
          personnel_id?: string | null
          project_id?: string | null
          reason?: string | null
          request_date?: string | null
          status?: string | null
        }
        Update: {
          amount?: number
          company_id?: string | null
          created_at?: string | null
          form_number?: string | null
          id?: string
          is_archived?: boolean | null
          personnel_id?: string | null
          project_id?: string | null
          reason?: string | null
          request_date?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_advance_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
      company_settings: {
        Row: {
          address: string | null
          auto_approve_materials: boolean | null
          created_at: string | null
          currency: string | null
          id: string
          logo: string | null
          name: string
          stripe_customer_id: string | null
          tax_id: string | null
          theme_color: string | null
          updated_at: string | null
          user_id: string
          website: string | null
        }
        Insert: {
          address?: string | null
          auto_approve_materials?: boolean | null
          created_at?: string | null
          currency?: string | null
          id?: string
          logo?: string | null
          name?: string
          stripe_customer_id?: string | null
          tax_id?: string | null
          theme_color?: string | null
          updated_at?: string | null
          user_id: string
          website?: string | null
        }
        Update: {
          address?: string | null
          auto_approve_materials?: boolean | null
          created_at?: string | null
          currency?: string | null
          id?: string
          logo?: string | null
          name?: string
          stripe_customer_id?: string | null
          tax_id?: string | null
          theme_color?: string | null
          updated_at?: string | null
          user_id?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "company_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      deliveries: {
        Row: {
          amount: number | null
          bom_scope_id: string | null
          company_id: string | null
          created_at: string | null
          delivery_date: string
          id: string
          is_archived: boolean | null
          item_name: string
          notes: string | null
          project_id: string
          quantity: number | null
          receipt_number: string | null
          received_by: string | null
          status: string | null
          supplier: string
          transaction_type: string
          unit: string | null
          unit_cost: number | null
        }
        Insert: {
          amount?: number | null
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          delivery_date: string
          id?: string
          is_archived?: boolean | null
          item_name: string
          notes?: string | null
          project_id: string
          quantity?: number | null
          receipt_number?: string | null
          received_by?: string | null
          status?: string | null
          supplier: string
          transaction_type?: string
          unit?: string | null
          unit_cost?: number | null
        }
        Update: {
          amount?: number | null
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          delivery_date?: string
          id?: string
          is_archived?: boolean | null
          item_name?: string
          notes?: string | null
          project_id?: string
          quantity?: number | null
          receipt_number?: string | null
          received_by?: string | null
          status?: string | null
          supplier?: string
          transaction_type?: string
          unit?: string | null
          unit_cost?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_bom_scope_id_fkey"
            columns: ["bom_scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
          created_at: string | null
          id: string
          is_archived: boolean | null
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
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
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
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_archived?: boolean | null
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
            foreignKeyName: "inventory_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      invite_codes: {
        Row: {
          code: string
          company_id: string | null
          created_at: string | null
          id: string
          is_addon: boolean | null
          module: string
          modules: string[] | null
          project_id: string | null
          project_ids: string[] | null
          status: string | null
        }
        Insert: {
          code: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_addon?: boolean | null
          module: string
          modules?: string[] | null
          project_id?: string | null
          project_ids?: string[] | null
          status?: string | null
        }
        Update: {
          code?: string
          company_id?: string | null
          created_at?: string | null
          id?: string
          is_addon?: boolean | null
          module?: string
          modules?: string[] | null
          project_id?: string | null
          project_ids?: string[] | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invite_codes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invite_codes_project_id_fkey"
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
          company_id: string | null
          created_at: string | null
          days_requested: number
          end_date: string
          id: string
          is_archived: boolean | null
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
          company_id?: string | null
          created_at?: string | null
          days_requested: number
          end_date: string
          id?: string
          is_archived?: boolean | null
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
          company_id?: string | null
          created_at?: string | null
          days_requested?: number
          end_date?: string
          id?: string
          is_archived?: boolean | null
          leave_type?: string
          notes?: string | null
          personnel_id?: string
          reason?: string | null
          start_date?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "leave_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "liquidations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
      manpower_rate_catalog: {
        Row: {
          category: string
          company_id: string
          created_at: string
          currency: string
          daily_rate: number
          effective_date: string
          hourly_rate: number
          id: string
          overtime_rate: number
          position_name: string
          status: string
          updated_at: string
        }
        Insert: {
          category?: string
          company_id?: string
          created_at?: string
          currency?: string
          daily_rate?: number
          effective_date?: string
          hourly_rate?: number
          id?: string
          overtime_rate?: number
          position_name: string
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string
          company_id?: string
          created_at?: string
          currency?: string
          daily_rate?: number
          effective_date?: string
          hourly_rate?: number
          id?: string
          overtime_rate?: number
          position_name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manpower_rate_catalog_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      master_items: {
        Row: {
          associated_scopes: Json | null
          category: string
          company_id: string | null
          created_at: string | null
          default_cost: number | null
          id: string
          name: string
          unit: string
        }
        Insert: {
          associated_scopes?: Json | null
          category: string
          company_id?: string | null
          created_at?: string | null
          default_cost?: number | null
          id?: string
          name: string
          unit: string
        }
        Update: {
          associated_scopes?: Json | null
          category?: string
          company_id?: string | null
          created_at?: string | null
          default_cost?: number | null
          id?: string
          name?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_items_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      master_scopes: {
        Row: {
          company_id: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "master_scopes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      master_team_templates: {
        Row: {
          company_id: string | null
          created_at: string | null
          id: string
          name: string
          roles: Json
          updated_at: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name: string
          roles?: Json
          updated_at?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          id?: string
          name?: string
          roles?: Json
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "master_team_templates_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      material_consumption: {
        Row: {
          bom_scope_id: string | null
          company_id: string | null
          created_at: string | null
          date_used: string
          estimated_cost: number | null
          id: string
          is_archived: boolean | null
          item_name: string
          notes: string | null
          project_id: string
          quantity: number
          recorded_by: string | null
          unit: string
        }
        Insert: {
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date_used?: string
          estimated_cost?: number | null
          id?: string
          is_archived?: boolean | null
          item_name: string
          notes?: string | null
          project_id: string
          quantity: number
          recorded_by?: string | null
          unit: string
        }
        Update: {
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date_used?: string
          estimated_cost?: number | null
          id?: string
          is_archived?: boolean | null
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
            foreignKeyName: "material_consumption_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "payroll_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
          created_at: string | null
          created_source: string | null
          daily_rate: number | null
          email: string
          employment_type: string
          hire_date: string
          hourly_rate: number | null
          id: string
          is_archived: boolean | null
          name: string
          overtime_rate: number | null
          phone: string | null
          position_id: string | null
          project_id: string | null
          rate_snapshot: Json
          role: string
          status: string
          updated_source: string | null
          worker_type: string | null
        }
        Insert: {
          company_id?: string | null
          created_at?: string | null
          created_source?: string | null
          daily_rate?: number | null
          email: string
          employment_type?: string
          hire_date: string
          hourly_rate?: number | null
          id?: string
          is_archived?: boolean | null
          name: string
          overtime_rate?: number | null
          phone?: string | null
          position_id?: string | null
          project_id?: string | null
          rate_snapshot?: Json
          role: string
          status: string
          updated_source?: string | null
          worker_type?: string | null
        }
        Update: {
          company_id?: string | null
          created_at?: string | null
          created_source?: string | null
          daily_rate?: number | null
          email?: string
          employment_type?: string
          hire_date?: string
          hourly_rate?: number | null
          id?: string
          is_archived?: boolean | null
          name?: string
          overtime_rate?: number | null
          phone?: string | null
          position_id?: string | null
          project_id?: string | null
          rate_snapshot?: Json
          role?: string
          status?: string
          updated_source?: string | null
          worker_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "personnel_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "personnel_position_id_fkey"
            columns: ["position_id"]
            isOneToOne: false
            referencedRelation: "manpower_rate_catalog"
            referencedColumns: ["id"]
          },
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
          company_id: string | null
          country: string
          created_at: string | null
          expiry_date: string
          id: string
          is_archived: boolean | null
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
          company_id?: string | null
          country: string
          created_at?: string | null
          expiry_date: string
          id?: string
          is_archived?: boolean | null
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
          company_id?: string | null
          country?: string
          created_at?: string | null
          expiry_date?: string
          id?: string
          is_archived?: boolean | null
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
            foreignKeyName: "personnel_visas_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
          assigned_module: string | null
          assigned_modules: string[] | null
          assigned_project_id: string | null
          assigned_project_ids: string[] | null
          avatar_url: string | null
          company_id: string | null
          country: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string
          is_addon: boolean | null
          project_change_count: number | null
          subscription_end_date: string | null
          subscription_start_date: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_module?: string | null
          assigned_modules?: string[] | null
          assigned_project_id?: string | null
          assigned_project_ids?: string[] | null
          avatar_url?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id: string
          is_addon?: boolean | null
          project_change_count?: number | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_module?: string | null
          assigned_modules?: string[] | null
          assigned_project_id?: string | null
          assigned_project_ids?: string[] | null
          avatar_url?: string | null
          company_id?: string | null
          country?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string
          is_addon?: boolean | null
          project_change_count?: number | null
          subscription_end_date?: string | null
          subscription_start_date?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_assigned_project_id_fkey"
            columns: ["assigned_project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      project_scurve_daily: {
        Row: {
          actual_value: number
          company_id: string
          created_at: string
          date: string
          earned_value: number
          id: string
          planned_value: number
          project_id: string
          updated_at: string
        }
        Insert: {
          actual_value?: number
          company_id?: string
          created_at?: string
          date: string
          earned_value?: number
          id?: string
          planned_value?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          actual_value?: number
          company_id?: string
          created_at?: string
          date?: string
          earned_value?: number
          id?: string
          planned_value?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_scurve_daily_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_scurve_daily_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_tasks: {
        Row: {
          assigned_team: string | null
          bom_scope_id: string | null
          constraint_type: string | null
          cost_links: Json | null
          created_at: string | null
          created_by: string | null
          dependencies: Json | null
          description: string | null
          duration_days: number | null
          duration_source: string | null
          end_date: string
          equipment: Json | null
          id: string
          name: string
          notes: string | null
          number_of_teams: number
          parent_id: string | null
          priority: string | null
          productivity_rate_per_day: number | null
          productivity_rate_per_hour: number | null
          progress: number | null
          project_id: string | null
          resource_labor: Json | null
          scope_quantity: number | null
          scope_unit: string | null
          sort_order: number | null
          start_date: string
          status: string | null
          task_config: Json
          team_composition: Json | null
          team_template_id: string | null
          updated_at: string | null
          working_hours_per_day: number | null
        }
        Insert: {
          assigned_team?: string | null
          bom_scope_id?: string | null
          constraint_type?: string | null
          cost_links?: Json | null
          created_at?: string | null
          created_by?: string | null
          dependencies?: Json | null
          description?: string | null
          duration_days?: number | null
          duration_source?: string | null
          end_date: string
          equipment?: Json | null
          id?: string
          name: string
          notes?: string | null
          number_of_teams?: number
          parent_id?: string | null
          priority?: string | null
          productivity_rate_per_day?: number | null
          productivity_rate_per_hour?: number | null
          progress?: number | null
          project_id?: string | null
          resource_labor?: Json | null
          scope_quantity?: number | null
          scope_unit?: string | null
          sort_order?: number | null
          start_date: string
          status?: string | null
          task_config?: Json
          team_composition?: Json | null
          team_template_id?: string | null
          updated_at?: string | null
          working_hours_per_day?: number | null
        }
        Update: {
          assigned_team?: string | null
          bom_scope_id?: string | null
          constraint_type?: string | null
          cost_links?: Json | null
          created_at?: string | null
          created_by?: string | null
          dependencies?: Json | null
          description?: string | null
          duration_days?: number | null
          duration_source?: string | null
          end_date?: string
          equipment?: Json | null
          id?: string
          name?: string
          notes?: string | null
          number_of_teams?: number
          parent_id?: string | null
          priority?: string | null
          productivity_rate_per_day?: number | null
          productivity_rate_per_hour?: number | null
          progress?: number | null
          project_id?: string | null
          resource_labor?: Json | null
          scope_quantity?: number | null
          scope_unit?: string | null
          sort_order?: number | null
          start_date?: string
          status?: string | null
          task_config?: Json
          team_composition?: Json | null
          team_template_id?: string | null
          updated_at?: string | null
          working_hours_per_day?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "project_tasks_bom_scope_id_fkey"
            columns: ["bom_scope_id"]
            isOneToOne: false
            referencedRelation: "bom_scope_of_work"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_tasks_team_template_id_fkey"
            columns: ["team_template_id"]
            isOneToOne: false
            referencedRelation: "master_team_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          bom_edit_locked: boolean
          budget: number
          client: string
          company_id: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          id: string
          is_archived: boolean | null
          location: string
          name: string
          spent: number | null
          start_date: string
          status: string
          updated_at: string | null
        }
        Insert: {
          bom_edit_locked?: boolean
          budget: number
          client: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean | null
          location: string
          name: string
          spent?: number | null
          start_date: string
          status: string
          updated_at?: string | null
        }
        Update: {
          bom_edit_locked?: boolean
          budget?: number
          client?: string
          company_id?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          is_archived?: boolean | null
          location?: string
          name?: string
          spent?: number | null
          start_date?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "projects_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      purchases: {
        Row: {
          category: string
          company_id: string | null
          created_at: string | null
          destination_type: string
          id: string
          is_archived: boolean | null
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
          company_id?: string | null
          created_at?: string | null
          destination_type: string
          id?: string
          is_archived?: boolean | null
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
          company_id?: string | null
          created_at?: string | null
          destination_type?: string
          id?: string
          is_archived?: boolean | null
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
            foreignKeyName: "purchases_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      request_execution_tracking: {
        Row: {
          actual_quantity: number | null
          company_id: string
          created_at: string
          delivery_id: string | null
          id: string
          initial_approval_request_id: string | null
          lifecycle_status: string
          project_id: string | null
          purchase_id: string | null
          received_at: string | null
          received_by: string | null
          remarks: string | null
          site_request_id: string
          supplier: string | null
          target_module: string | null
          total_amount: number
          updated_at: string
          voucher_id: string | null
          voucher_number: string | null
          voucher_request_id: string | null
        }
        Insert: {
          actual_quantity?: number | null
          company_id?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          initial_approval_request_id?: string | null
          lifecycle_status?: string
          project_id?: string | null
          purchase_id?: string | null
          received_at?: string | null
          received_by?: string | null
          remarks?: string | null
          site_request_id: string
          supplier?: string | null
          target_module?: string | null
          total_amount?: number
          updated_at?: string
          voucher_id?: string | null
          voucher_number?: string | null
          voucher_request_id?: string | null
        }
        Update: {
          actual_quantity?: number | null
          company_id?: string
          created_at?: string
          delivery_id?: string | null
          id?: string
          initial_approval_request_id?: string | null
          lifecycle_status?: string
          project_id?: string | null
          purchase_id?: string | null
          received_at?: string | null
          received_by?: string | null
          remarks?: string | null
          site_request_id?: string
          supplier?: string | null
          target_module?: string | null
          total_amount?: number
          updated_at?: string
          voucher_id?: string | null
          voucher_number?: string | null
          voucher_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "request_execution_tracking_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_execution_tracking_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "deliveries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_execution_tracking_initial_approval_request_id_fkey"
            columns: ["initial_approval_request_id"]
            isOneToOne: true
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_execution_tracking_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_execution_tracking_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: true
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_execution_tracking_site_request_id_fkey"
            columns: ["site_request_id"]
            isOneToOne: true
            referencedRelation: "site_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_execution_tracking_voucher_id_fkey"
            columns: ["voucher_id"]
            isOneToOne: false
            referencedRelation: "vouchers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "request_execution_tracking_voucher_request_id_fkey"
            columns: ["voucher_request_id"]
            isOneToOne: true
            referencedRelation: "voucher_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      site_attendance: {
        Row: {
          bom_scope_id: string | null
          company_id: string | null
          created_at: string | null
          date: string
          hours_worked: number | null
          id: string
          notes: string | null
          overtime_hours: number | null
          personnel_id: string
          project_id: string
          status: string | null
          time_in: string | null
        }
        Insert: {
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          personnel_id: string
          project_id: string
          status?: string | null
          time_in?: string | null
        }
        Update: {
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          date?: string
          hours_worked?: number | null
          id?: string
          notes?: string | null
          overtime_hours?: number | null
          personnel_id?: string
          project_id?: string
          status?: string | null
          time_in?: string | null
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
            foreignKeyName: "site_attendance_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
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
          company_id: string | null
          created_at: string | null
          form_number: string | null
          id: string
          is_archived: boolean | null
          item_name: string
          notes: string | null
          project_id: string
          quantity: number
          receipt_number: string | null
          request_date: string
          request_type: string | null
          requested_by: string
          status: string | null
          supplier: string | null
          unit: string
        }
        Insert: {
          amount?: number | null
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          form_number?: string | null
          id?: string
          is_archived?: boolean | null
          item_name: string
          notes?: string | null
          project_id: string
          quantity: number
          receipt_number?: string | null
          request_date?: string
          request_type?: string | null
          requested_by: string
          status?: string | null
          supplier?: string | null
          unit: string
        }
        Update: {
          amount?: number | null
          bom_scope_id?: string | null
          company_id?: string | null
          created_at?: string | null
          form_number?: string | null
          id?: string
          is_archived?: boolean | null
          item_name?: string
          notes?: string | null
          project_id?: string
          quantity?: number
          receipt_number?: string | null
          request_date?: string
          request_type?: string | null
          requested_by?: string
          status?: string | null
          supplier?: string | null
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
            foreignKeyName: "site_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
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
      stripe_subscription_transactions: {
        Row: {
          amount: number
          country: string
          created_at: string
          currency_code: string
          id: string
          plan_id: string
          snapshot_id: string | null
          status: string
          stripe_payment_intent_id: string | null
          stripe_session_id: string
          stripe_subscription_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          country: string
          created_at?: string
          currency_code: string
          id?: string
          plan_id: string
          snapshot_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id: string
          stripe_subscription_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          country?: string
          created_at?: string
          currency_code?: string
          id?: string
          plan_id?: string
          snapshot_id?: string | null
          status?: string
          stripe_payment_intent_id?: string | null
          stripe_session_id?: string
          stripe_subscription_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stripe_subscription_transactions_snapshot_id_fkey"
            columns: ["snapshot_id"]
            isOneToOne: false
            referencedRelation: "subscription_billing_snapshots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stripe_subscription_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_billing_snapshots: {
        Row: {
          billing_cycle: string
          country: string
          created_at: string
          currency_code: string
          features: Json
          id: string
          plan_id: string
          price_amount: number
          status: string
          stripe_session_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          billing_cycle: string
          country: string
          created_at?: string
          currency_code: string
          features?: Json
          id?: string
          plan_id: string
          price_amount: number
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          billing_cycle?: string
          country?: string
          created_at?: string
          currency_code?: string
          features?: Json
          id?: string
          plan_id?: string
          price_amount?: number
          status?: string
          stripe_session_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_billing_snapshots_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
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
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
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
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
          contact_person?: string | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
        ]
      }
      task_labor_costs: {
        Row: {
          company_id: string
          created_at: string
          daily_cost: number
          duration_days: number
          id: string
          rate_snapshot: Json
          task_id: string
          total_cost: number
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          daily_cost?: number
          duration_days?: number
          id?: string
          rate_snapshot?: Json
          task_id: string
          total_cost?: number
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          daily_cost?: number
          duration_days?: number
          id?: string
          rate_snapshot?: Json
          task_id?: string
          total_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_labor_costs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_labor_costs_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: true
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_material_delivery_plans: {
        Row: {
          company_id: string
          created_at: string
          custom_interval_days: number | null
          delivery_dates: Json
          delivery_duration_days: number
          delivery_frequency: string
          delivery_schedule_type: string
          delivery_start_date: string | null
          id: string
          material_id: string
          material_name: string
          planned_usage_period: Json
          quantity_mode: string
          task_id: string
          total_quantity: number
          unit: string
          updated_at: string
        }
        Insert: {
          company_id?: string
          created_at?: string
          custom_interval_days?: number | null
          delivery_dates?: Json
          delivery_duration_days?: number
          delivery_frequency?: string
          delivery_schedule_type?: string
          delivery_start_date?: string | null
          id?: string
          material_id: string
          material_name: string
          planned_usage_period?: Json
          quantity_mode?: string
          task_id: string
          total_quantity?: number
          unit: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          custom_interval_days?: number | null
          delivery_dates?: Json
          delivery_duration_days?: number
          delivery_frequency?: string
          delivery_schedule_type?: string
          delivery_start_date?: string | null
          id?: string
          material_id?: string
          material_name?: string
          planned_usage_period?: Json
          quantity_mode?: string
          task_id?: string
          total_quantity?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_material_delivery_plans_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_material_delivery_plans_material_id_fkey"
            columns: ["material_id"]
            isOneToOne: false
            referencedRelation: "bom_materials"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_material_delivery_plans_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "project_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      voucher_requests: {
        Row: {
          accounting_status: string
          approved_at: string | null
          company_id: string
          created_at: string
          description: string | null
          id: string
          project_id: string | null
          purchase_id: string
          requested_by: string
          reviewed_by: string | null
          site_request_id: string | null
          source_approval_request_id: string | null
          status: string
          supplier: string | null
          total_amount: number
          updated_at: string
          voucher_number: string | null
        }
        Insert: {
          accounting_status?: string
          approved_at?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          purchase_id: string
          requested_by: string
          reviewed_by?: string | null
          site_request_id?: string | null
          source_approval_request_id?: string | null
          status?: string
          supplier?: string | null
          total_amount?: number
          updated_at?: string
          voucher_number?: string | null
        }
        Update: {
          accounting_status?: string
          approved_at?: string | null
          company_id?: string
          created_at?: string
          description?: string | null
          id?: string
          project_id?: string | null
          purchase_id?: string
          requested_by?: string
          reviewed_by?: string | null
          site_request_id?: string | null
          source_approval_request_id?: string | null
          status?: string
          supplier?: string | null
          total_amount?: number
          updated_at?: string
          voucher_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voucher_requests_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_requests_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_requests_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_requests_site_request_id_fkey"
            columns: ["site_request_id"]
            isOneToOne: false
            referencedRelation: "site_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voucher_requests_source_approval_request_id_fkey"
            columns: ["source_approval_request_id"]
            isOneToOne: false
            referencedRelation: "approval_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      vouchers: {
        Row: {
          amount: number
          company_id: string | null
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
          company_id?: string | null
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
          company_id?: string | null
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
            foreignKeyName: "vouchers_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_settings"
            referencedColumns: ["id"]
          },
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
      assign_user_module:
        | {
            Args: { p_module: string; p_project_id?: string; p_user_id: string }
            Returns: undefined
          }
        | {
            Args: {
              p_module: string
              p_modules?: string[]
              p_project_ids?: string[]
              p_user_id: string
            }
            Returns: undefined
          }
        | {
            Args: {
              p_module: string
              p_project_ids?: string[]
              p_user_id: string
            }
            Returns: undefined
          }
      auth_company_id: { Args: never; Returns: string }
      get_super_admin_addon_users: { Args: never; Returns: Json }
      get_super_admin_stats: { Args: never; Returns: Json }
      process_stripe_subscription: {
        Args: {
          p_amount: number
          p_customer_id: string
          p_end_date: string
          p_features: Json
          p_plan: string
          p_start_date: string
          p_status: string
          p_subscription_id: string
          p_user_id: string
        }
        Returns: undefined
      }
      update_addon_user_dates: {
        Args: { p_end_date: string; p_profile_id: string; p_start_date: string }
        Returns: undefined
      }
      update_gm_dates: {
        Args: { p_end_date: string; p_start_date: string; p_user_id: string }
        Returns: undefined
      }
      update_subscription_dates: {
        Args: { p_end_date: string; p_start_date: string; p_sub_id: string }
        Returns: undefined
      }
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
