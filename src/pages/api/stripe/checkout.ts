import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { usesStripeSubscription } from "@/config/countrySubscription";
import { addOns, getAddOnPrice, getAvailableBillingCycles, getPlanPrice, isSupportedCountry, OUT_OF_SERVICE_MESSAGE, plans } from "@/config/pricing";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { planId, billingCycle, country, features, featuresToCharge, chargeBasePlan, proratedDiscount, userId, email, returnUrl } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!isSupportedCountry(country)) {
      return res.status(400).json({ error: OUT_OF_SERVICE_MESSAGE });
    }

    if (!getAvailableBillingCycles(country).includes(billingCycle)) {
      return res.status(400).json({ error: "The selected billing cycle is not available for this country." });
    }

    if (!usesStripeSubscription(country)) {
      return res.status(400).json({ error: "The selected country uses a manual payment flow." });
    }

    const plan = plans.find((p) => p.id === planId);
    if (!plan) throw new Error("Plan not found");

    const lineItems = [];
    
    // Base Plan (Skip if chargeBasePlan is false - means they are just adding add-ons)
    const basePrice = getPlanPrice(plan, country, billingCycle);
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
        const addonPrice = getAddOnPrice(addon, country, billingCycle);
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

    const sessionConfig: any = {
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
        country,
        features: JSON.stringify(features || {}),
      },
    };

    // Apply Prorated Discount as a one-time dynamic Stripe coupon
    if (proratedDiscount && proratedDiscount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(proratedDiscount * 100), // AED in fils
        currency: "aed",
        duration: "once",
        name: "Unused Plan Balance Credit",
      });
      sessionConfig.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    res.status(200).json({ sessionId: session.id, url: session.url });
  } catch (err: any) {
    console.error("Stripe Checkout Error:", err);
    res.status(500).json({ error: err.message });
  }
}