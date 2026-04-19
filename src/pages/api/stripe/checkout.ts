import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { plans, addOns } from "@/config/pricing";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { planId, billingCycle, features, featuresToCharge, chargeBasePlan, userId, email, returnUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw new Error("Plan not found");

    const lineItems = [];
    
    // Base Plan (Skip if chargeBasePlan is false - means they are just adding add-ons)
    const basePrice = billingCycle === "annual" ? plan.annualPrice : plan.monthlyPrice;
    const shouldChargeBase = chargeBasePlan !== undefined ? chargeBasePlan : true;

    if (basePrice > 0 && shouldChargeBase) {
      lineItems.push({
        price_data: {
          currency: "aed",
          product_data: {
            name: `${plan.name} Plan`,
            description: plan.description,
          },
          unit_amount: Math.round(basePrice * 100), // Stripe uses minor units (fils/cents)
          recurring: {
            interval: billingCycle === "annual" ? "year" : "month",
          },
        },
        quantity: 1,
      });
    }

    // Add-ons (Only charge for the NEW ones added to cart if featuresToCharge is provided)
    const addonsToCharge = featuresToCharge || features || {};
    for (const [addonId, qty] of Object.entries(addonsToCharge)) {
      const addon = addOns.find((a) => a.id === addonId);
      if (addon && (qty as number) > 0) {
        const addonPrice = billingCycle === "annual" ? addon.annualPrice : addon.monthlyPrice;
        lineItems.push({
          price_data: {
            currency: "aed",
            product_data: {
              name: `Add-on: ${addon.name}`,
            },
            unit_amount: Math.round(addonPrice * 100),
            recurring: {
              interval: billingCycle === "annual" ? "year" : "month",
            },
          },
          quantity: Number(qty),
        });
      }
    }

    if (lineItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty. No new items to charge." });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "subscription",
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?canceled=true`,
      customer_email: email,
      client_reference_id: userId,
      metadata: {
        userId,
        planId,
        billingCycle,
        features: JSON.stringify(features || {}),
      },
    });

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error("Stripe Checkout Error:", err);
    res.status(500).json({ error: err.message });
  }
}