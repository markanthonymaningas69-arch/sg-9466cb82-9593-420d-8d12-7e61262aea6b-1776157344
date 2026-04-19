import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";
import { buffer } from "micro";
import Stripe from "stripe";

export const config = {
  api: { bodyParser: false },
};

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).send("Method not allowed");

  const sig = req.headers["stripe-signature"] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event: Stripe.Event;

  try {
    const reqBuffer = await buffer(req);
    
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(reqBuffer, sig, webhookSecret);
    } else {
      // Allow unverified testing if no secret is set (NOT recommended for production)
      const payloadString = reqBuffer.toString('utf8');
      event = JSON.parse(payloadString) as Stripe.Event;
      console.warn("⚠️ STRIPE_WEBHOOK_SECRET is not set! Skipping signature verification.");
    }
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id;
        const metadata = session.metadata || {};
        
        if (userId) {
          const now = new Date();
          const expiresAt = new Date();
          if (metadata.billingCycle === 'annual') {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
          }

          const features = metadata.features ? JSON.parse(metadata.features) : {};

          await supabaseAdmin.from("subscriptions").insert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: session.subscription as string,
            plan: metadata.planId || 'starter',
            status: "active",
            start_date: now.toISOString(),
            end_date: expiresAt.toISOString(),
            amount: (session.amount_total || 0) / 100,
            features: features,
          });
        }
        break;
      }
      
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        // Find existing record by stripe_subscription_id to update status
        const status = subscription.status;
        const currentPeriodEnd = new Date(subscription.current_period_end * 1000).toISOString();
        
        await supabaseAdmin
          .from("subscriptions")
          .update({ 
            status: status === 'active' ? 'active' : 'canceled',
            end_date: currentPeriodEnd 
          })
          .eq("stripe_subscription_id", subscription.id);
          
        break;
      }
      // Add more handlers as needed
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}