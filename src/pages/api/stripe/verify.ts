import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const { sessionId } = req.body;
  if (!sessionId) return res.status(400).json({ error: "No session ID provided" });

  try {
    // 1. Ask Stripe if the session was successfully paid
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === "paid") {
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const userId = session.client_reference_id;
      if (!userId) return res.status(400).json({ error: "No user ID attached to session" });

      const metadata = session.metadata || {};
      const planId = metadata.planId || 'starter';
      const features = metadata.features ? JSON.parse(metadata.features) : {};

      const now = new Date();
      const expiresAt = new Date();
      if (metadata.billingCycle === 'annual') {
        expiresAt.setFullYear(expiresAt.getFullYear() + 1);
      } else {
        expiresAt.setMonth(expiresAt.getMonth() + 1);
      }

      // 2. Use the secure RPC function to update the database
      const { error } = await supabase.rpc('process_stripe_subscription', {
        p_user_id: userId,
        p_customer_id: session.customer as string || '',
        p_subscription_id: session.subscription as string || '',
        p_plan: planId,
        p_status: 'active',
        p_start_date: now.toISOString().split('T')[0],
        p_end_date: expiresAt.toISOString().split('T')[0],
        p_amount: (session.amount_total || 0) / 100,
        p_features: features
      });

      if (error) {
        console.error("Verification DB Error:", error);
        return res.status(500).json({ error: error.message });
      }

      return res.status(200).json({ success: true, plan: planId });
    }
    
    return res.status(400).json({ error: "Payment not completed" });
  } catch (e: any) {
    console.error("Verify API Error:", e);
    return res.status(500).json({ error: e.message });
  }
}