import { NextApiRequest, NextApiResponse } from "next";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { stripe } from "@/lib/stripe";
import {
  assertSubscriptionCurrencyMatch,
  createPlanBillingSnapshot,
  toStripeUnitAmount,
  validateSnapshotAmount,
} from "@/lib/subscriptionBilling";

interface CheckoutItemInput {
  name: string;
  description?: string;
  amount: number;
  interval?: "month" | "year";
  quantity?: number;
}

interface PlanSnapshotInput {
  planId: string;
  priceAmount: number;
  currencyCode: string;
  country: string;
  billingCycle: "monthly" | "annual";
}

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function parseFeatures(value: unknown): Record<string, number> {
  if (!value) {
    return {};
  }

  const source =
    typeof value === "string"
      ? (() => {
          try {
            return JSON.parse(value) as Record<string, unknown>;
          } catch {
            return {};
          }
        })()
      : typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};

  return Object.entries(source).reduce<Record<string, number>>((accumulator, [key, rawValue]) => {
    const numericValue = Number(rawValue || 0);

    if (numericValue > 0) {
      accumulator[key] = numericValue;
    }

    return accumulator;
  }, {});
}

function validateCheckoutItems(items: unknown, currencyCode: string) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart is empty.");
  }

  const validatedItems = items.map((rawItem) => {
    const item = rawItem as CheckoutItemInput;
    const amount = validateSnapshotAmount(Number(item.amount));
    const quantity = Number(item.quantity || 1);
    const interval = item.interval === "year" ? "year" : "month";

    if (!item.name || typeof item.name !== "string") {
      throw new Error("Invalid checkout item name");
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error("Invalid checkout quantity");
    }

    return {
      name: item.name,
      description: item.description || "",
      interval,
      quantity,
      unitAmount: toStripeUnitAmount(amount, currencyCode),
    };
  });

  const totalUnitAmount = validatedItems.reduce((sum, item) => {
    return sum + item.unitAmount * item.quantity;
  }, 0);

  return { validatedItems, totalUnitAmount };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  let snapshotId: string | null = null;

  try {
    const { items, userId, email, returnUrl, metadata, proratedDiscount, currency, planSnapshot } = req.body as {
      items: unknown;
      userId?: string;
      email?: string;
      returnUrl?: string;
      metadata?: Record<string, unknown>;
      proratedDiscount?: number;
      currency?: string;
      planSnapshot?: PlanSnapshotInput;
    };

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!returnUrl || typeof returnUrl !== "string") {
      return res.status(400).json({ error: "Missing return URL" });
    }

    if (!planSnapshot) {
      return res.status(400).json({ error: "Missing billing snapshot" });
    }

    const currencyCode = assertSubscriptionCurrencyMatch(
      String(currency || planSnapshot.currencyCode || ""),
      String(planSnapshot.currencyCode || ""),
    );

    const snapshot = createPlanBillingSnapshot({
      userId,
      planId: String(planSnapshot.planId || metadata?.planId || ""),
      priceAmount: Number(planSnapshot.priceAmount),
      currencyCode,
      country: String(planSnapshot.country || metadata?.country || ""),
      billingCycle: planSnapshot.billingCycle === "annual" ? "annual" : "monthly",
    });

    const { validatedItems, totalUnitAmount } = validateCheckoutItems(items, snapshot.currencyCode);
    const discountUnitAmount = proratedDiscount
      ? toStripeUnitAmount(Number(proratedDiscount), snapshot.currencyCode)
      : 0;
    const snapshotUnitAmount = toStripeUnitAmount(snapshot.priceAmount, snapshot.currencyCode);
    const netUnitAmount = totalUnitAmount - discountUnitAmount;

    if (netUnitAmount <= 0) {
      return res.status(400).json({ error: "Invalid subscription amount" });
    }

    if (snapshotUnitAmount !== netUnitAmount) {
      return res.status(400).json({ error: "Amount mismatch detected" });
    }

    const features = parseFeatures(metadata?.features);

    const { data: snapshotRow, error: snapshotError } = await supabaseAdmin
      .from("subscription_billing_snapshots")
      .insert({
        user_id: snapshot.userId,
        plan_id: snapshot.planId,
        price_amount: snapshot.priceAmount,
        currency_code: snapshot.currencyCode,
        country: snapshot.country,
        billing_cycle: snapshot.billingCycle,
        features,
        status: "pending",
      })
      .select("id")
      .single();

    if (snapshotError || !snapshotRow) {
      throw new Error(snapshotError?.message || "Unable to create billing snapshot");
    }

    snapshotId = snapshotRow.id;

    const lineItems = validatedItems.map((item) => ({
      price_data: {
        currency: snapshot.currencyCode.toLowerCase(),
        product_data: {
          name: item.name,
          description: item.description || undefined,
        },
        unit_amount: item.unitAmount,
        recurring: {
          interval: item.interval,
        },
      },
      quantity: item.quantity,
    }));

    const sessionConfig: Stripe.Checkout.SessionCreateParams = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "subscription",
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?canceled=true`,
      customer_email: email || undefined,
      client_reference_id: userId,
      metadata: {
        snapshotId,
        userId,
        planId: snapshot.planId,
        billingCycle: snapshot.billingCycle,
        country: snapshot.country,
        currencyCode: snapshot.currencyCode,
        priceAmount: String(snapshot.priceAmount),
        features: JSON.stringify(features),
      },
    };

    if (discountUnitAmount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: discountUnitAmount,
        currency: snapshot.currencyCode.toLowerCase(),
        duration: "once",
        name: "Unused Plan Balance Credit",
      });
      sessionConfig.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    await supabaseAdmin
      .from("subscription_billing_snapshots")
      .update({
        stripe_session_id: session.id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", snapshotId);

    return res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (error: unknown) {
    if (snapshotId) {
      await supabaseAdmin
        .from("subscription_billing_snapshots")
        .update({
          status: "failed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", snapshotId);
    }

    const message = error instanceof Error ? error.message : "Unexpected Stripe checkout error";
    console.error("Stripe Checkout Error:", error);
    return res.status(500).json({ error: message });
  }
}