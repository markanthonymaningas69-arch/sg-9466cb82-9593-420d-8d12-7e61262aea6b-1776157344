 
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
      bill_of_materials: {
        Row: {
          bom_number: string
          created_at: string | null
          description: string | null
          grand_total: number | null
          id: string
          project_id: string
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
          created_at: string | null
          description: string | null
          id: string
          name: string
          order_number: number
          subtotal: number | null
          total_labor: number | null
          total_materials: number | null
        }
        Insert: {
          bom_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          order_number: number
          subtotal?: number | null
          total_labor?: number | null
          total_materials?: number | null
        }
        Update: {
          bom_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          order_number?: number
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
      personnel: {
        Row: {
          created_at: string | null
          email: string
          hire_date: string
          hourly_rate: number | null
          id: string
          name: string
          phone: string | null
          project_id: string | null
          role: string
          status: string
        }
        Insert: {
          created_at?: string | null
          email: string
          hire_date: string
          hourly_rate?: number | null
          id?: string
          name: string
          phone?: string | null
          project_id?: string | null
          role: string
          status: string
        }
        Update: {
          created_at?: string | null
          email?: string
          hire_date?: string
          hourly_rate?: number | null
          id?: string
          name?: string
          phone?: string | null
          project_id?: string | null
          role?: string
          status?: string
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
