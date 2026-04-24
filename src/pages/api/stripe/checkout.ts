import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { items, userId, email, returnUrl, metadata, proratedDiscount, currency } = req.body;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const lineItems = items.map((item: any) => ({
      price_data: {
        currency: currency.toLowerCase(),
        product_data: {
          name: item.name,
          description: item.description || undefined,
        },
        unit_amount: Math.round(item.amount * 100),
        recurring: {
          interval: item.interval || "month",
        },
      },
      quantity: item.quantity || 1,
    }));

    if (lineItems.length === 0) {
      return res.status(400).json({ error: "Cart is empty." });
    }

    const sessionConfig: any = {
      payment_method_types: ["card"],
      line_items: lineItems,
      mode: "subscription",
      success_url: `${returnUrl}?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${returnUrl}?canceled=true`,
      customer_email: email,
      client_reference_id: userId,
      metadata: metadata || {},
    };

    if (proratedDiscount && proratedDiscount > 0) {
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(proratedDiscount * 100),
        currency: currency.toLowerCase(),
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