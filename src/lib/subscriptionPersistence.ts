import { createClient } from "@supabase/supabase-js";
import type { BillingCycle } from "@/config/pricing";

type SubscriptionPlan = "starter" | "professional" | "trial";
type SubscriptionStatus = "active" | "cancelled" | "expired";

export interface ActivateSubscriptionInput {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  amount: number;
  features?: Record<string, number>;
  status?: SubscriptionStatus;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

function toDateOnly(value: Date): string {
  return value.toISOString().split("T")[0];
}

function getEndDate(startDate: Date, billingCycle: BillingCycle): Date {
  const endDate = new Date(startDate);

  if (billingCycle === "annual") {
    endDate.setFullYear(endDate.getFullYear() + 1);
    return endDate;
  }

  endDate.setMonth(endDate.getMonth() + 1);
  return endDate;
}

function normalizePlan(planId: string): SubscriptionPlan {
  if (planId === "professional") {
    return "professional";
  }

  if (planId === "trial") {
    return "trial";
  }

  return "starter";
}

function sanitizeFeatures(features?: Record<string, number>): Record<string, number> {
  if (!features) {
    return {};
  }

  return Object.entries(features).reduce<Record<string, number>>((accumulator, [key, value]) => {
    const numericValue = Number(value || 0);

    if (numericValue > 0) {
      accumulator[key] = numericValue;
    }

    return accumulator;
  }, {});
}

export async function activateSubscription(input: ActivateSubscriptionInput) {
  const now = new Date();
  const endDate = getEndDate(now, input.billingCycle);
  const plan = normalizePlan(input.planId);
  const features = sanitizeFeatures(input.features);

  const { error: previousSubscriptionError } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "cancelled" })
    .eq("user_id", input.userId)
    .eq("status", "active");

  if (previousSubscriptionError) {
    throw previousSubscriptionError;
  }

  const { error: insertError } = await supabaseAdmin
    .from("subscriptions")
    .insert({
      user_id: input.userId,
      plan,
      status: input.status || "active",
      start_date: toDateOnly(now),
      end_date: toDateOnly(endDate),
      amount: Number(input.amount || 0),
      features,
      stripe_customer_id: input.stripeCustomerId || null,
      stripe_subscription_id: input.stripeSubscriptionId || null
    });

  if (insertError) {
    throw insertError;
  }

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({
      subscription_start_date: toDateOnly(now),
      subscription_end_date: toDateOnly(endDate)
    })
    .eq("id", input.userId);

  if (profileError) {
    throw profileError;
  }

  return {
    plan,
    startDate: toDateOnly(now),
    endDate: toDateOnly(endDate),
    features
  };
}