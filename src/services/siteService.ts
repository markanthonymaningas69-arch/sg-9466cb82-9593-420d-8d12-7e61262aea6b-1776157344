import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SiteAttendance = Database["public"]["Tables"]["site_attendance"]["Row"];
type SiteAttendanceInsert = Database["public"]["Tables"]["site_attendance"]["Insert"];
type Delivery = Database["public"]["Tables"]["deliveries"]["Row"] & { receipt_number?: string };
type DeliveryInsert = Database["public"]["Tables"]["deliveries"]["Insert"] & { receipt_number?: string };
type ScopeOfWork = Database["public"]["Tables"]["bom_scope_of_work"]["Row"];
type ScopeOfWorkInsert = Database["public"]["Tables"]["bom_scope_of_work"]["Insert"];
type ProgressUpdate = Database["public"]["Tables"]["bom_progress_updates"]["Row"];
type ProgressUpdateInsert = Database["public"]["Tables"]["bom_progress_updates"]["Insert"];

export interface SitePersonnelRecycleBinItem {
  id: string;
  sourceTable: "deliveries" | "material_consumption" | "site_attendance" | "bom_progress_updates" | "site_requests";
  sourceTab: "Deliveries" | "Usage" | "Attendance" | "Accomplishments" | "Requests";
  recordType: string;
  title: string;
  description: string;
  deletedAt: string | null;
  createdAt: string | null;
}

export interface WarehouseMaterialLedgerItem {
  key: string;
  inventoryId: string | null;
  name: string;
  unit: string;
  scopeNames: string[];
  category: string | null;
  lastRestocked: string | null;
  totalRestock: number;
  totalUsage: number;
  expectedRemaining: number;
  recordedRemaining: number | null;
  missingExcess: number | null;
  varianceStatus: "balanced" | "missing" | "excess" | "uncounted";
}

function getRelatedScopeName(
  relation: { name?: string | null } | Array<{ name?: string | null }> | null | undefined
) {
  if (Array.isArray(relation)) {
    return relation[0]?.name || null;
  }

  return relation?.name || null;
}

function buildWarehouseLedgerKey(itemName: string, unit: string) {
  return [itemName.trim().toLowerCase(), unit.trim().toLowerCase()].join("__");
}

async function resolveInventoryCategory(itemName: string) {
  const { data } = await supabase
    .from("master_items")
    .select("category")
    .ilike("name", itemName)
    .maybeSingle();

  return data?.category || "Construction Materials";
}

