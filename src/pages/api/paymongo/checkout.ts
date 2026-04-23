import type { NextApiRequest, NextApiResponse } from "next";
import { getCountrySubscriptionConfig, usesPayMongoCheckout } from "@/config/countrySubscription";
import { addOns, getAddOnPrice, getAvailableBillingCycles, getPlanPrice, isSupportedCountry, OUT_OF_SERVICE_MESSAGE, plans, type BillingCycle, type SupportedCountry } from "@/config/pricing";
import { getPayMongoApiBaseUrl, getPayMongoAuthHeader, isPayMongoConfigured } from "@/lib/paymongo";
import { createPayMongoCheckoutToken } from "@/lib/paymongoCheckoutToken";

interface CheckoutRequestBody {
  planId?: string;
  billingCycle?: BillingCycle;
  country?: SupportedCountry;
  features?: Record<string, number>;
  featuresToCharge?: Record<string, number>;
  chargeBasePlan?: boolean;
  proratedDiscount?: number;
  userId?: string;
  email?: string;
  returnUrl?: string;
}

function toCentavos(value: number): number {
  return Math.round(value * 100);
}

function buildReturnUrl(baseUrl: string, status: "success" | "canceled"): string {
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}paymongo=${status}`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const body = req.body as CheckoutRequestBody;
  const {
    planId,
    billingCycle,
    country,
    features = {},
    featuresToCharge = {},
    chargeBasePlan = true,
    proratedDiscount = 0,
    userId,
    email,
    returnUrl
  } = body;

  if (!userId || !email || !returnUrl) {
    return res.status(400).json({ error: "Missing checkout context." });
  }

  if (!country || !isSupportedCountry(country)) {
    return res.status(400).json({ error: OUT_OF_SERVICE_MESSAGE });
  }

  if (!billingCycle || !getAvailableBillingCycles(country).includes(billingCycle)) {
    return res.status(400).json({ error: "The selected billing cycle is not available for this country." });
  }

  if (!usesPayMongoCheckout(country)) {
    return res.status(400).json({ error: "The selected country does not use the PayMongo checkout flow." });
  }

  if (!isPayMongoConfigured()) {
    return res.status(503).json({ error: "PayMongo is not configured yet. Add PAYMONGO_SECRET_KEY in Settings → Environment." });
  }

  const plan = plans.find((item) => item.id === planId);
  if (!plan) {
    return res.status(400).json({ error: "Invalid plan selected." });
  }

  const lineItems: Array<{
    currency: string;
    amount: number;
    description: string;
    name: string;
    quantity: number;
  }> = [];

  const basePlanAmount = getPlanPrice(plan, country, billingCycle);
  const creditedBaseAmount = Math.max(0, basePlanAmount - Math.max(0, Number(proratedDiscount || 0)));

  if (chargeBasePlan && creditedBaseAmount > 0) {
    lineItems.push({
      currency: "PHP",
      amount: toCentavos(creditedBaseAmount),
      description: `${plan.name} plan billed ${billingCycle}`,
      name: `${plan.name} Plan`,
      quantity: 1
    });
  }

  Object.entries(featuresToCharge).forEach(([id, quantityValue]) => {
    const quantity = Number(quantityValue || 0);
    const addOn = addOns.find((item) => item.id === id);

    if (!addOn || quantity <= 0) {
      return;
    }

    const amount = getAddOnPrice(addOn, country, billingCycle);

    lineItems.push({
      currency: "PHP",
      amount: toCentavos(amount),
      description: `${addOn.name} add-on billed ${billingCycle}`,
      name: addOn.name,
      quantity
    });
  });

  if (lineItems.length === 0) {
    return res.status(400).json({ error: "Nothing to charge for this checkout." });
  }

  const totalAmount = lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0) / 100;
  const checkoutToken = createPayMongoCheckoutToken({
    userId,
    planId,
    billingCycle,
    amount: totalAmount,
    features,
    issuedAt: new Date().toISOString()
  });

  const subscriptionConfig = getCountrySubscriptionConfig(country);
  const payload = {
    data: {
      attributes: {
        billing: {
          email
        },
        cancel_url: buildReturnUrl(returnUrl, "canceled"),
        description: `${subscriptionConfig.country} subscription checkout`,
        line_items: lineItems,
        payment_method_types: ["gcash"],
        reference_number: `SUB-${userId.slice(0, 8)}-${Date.now()}`,
        send_email_receipt: true,
        show_description: true,
        show_line_items: true,
        success_url: buildReturnUrl(returnUrl, "success")
      }
    }
  };

  try {
    const response = await fetch(`${getPayMongoApiBaseUrl()}/checkout_sessions`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: getPayMongoAuthHeader(),
        "content-type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data?.errors?.[0]?.detail ||
        data?.errors?.[0]?.code ||
        data?.message ||
        "Unable to create PayMongo checkout session.";

      return res.status(response.status).json({ error: message });
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    const checkoutSessionId = data?.data?.id;

    if (!checkoutUrl || !checkoutSessionId) {
      return res.status(502).json({ error: "PayMongo did not return complete checkout session details." });
    }

    return res.status(200).json({
      url: checkoutUrl,
      sessionId: checkoutSessionId,
      token: checkoutToken
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected PayMongo error.";
    return res.status(500).json({ error: message });
  }
}