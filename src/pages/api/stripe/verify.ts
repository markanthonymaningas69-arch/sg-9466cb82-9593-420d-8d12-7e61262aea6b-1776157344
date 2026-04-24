import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import { stripe } from "@/lib/stripe";
import {
  assertSubscriptionCurrencyMatch,
  toStripeUnitAmount,
  validateSnapshotAmount,
} from "@/lib/subscriptionBilling";
import { activateSubscription } from "@/lib/subscriptionPersistence";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function parseFeatures(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object") {
    return {};
  }

  return Object.entries(value as Record<string, unknown>).reduce<Record<string, number>>((accumulator, [key, rawValue]) => {
    const numericValue = Number(rawValue || 0);

    if (numericValue > 0) {
      accumulator[key] = numericValue;
    }

    return accumulator;
  }, {});
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { sessionId } = req.body as { sessionId?: string };

  if (!sessionId) {
    return res.status(400).json({ error: "No session ID provided" });
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return res.status(400).json({ error: "Payment not completed" });
    }

    const snapshotId = session.metadata?.snapshotId;

    if (!snapshotId) {
      return res.status(400).json({ error: "Missing billing snapshot" });
    }

    const { data: existingTransaction } = await supabaseAdmin
      .from("stripe_subscription_transactions")
      .select("id, plan_id")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();

    if (existingTransaction) {
      return res.status(200).json({ success: true, plan: existingTransaction.plan_id });
    }

    const { data: snapshot, error: snapshotError } = await supabaseAdmin
      .from("subscription_billing_snapshots")
      .select("*")
      .eq("id", snapshotId)
      .maybeSingle();

    if (snapshotError || !snapshot) {
      return res.status(404).json({ error: snapshotError?.message || "Billing snapshot not found" });
    }

    if (!snapshot.user_id) {
      return res.status(400).json({ error: "Billing snapshot is missing a user" });
    }

    if (session.client_reference_id && session.client_reference_id !== snapshot.user_id) {
      return res.status(400).json({ error: "Snapshot user mismatch detected" });
    }

    if (session.metadata?.planId && session.metadata.planId !== snapshot.plan_id) {
      return res.status(400).json({ error: "Plan mismatch detected" });
    }

    const normalizedCurrency = assertSubscriptionCurrencyMatch(
      String(session.currency || ""),
      String(snapshot.currency_code || ""),
    );
    const snapshotAmount = validateSnapshotAmount(Number(snapshot.price_amount));
    const sessionAmount = Number(session.amount_total || 0);

    if (toStripeUnitAmount(snapshotAmount, normalizedCurrency) !== sessionAmount) {
      return res.status(400).json({ error: "Amount mismatch detected" });
    }

    const features = parseFeatures(snapshot.features);

    await activateSubscription({
      userId: snapshot.user_id,
      planId: snapshot.plan_id,
      billingCycle: snapshot.billing_cycle === "annual" ? "annual" : "monthly",
      amount: snapshotAmount,
      features,
      stripeCustomerId: session.customer ? String(session.customer) : null,
      stripeSubscriptionId: session.subscription ? String(session.subscription) : null,
    });

    const { error: transactionError } = await supabaseAdmin
      .from("stripe_subscription_transactions")
      .upsert(
        {
          user_id: snapshot.user_id,
          snapshot_id: snapshot.id,
          plan_id: snapshot.plan_id,
          amount: snapshotAmount,
          currency_code: normalizedCurrency,
          country: snapshot.country,
          stripe_session_id: session.id,
          stripe_payment_intent_id: session.payment_intent ? String(session.payment_intent) : null,
          stripe_subscription_id: session.subscription ? String(session.subscription) : null,
          status: "paid",
        },
        { onConflict: "stripe_session_id" },
      );

    if (transactionError) {
      throw transactionError;
    }

    const { error: snapshotUpdateError } = await supabaseAdmin
      .from("subscription_billing_snapshots")
      .update({
        stripe_session_id: session.id,
        status: "paid",
        updated_at: new Date().toISOString(),
      })
      .eq("id", snapshot.id);

    if (snapshotUpdateError) {
      throw snapshotUpdateError;
    }

    return res.status(200).json({ success: true, plan: snapshot.plan_id });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unexpected Stripe verification error";
    console.error("Verify API Error:", error);
    return res.status(500).json({ error: message });
  }
}