import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type ApprovalNotificationInsert = Database["public"]["Tables"]["approval_notifications"]["Insert"];
type ApprovalNotificationReadInsert = Database["public"]["Tables"]["approval_notification_reads"]["Insert"];

export interface ApprovalNotificationInput {
  approvalRequestId?: string | null;
  audienceModule: string;
  targetSurface: string;
  eventType: string;
  title: string;
  message: string;
  payload?: Database["public"]["Tables"]["approval_notifications"]["Row"]["payload"];
}

export interface UnreadNotificationSummary {
  approvalCenter: number;
  sitePersonnel: number;
  purchasing: number;
  accounting: number;
}

function getUniqueModules(modules: string[]) {
  return Array.from(new Set(modules.filter(Boolean)));
}

async function getCurrentUserId() {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user?.id ?? null;
}

export const notificationService = {
  async createNotification(input: ApprovalNotificationInput) {
    const notification: ApprovalNotificationInsert = {
      approval_request_id: input.approvalRequestId ?? null,
      audience_module: input.audienceModule,
      target_surface: input.targetSurface,
      event_type: input.eventType,
      title: input.title,
      message: input.message,
      payload: input.payload ?? {},
    };

    const { data, error } = await supabase
      .from("approval_notifications")
      .insert(notification)
      .select("id")
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data;
  },

  async listUnreadCounts(modules: string[]): Promise<UnreadNotificationSummary> {
    const normalizedModules = getUniqueModules(modules);

    if (normalizedModules.length === 0) {
      return { approvalCenter: 0, sitePersonnel: 0, purchasing: 0, accounting: 0 };
    }

    const userId = await getCurrentUserId();

    if (!userId) {
      return { approvalCenter: 0, sitePersonnel: 0, purchasing: 0, accounting: 0 };
    }

    const { data: notifications, error } = await supabase
      .from("approval_notifications")
      .select("id, target_surface")
      .in("audience_module", normalizedModules);

    if (error) {
      throw error;
    }

    const notificationIds = (notifications || []).map((notification) => notification.id);

    if (notificationIds.length === 0) {
      return { approvalCenter: 0, sitePersonnel: 0, purchasing: 0, accounting: 0 };
    }

    const { data: reads, error: readsError } = await supabase
      .from("approval_notification_reads")
      .select("notification_id")
      .eq("user_id", userId)
      .in("notification_id", notificationIds);

    if (readsError) {
      throw readsError;
    }

    const readIds = new Set((reads || []).map((read) => read.notification_id));

    return (notifications || []).reduce<UnreadNotificationSummary>(
      (summary, notification) => {
        if (readIds.has(notification.id)) {
          return summary;
        }

        if (notification.target_surface === "Approval Center") {
          summary.approvalCenter += 1;
        }

        if (notification.target_surface === "Site Personnel") {
          summary.sitePersonnel += 1;
        }

        if (notification.target_surface === "Purchasing") {
          summary.purchasing += 1;
        }

        if (notification.target_surface === "Accounting") {
          summary.accounting += 1;
        }

        return summary;
      },
      { approvalCenter: 0, sitePersonnel: 0, purchasing: 0, accounting: 0 }
    );
  },

  async markSurfaceAsRead(targetSurface: string, modules: string[]) {
    const normalizedModules = getUniqueModules(modules);

    if (normalizedModules.length === 0) {
      return;
    }

    const userId = await getCurrentUserId();

    if (!userId) {
      return;
    }

    const { data: notifications, error } = await supabase
      .from("approval_notifications")
      .select("id")
      .eq("target_surface", targetSurface)
      .in("audience_module", normalizedModules);

    if (error) {
      throw error;
    }

    const notificationIds = (notifications || []).map((notification) => notification.id);

    if (notificationIds.length === 0) {
      return;
    }

    const { data: existingReads, error: existingReadsError } = await supabase
      .from("approval_notification_reads")
      .select("notification_id")
      .eq("user_id", userId)
      .in("notification_id", notificationIds);

    if (existingReadsError) {
      throw existingReadsError;
    }

    const existingReadIds = new Set((existingReads || []).map((read) => read.notification_id));
    const unreadInserts: ApprovalNotificationReadInsert[] = notificationIds
      .filter((notificationId) => !existingReadIds.has(notificationId))
      .map((notificationId) => ({
        notification_id: notificationId,
        user_id: userId,
      }));

    if (unreadInserts.length === 0) {
      return;
    }

    const { error: insertError } = await supabase
      .from("approval_notification_reads")
      .upsert(unreadInserts, { onConflict: "notification_id,user_id" });

    if (insertError) {
      throw insertError;
    }
  },
};