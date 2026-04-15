import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type WarehouseItem = Database["public"]["Tables"]["inventory"]["Row"];
type WarehouseInsert = Database["public"]["Tables"]["inventory"]["Insert"];

export const warehouseService = {
  async getAll() {
    const { data, error } = await supabase
      .from("inventory")
      .select("*, projects(name)")
      .eq("is_archived", false)
      .order("created_at", { ascending: false });
    
    console.log("Warehouse query:", { data, error });
    return { data: data || [], error };
  },

  async getLowStock(threshold: number = 10) {
    const { data, error } = await supabase
      .from("inventory")
      .select("*")
      .eq("is_archived", false)
      .lte("quantity", threshold)
      .order("quantity", { ascending: true });
    
    console.log("Low stock items:", { data, error });
    return { data: data || [], error };
  },

  async create(item: WarehouseInsert) {
    const { data, error } = await supabase
      .from("inventory")
      .insert(item)
      .select()
      .single();
    
    console.log("Create item:", { data, error });
    return { data, error };
  },

  async update(id: string, updates: Partial<WarehouseInsert>) {
    const { data, error } = await supabase
      .from("inventory")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    
    console.log("Update item:", { data, error });
    return { data, error };
  },

  async delete(id: string) {
    const { error } = await supabase
      .from("inventory")
      .update({ is_archived: true } as any)
      .eq("id", id);
    
    console.log("Delete item:", { error });
    return { error };
  },

  async adjustQuantity(id: string, adjustment: number) {
    const { data: current } = await supabase
      .from("inventory")
      .select("quantity")
      .eq("id", id)
      .single();
    
    if (!current) return { error: new Error("Item not found") };

    const newQuantity = current.quantity + adjustment;
    return this.update(id, { quantity: newQuantity });
  },

  async deployItem(mainItemId: string, targetProjectId: string, quantityToDeploy: number) {
    // 1. Get the original item
    const { data: mainItem } = await supabase
      .from("inventory")
      .select("*")
      .eq("id", mainItemId)
      .single();

    if (!mainItem) return { error: new Error("Item not found") };
    if (mainItem.quantity < quantityToDeploy) return { error: new Error("Insufficient quantity") };

    // 2. See if the same item already exists in that project
    const { data: existingProjectItem } = await supabase
      .from("inventory")
      .select("*")
      .eq("project_id", targetProjectId)
      .eq("name", mainItem.name)
      .eq("category", mainItem.category || "")
      .eq("unit", mainItem.unit)
      .maybeSingle();

    if (existingProjectItem) {
      // Add quantity to existing project item
      await this.update(existingProjectItem.id, { 
        quantity: existingProjectItem.quantity + quantityToDeploy 
      });
    } else {
      // Create new record for this project
      const { id, created_at, ...itemData } = mainItem;
      await this.create({
        ...itemData,
        project_id: targetProjectId,
        quantity: quantityToDeploy
      });
    }

    // 3. Create a delivery record for the target project so it lists in Site Personnel
    await supabase.from("deliveries").insert({
      project_id: targetProjectId,
      delivery_date: new Date().toISOString().split("T")[0],
      item_name: mainItem.name,
      quantity: quantityToDeploy,
      unit: mainItem.unit,
      supplier: "Main Warehouse",
      status: "pending",
      notes: "Deployed from Main Warehouse"
    });

    // 4. Deduct from main warehouse
    const remainingQuantity = mainItem.quantity - quantityToDeploy;
    if (remainingQuantity <= 0) {
      // If none left, just delete the main warehouse record
      await this.delete(mainItem.id);
    } else {
      // Update with remaining amount
      await this.update(mainItem.id, { quantity: remainingQuantity });
    }

    return { success: true };
  },

  async updateDeployment(deliveryId: string, newQuantity: number) {
    const { data: delivery } = await supabase.from('deliveries').select('*').eq('id', deliveryId).single();
    if (!delivery) throw new Error("Delivery not found");

    const diff = newQuantity - delivery.quantity;

    // Adjust main warehouse inventory
    const { data: mainItem } = await supabase.from('inventory')
      .select('*')
      .eq('name', delivery.item_name)
      .is('project_id', null)
      .maybeSingle();

    if (mainItem) {
      await this.update(mainItem.id, { quantity: mainItem.quantity - diff });
    }

    // Adjust project warehouse inventory
    const { data: projItem } = await supabase.from('inventory')
      .select('*')
      .eq('name', delivery.item_name)
      .eq('project_id', delivery.project_id)
      .maybeSingle();

    if (projItem) {
      await this.update(projItem.id, { quantity: projItem.quantity + diff });
    }

    // Update delivery record
    await supabase.from('deliveries').update({ quantity: newQuantity }).eq('id', deliveryId);
    return { success: true };
  }
};