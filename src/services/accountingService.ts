import { supabase } from "@/integrations/supabase/client";
import { approvalCenterService } from "@/services/approvalCenterService";

function normalizeServiceError(error: unknown) {
  if (error instanceof Error) {
    return error;
  }

  return new Error("Approval Center synchronization failed.");
}

async function getApprovalRequesterName() {
  const { data: authData } = await supabase.auth.getUser();

  if (!authData.user) {
    return "Unknown User";
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email")
    .eq("id", authData.user.id)
    .maybeSingle();

  return profile?.full_name || profile?.email || authData.user.email || "Unknown User";
}

function buildVoucherSummary(voucher: any) {
  return `${String(voucher.type || "payment").toUpperCase()} ${voucher.voucher_number || "Draft"} • ${voucher.payee || "No payee"} • ${Number(voucher.amount || 0).toFixed(2)}`;
}

function buildLiquidationSummary(liquidation: any) {
  return `Liquidation • ${liquidation.submitted_by || "Unknown Employee"} • ${Number(liquidation.advance_amount || 0).toFixed(2)}`;
}

export const accountingService = {
  async getJournalEntries(projectId?: string) {
    let query = supabase
      .from("accounting_transactions")
      .select("*, projects(name)")
      .order("date", { ascending: false });

    if (projectId) {
      if (projectId === "office") {
        query = query.is("project_id", null);
      } else {
        query = query.eq("project_id", projectId);
      }
    }

    const { data, error } = await query;
    return { data: data || [], error };
  },

  async createJournalEntry(entry: any) {
    const { data, error } = await supabase
      .from("accounting_transactions")
      .insert(entry)
      .select()
      .single();
    return { data, error };
  },

  async updateJournalEntry(id: string, entry: any) {
    const { data, error } = await supabase
      .from("accounting_transactions")
      .update(entry)
      .eq("id", id)
      .select()
      .single();
    return { data, error };
  },

  async deleteJournalEntry(id: string) {
    const { error } = await supabase
      .from("accounting_transactions")
      .delete()
      .eq("id", id);
    return { error };
  },

  async getDashboardSummary() {
    const { data, error } = await supabase
      .from("accounting_transactions")
      .select("type, amount, tax_amount");

    if (error) {
      return { data: null, error };
    }

    let totalDebits = 0;
    let totalCredits = 0;
    let totalTax = 0;

    data.forEach((entry: any) => {
      if (entry.type === "debit") {
        totalDebits += Number(entry.amount);
      }
      if (entry.type === "credit") {
        totalCredits += Number(entry.amount);
      }
      totalTax += Number(entry.tax_amount || 0);
    });

    return {
      data: {
        totalDebits,
        totalCredits,
        totalTax,
        balance: totalDebits - totalCredits,
      },
      error: null,
    };
  },

  async getVouchers() {
    const { data, error } = await supabase
      .from("vouchers")
      .select("*")
      .neq("status", "archived")
      .order("date", { ascending: false });
    return { data: data || [], error };
  },

  async archiveVoucher(id: string) {
    const { error } = await supabase
      .from("vouchers")
      .update({ status: "archived" })
      .eq("id", id);
    return { error };
  },

  async createVoucher(voucher: any) {
    const payload = {
      ...voucher,
      status: voucher.status || "pending",
    };

    const { data, error } = await supabase
      .from("vouchers")
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      return { data, error };
    }

    if (data.status !== "pending") {
      return { data, error: null };
    }

    try {
      const requestedBy = await getApprovalRequesterName();

      await approvalCenterService.createRequest({
        sourceModule: "Accounting",
        sourceTable: "vouchers",
        sourceRecordId: data.id,
        requestType: "Voucher Approval",
        requestedBy,
        projectId: data.project_id,
        summary: buildVoucherSummary(data),
        latestComment: data.description || null,
        payload: {
          voucher_number: data.voucher_number,
          type: data.type,
          payee: data.payee,
          amount: data.amount,
          date: data.date,
        },
      });

      return { data, error: null };
    } catch (approvalError) {
      await supabase.from("vouchers").delete().eq("id", data.id);
      return { data: null, error: normalizeServiceError(approvalError) };
    }
  },

  async getLiquidations() {
    const { data, error } = await supabase
      .from("liquidations")
      .select("*")
      .order("date", { ascending: false });
    return { data: data || [], error };
  },

  async createLiquidation(liquidation: any) {
    const payload = {
      ...liquidation,
      status: liquidation.status || "pending",
    };

    const { data, error } = await supabase
      .from("liquidations")
      .insert(payload)
      .select()
      .single();

    if (error || !data) {
      return { data, error };
    }

    if (data.status !== "pending") {
      return { data, error: null };
    }

    try {
      const requestedBy = await getApprovalRequesterName();

      await approvalCenterService.createRequest({
        sourceModule: "Accounting",
        sourceTable: "liquidations",
        sourceRecordId: data.id,
        requestType: "Liquidation Approval",
        requestedBy,
        projectId: data.project_id,
        summary: buildLiquidationSummary(data),
        latestComment: data.purpose || null,
        payload: {
          date: data.date,
          advance_amount: data.advance_amount,
          actual_amount: data.actual_amount,
          submitted_by: data.submitted_by,
        },
      });

      return { data, error: null };
    } catch (approvalError) {
      await supabase.from("liquidations").delete().eq("id", data.id);
      return { data: null, error: normalizeServiceError(approvalError) };
    }
  },

  async updateLiquidation(id: string, updates: any) {
    const { data, error } = await supabase
      .from("liquidations")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return { data, error };
    }

    if (data.status !== "pending") {
      return { data, error: null };
    }

    try {
      const requestedBy = await getApprovalRequesterName();

      await approvalCenterService.createRequest({
        sourceModule: "Accounting",
        sourceTable: "liquidations",
        sourceRecordId: data.id,
        requestType: "Liquidation Approval",
        requestedBy,
        projectId: data.project_id,
        summary: buildLiquidationSummary(data),
        latestComment: data.purpose || null,
        payload: {
          date: data.date,
          advance_amount: data.advance_amount,
          actual_amount: data.actual_amount,
          submitted_by: data.submitted_by,
        },
      });

      return { data, error: null };
    } catch (approvalError) {
      return { data, error: normalizeServiceError(approvalError) };
    }
  },

  async deleteLiquidation(id: string) {
    const { error } = await supabase
      .from("liquidations")
      .delete()
      .eq("id", id);
    return { error };
  },

  async getPayrollData(startDate: string, endDate: string, projectId?: string) {
    let query = supabase
      .from("site_attendance")
      .select("date, hours_worked, overtime_hours, personnel(id, name, role, daily_rate, overtime_rate), projects(id, name)")
      .eq("status", "present")
      .gte("date", startDate)
      .lte("date", endDate);

    if (projectId && projectId !== "all") {
      query = query.eq("project_id", projectId);
    }

    const { data, error } = await query;
    return { data: data || [], error };
  },

  async getSummary(projectId?: string) {
    return {
      data: {
        totalIncome: 0,
        totalExpense: 0,
        pending: 0,
        completed: 0,
      },
      error: null,
    };
  },
};