async function adjustProjectInventoryBalance(params: {
  projectId: string | null;
  itemName: string;
  unit: string;
  quantityDelta: number;
}) {
  const { projectId, itemName, unit, quantityDelta } = params;

  if (!projectId || !itemName || !unit || !quantityDelta) {
    return;
  }

  const normalizedDelta = Number(quantityDelta);

  const { data: existing } = await supabase
    .from("inventory")
    .select("*")
    .eq("project_id", projectId)
    .eq("name", itemName)
    .eq("unit", unit)
    .eq("is_archived", false)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("inventory")
      .update({ quantity: Number(existing.quantity || 0) + normalizedDelta })
      .eq("id", existing.id);

    return;
  }

  const category = await resolveInventoryCategory(itemName);

  await supabase.from("inventory").insert({
    project_id: projectId,
    name: itemName,
    category,
    quantity: normalizedDelta,
    unit,
    unit_cost: 0,
  });
}

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
      .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
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
      .eq("is_archived", false)
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
      .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
      .eq("id", id);
    
    return { error };
  },

  // Deliveries Management
  async getDeliveries(projectId: string, dateFilter?: string) {
    let query = supabase
      .from("deliveries")
      .select("*, projects(name), bom_scope_of_work(name)")
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
      .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
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

    if (data && !error) {
      await adjustProjectInventoryBalance({
        projectId: data.project_id,
        itemName: data.item_name,
        unit: data.unit,
        quantityDelta: -Number(data.quantity || 0),
      });
    }
    
    return { data, error };
  },

  // Site Requests Management
  async createSiteRequest(request: any) {
    // Check auto-approve setting from the user's company profile
    let autoApprove = false;
    const { data: userProfile } = await supabase.auth.getUser();
    
    if (userProfile?.user?.id) {
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', userProfile.user.id).single();
      if (profile?.company_id) {
        const { data: compSettings } = await supabase.from('company_settings').select('auto_approve_materials').eq('id', profile.company_id).single();
        if (compSettings?.auto_approve_materials) {
          autoApprove = true;
        }
      }
    }

    // Apply the automation status if enabled
    const finalRequest = {
      ...request,
      status: autoApprove ? 'approved' : 'pending'
    };

    const { data, error } = await supabase
      .from("site_requests")
      .insert(finalRequest)
      .select()
      .single();
      
    return { data, error, autoApproved: autoApprove };
  },

  async deleteSiteRequest(id: string) {
    const { error } = await supabase
      .from("site_requests")
      .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
      .eq("id", id);

    return { error };
  },

  async updateMaterialConsumption(id: string, updates: any) {
    const { data: existing } = await supabase
      .from("material_consumption")
      .select("project_id, item_name, unit, quantity")
      .eq("id", id)
      .maybeSingle();

    const { data, error } = await supabase
      .from("material_consumption")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (data && existing && !error) {
      await adjustProjectInventoryBalance({
        projectId: existing.project_id,
        itemName: existing.item_name,
        unit: existing.unit,
        quantityDelta: Number(existing.quantity || 0),
      });

      await adjustProjectInventoryBalance({
        projectId: data.project_id,
        itemName: data.item_name,
        unit: data.unit,
        quantityDelta: -Number(data.quantity || 0),
      });
    }
    
    return { data, error };
  },

  async deleteMaterialConsumption(id: string) {
    const { data: existing } = await supabase
      .from("material_consumption")
      .select("project_id, item_name, unit, quantity")
      .eq("id", id)
      .maybeSingle();

    const { error } = await supabase
      .from("material_consumption")
      .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
      .eq("id", id);

    if (existing && !error) {
      await adjustProjectInventoryBalance({
        projectId: existing.project_id,
        itemName: existing.item_name,
        unit: existing.unit,
        quantityDelta: Number(existing.quantity || 0),
      });
    }
    
    return { error };
  },

  async getWarehouseMaterialLedger(projectId: string) {
    const [deliveriesResult, usageResult, inventoryResult] = await Promise.all([
      supabase
        .from("deliveries")
        .select("id, item_name, quantity, unit, delivery_date, transaction_type, bom_scope_of_work(name)")
        .eq("project_id", projectId)
        .eq("is_archived", false),
      supabase
        .from("material_consumption")
        .select("id, item_name, quantity, unit, date_used, bom_scope_of_work(name)")
        .eq("project_id", projectId)
        .eq("is_archived", false),
      supabase
        .from("inventory")
        .select("id, name, category, quantity, unit, last_restocked")
        .eq("project_id", projectId)
        .eq("is_archived", false),
    ]);

    if (deliveriesResult.error) {
      return { data: [], error: deliveriesResult.error };
    }

    if (usageResult.error) {
      return { data: [], error: usageResult.error };
    }

    if (inventoryResult.error) {
      return { data: [], error: inventoryResult.error };
    }

    const ledger = new Map<string, WarehouseMaterialLedgerItem>();

    const getOrCreateItem = (itemName: string, unit: string) => {
      const normalizedName = itemName.trim();
      const normalizedUnit = unit.trim();
      const key = buildWarehouseLedgerKey(normalizedName, normalizedUnit);

      if (!ledger.has(key)) {
        ledger.set(key, {
          key,
          inventoryId: null,
          name: normalizedName,
          unit: normalizedUnit,
          scopeNames: [],
          category: null,
          lastRestocked: null,
          totalRestock: 0,
          totalUsage: 0,
          expectedRemaining: 0,
          recordedRemaining: null,
          missingExcess: null,
          varianceStatus: "uncounted",
        });
      }

      return ledger.get(key)!;
    };

    for (const record of deliveriesResult.data || []) {
      if (!record.item_name) {
        continue;
      }

      const item = getOrCreateItem(record.item_name, record.unit || "");
      item.totalRestock += Number(record.quantity || 0);

      const scopeName = getRelatedScopeName(record.bom_scope_of_work);
      if (scopeName && !item.scopeNames.includes(scopeName)) {
        item.scopeNames.push(scopeName);
      }

      if (record.delivery_date && (!item.lastRestocked || record.delivery_date > item.lastRestocked)) {
        item.lastRestocked = record.delivery_date;
      }
    }

    for (const record of usageResult.data || []) {
      if (!record.item_name) {
        continue;
      }

      const item = getOrCreateItem(record.item_name, record.unit || "");
      item.totalUsage += Number(record.quantity || 0);

      const scopeName = getRelatedScopeName(record.bom_scope_of_work);
      if (scopeName && !item.scopeNames.includes(scopeName)) {
        item.scopeNames.push(scopeName);
      }
    }

    for (const record of inventoryResult.data || []) {
      if (!record.name) {
        continue;
      }

      const item = getOrCreateItem(record.name, record.unit || "");
      item.inventoryId = record.id;
      item.category = record.category || item.category;
      item.lastRestocked = record.last_restocked || item.lastRestocked;
      item.recordedRemaining = Number(record.quantity || 0);
    }

    const data = Array.from(ledger.values())
      .map((item) => {
        const expectedRemaining = item.totalRestock - item.totalUsage;

        if (item.recordedRemaining === null) {
          return {
            ...item,
            scopeNames: [...item.scopeNames].sort((a, b) => a.localeCompare(b)),
            expectedRemaining,
            missingExcess: null,
            varianceStatus: "uncounted" as const,
          };
        }

        const rawVariance = Number((item.recordedRemaining - expectedRemaining).toFixed(2));
        const varianceStatus =
          rawVariance === 0 ? "balanced" : rawVariance > 0 ? "excess" : "missing";

        return {
          ...item,
          scopeNames: [...item.scopeNames].sort((a, b) => a.localeCompare(b)),
          expectedRemaining,
          missingExcess: Math.abs(rawVariance),
          varianceStatus,
        };
      })
      .sort((left, right) => left.name.localeCompare(right.name));

    return { data, error: null };
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
      .eq("is_archived", false)
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
      .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
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
      .update({ is_archived: true, archived_at: new Date().toISOString() } as any)
      .eq("id", id);
    return { error };
  },

  async getRecycleBinItems(projectId: string) {
    const [deliveriesResult, usageResult, attendanceResult, progressResult, siteRequestsResult] = await Promise.all([
      supabase
        .from("deliveries")
        .select("id, item_name, quantity, unit, supplier, delivery_date, archived_at, created_at")
        .eq("project_id", projectId)
        .eq("is_archived", true),
      supabase
        .from("material_consumption")
        .select("id, item_name, quantity, unit, date_used, archived_at, created_at")
        .eq("project_id", projectId)
        .eq("is_archived", true),
      supabase
        .from("site_attendance")
        .select("id, date, status, hours_worked, overtime_hours, archived_at, created_at, personnel(name, role)")
        .eq("project_id", projectId)
        .eq("is_archived", true),
      supabase
        .from("bom_progress_updates")
        .select("id, update_date, percentage_completed, archived_at, created_at, bom_scope_of_work(name)")
        .eq("is_archived", true)
        .in(
          "bom_scope_id",
          (
            await supabase
              .from("bom_scope_of_work")
              .select("id")
              .eq(
                "bom_id",
                (
                  await supabase
                    .from("bill_of_materials")
                    .select("id")
                    .eq("project_id", projectId)
                    .maybeSingle()
                ).data?.id || "00000000-0000-0000-0000-000000000000"
              )
          ).data?.map((scope) => scope.id) || []
        ),
      supabase
        .from("site_requests")
        .select("id, request_type, item_name, quantity, unit, requested_by, request_date, archived_at, created_at")
        .eq("project_id", projectId)
        .eq("is_archived", true),
    ]);

    if (deliveriesResult.error) {
      return { data: [], error: deliveriesResult.error };
    }

    if (usageResult.error) {
      return { data: [], error: usageResult.error };
    }

    if (attendanceResult.error) {
      return { data: [], error: attendanceResult.error };
    }

    if (progressResult.error) {
      return { data: [], error: progressResult.error };
    }

    if (siteRequestsResult.error) {
      return { data: [], error: siteRequestsResult.error };
    }

    const attendanceItems: SitePersonnelRecycleBinItem[] = (attendanceResult.data || []).map((record) => {
      const relatedPersonnel = Array.isArray(record.personnel) ? record.personnel[0] : record.personnel;

      return {
        id: record.id,
        sourceTable: "site_attendance",
        sourceTab: "Attendance",
        recordType: "Attendance record",
        title: relatedPersonnel?.name || "Unknown worker",
        description: `${record.date || "No date"} • ${record.status || "present"} • ${Number(record.hours_worked || 0)}h + ${Number(record.overtime_hours || 0)}h OT`,
        deletedAt: record.archived_at || null,
        createdAt: record.created_at || null,
      };
    });

    const progressItems: SitePersonnelRecycleBinItem[] = (progressResult.data || []).map((record) => {
      const relatedScope = Array.isArray(record.bom_scope_of_work) ? record.bom_scope_of_work[0] : record.bom_scope_of_work;

      return {
        id: record.id,
        sourceTable: "bom_progress_updates",
        sourceTab: "Accomplishments",
        recordType: "Progress update",
        title: relatedScope?.name || "Scope update",
        description: `${Number(record.percentage_completed || 0)}% completed • ${record.update_date || "No date"}`,
        deletedAt: record.archived_at || null,
        createdAt: record.created_at || null,
      };
    });

    const data: SitePersonnelRecycleBinItem[] = [
      ...(deliveriesResult.data || []).map((record) => ({
        id: record.id,
        sourceTable: "deliveries" as const,
        sourceTab: "Deliveries" as const,
        recordType: "Delivery record",
        title: record.item_name,
        description: `${Number(record.quantity || 0)} ${record.unit || ""} • ${record.supplier || "No supplier"} • ${record.delivery_date || "No date"}`,
        deletedAt: record.archived_at || null,
        createdAt: record.created_at || null,
      })),
      ...(usageResult.data || []).map((record) => ({
        id: record.id,
        sourceTable: "material_consumption" as const,
        sourceTab: "Usage" as const,
        recordType: "Material usage",
        title: record.item_name,
        description: `${Number(record.quantity || 0)} ${record.unit || ""} • ${record.date_used || "No date"}`,
        deletedAt: record.archived_at || null,
        createdAt: record.created_at || null,
      })),
      ...(siteRequestsResult.data || []).map((record) => ({
        id: record.id,
        sourceTable: "site_requests" as const,
        sourceTab: "Requests" as const,
        recordType: "Site request",
        title: record.item_name,
        description: `${record.request_type || "Request"} • ${Number(record.quantity || 0)} ${record.unit || ""} • ${record.requested_by || "No requester"} • ${record.request_date || "No date"}`,
        deletedAt: record.archived_at || null,
        createdAt: record.created_at || null,
      })),
      ...attendanceItems,
      ...progressItems,
    ].sort((left, right) => {
      const leftTime = new Date(left.deletedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.deletedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });

    return { data, error: null };
  },

  async restoreRecycleBinItem(item: Pick<SitePersonnelRecycleBinItem, "id" | "sourceTable">) {
    if (item.sourceTable === "deliveries") {
      return await supabase
        .from("deliveries")
        .update({ is_archived: false, archived_at: null } as any)
        .eq("id", item.id);
    }

    if (item.sourceTable === "material_consumption") {
      const { data: existing } = await supabase
        .from("material_consumption")
        .select("project_id, item_name, unit, quantity")
        .eq("id", item.id)
        .maybeSingle();

      const result = await supabase
        .from("material_consumption")
        .update({ is_archived: false, archived_at: null } as any)
        .eq("id", item.id);

      if (!result.error && existing) {
        await adjustProjectInventoryBalance({
          projectId: existing.project_id,
          itemName: existing.item_name,
          unit: existing.unit,
          quantityDelta: -Number(existing.quantity || 0),
        });
      }

      return result;
    }

    if (item.sourceTable === "site_requests") {
      return await supabase
        .from("site_requests")
        .update({ is_archived: false, archived_at: null } as any)
        .eq("id", item.id);
    }

    if (item.sourceTable === "site_attendance") {
      return await supabase
        .from("site_attendance")
        .update({ is_archived: false, archived_at: null } as any)
        .eq("id", item.id);
    }

    return await supabase
      .from("bom_progress_updates")
      .update({ is_archived: false, archived_at: null } as any)
      .eq("id", item.id);
  },

  async permanentlyDeleteRecycleBinItem(item: Pick<SitePersonnelRecycleBinItem, "id" | "sourceTable">) {
    if (item.sourceTable === "deliveries") {
      return await supabase.from("deliveries").delete().eq("id", item.id);
    }

    if (item.sourceTable === "material_consumption") {
      return await supabase.from("material_consumption").delete().eq("id", item.id);
    }

    if (item.sourceTable === "site_requests") {
      return await supabase.from("site_requests").delete().eq("id", item.id);
    }

    if (item.sourceTable === "site_attendance") {
      return await supabase.from("site_attendance").delete().eq("id", item.id);
    }

    return await supabase.from("bom_progress_updates").delete().eq("id", item.id);
  }
};