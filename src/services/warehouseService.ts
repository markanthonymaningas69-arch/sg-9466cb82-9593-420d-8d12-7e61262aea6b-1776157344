import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type WarehouseItem = Database["public"]["Tables"]["warehouse_inventory"]["Row"];
type WarehouseInsert = Database["public"]["Tables"]["warehouse_inventory"]["Insert"];

export const warehouseService = {
  async getAll() {
    const { data, error } = await supabase
      .from("warehouse_inventory")
      .select("*")
      .order("created_at", { ascending: false });
    
    console.log("Warehouse query:", { data, error });
    return { data: data || [], error };
  },

  async getLowStock(threshold: number = 10) {
    const { data, error } = await supabase
      .from("warehouse_inventory")
      .select("*")
      .lte("quantity", threshold)
      .order("quantity", { ascending: true });
    
    console.log("Low stock items:", { data, error });
    return { data: data || [], error };
  },

  async create(item: WarehouseInsert) {
    const { data, error } = await supabase
      .from("warehouse_inventory")
      .insert(item)
      .select()
      .single();
    
    console.log("Create item:", { data, error });
    return { data, error };
  },

  async update(id: string, updates: Partial<WarehouseInsert>) {
    const { data, error } = await supabase
      .from("warehouse_inventory")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    console.log("Update item:", { data, error });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("warehouse_inventory")
      .delete()
      .eq("id", id);
    
    console.log("Delete item:", { error });
    return { error };
  },

  async adjustQuantity(id: string, adjustment: number) {
    const { data: current } = await supabase
      .from("warehouse_inventory")
      .select("quantity")
      .eq("id", id)
      .single();
    
    if (!current) return { error: new Error("Item not found") };

    const newQuantity = current.quantity + adjustment;
    return this.update(id, { quantity: newQuantity });
  }
};