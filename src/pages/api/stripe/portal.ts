import { NextApiRequest, NextApiResponse } from "next";
import { stripe } from "@/lib/stripe";
import { createClient } from "@supabase/supabase-js";

// We use the anon key here just to fetch the stripe_customer_id, assuming user_id matches
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  try {
    const { userId, returnUrl } = req.body;
    
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Since we are running on the server, we might bypass RLS by using service_role,
    // but anon key works if the table allows select based on an auth token.
    // However, API routes don't automatically pass the auth token to this supabase client unless we extract it from req headers.
    // For simplicity, we use Service Role Key if available to safely look up the customer ID.
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: sub, error } = await adminSupabase
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", userId)
      .not('stripe_customer_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
      
    if (error || !sub?.stripe_customer_id) {
      throw new Error("No active Stripe customer found. Please make a purchase first.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: returnUrl,
    });

    res.status(200).json({ url: session.url });
  } catch (err: any) {
    console.error("Stripe Portal Error:", err);
    res.status(500).json({ error: err.message });
  }
}