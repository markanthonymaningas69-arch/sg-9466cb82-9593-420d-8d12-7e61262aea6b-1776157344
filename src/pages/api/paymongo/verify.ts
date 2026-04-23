import type { NextApiRequest, NextApiResponse } from "next";
import { activateSubscription } from "@/lib/subscriptionPersistence";
import { getPayMongoApiBaseUrl, getPayMongoAuthHeader } from "@/lib/paymongo";
import { verifyPayMongoCheckoutToken } from "@/lib/paymongoCheckoutToken";

interface VerifyRequestBody {
  sessionId?: string;
  token?: string;
}

function getPaidStatuses(payload: unknown): string[] {
  const attributes = typeof payload === "object" && payload !== null
    ? (payload as { data?: { attributes?: Record<string, unknown> } }).data?.attributes
    : undefined;

  const paymentIntent =
    attributes?.payment_intent && typeof attributes.payment_intent === "object"
      ? (attributes.payment_intent as { status?: string; attributes?: { status?: string } })
      : undefined;

  const payments = Array.isArray(attributes?.payments) ? attributes.payments : [];
  const statuses = [
    typeof attributes?.status === "string" ? attributes.status : null,
    typeof attributes?.payment_status === "string" ? attributes.payment_status : null,
    typeof paymentIntent?.status === "string" ? paymentIntent.status : null,
    typeof paymentIntent?.attributes?.status === "string" ? paymentIntent.attributes.status : null,
    ...payments.flatMap((payment) => {
      if (!payment || typeof payment !== "object") {
        return [];
      }

      const typedPayment = payment as { status?: string; attributes?: { status?: string } };
      return [
        typeof typedPayment.status === "string" ? typedPayment.status : null,
        typeof typedPayment.attributes?.status === "string" ? typedPayment.attributes.status : null
      ];
    })
  ];

  return Array.from(
    new Set(
      statuses
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase())
    )
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { sessionId, token } = req.body as VerifyRequestBody;

  if (!sessionId || !token) {
    return res.status(400).json({ error: "Missing PayMongo verification context." });
  }

  const checkoutContext = verifyPayMongoCheckoutToken(token);

  if (!checkoutContext) {
    return res.status(400).json({ error: "Invalid PayMongo verification token." });
  }

  try {
    const response = await fetch(`${getPayMongoApiBaseUrl()}/checkout_sessions/${sessionId}`, {
      method: "GET",
      headers: {
        accept: "application/json",
        authorization: getPayMongoAuthHeader()
      }
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      const message =
        data?.errors?.[0]?.detail ||
        data?.errors?.[0]?.code ||
        data?.message ||
        "Unable to retrieve the PayMongo checkout session.";

      return res.status(response.status).json({ error: message });
    }

    const statuses = getPaidStatuses(data);
    const hasConfirmedPayment = statuses.some((status) =>
      ["paid", "succeeded", "successful", "completed"].includes(status)
    );

    if (!hasConfirmedPayment) {
      return res.status(202).json({
        pending: true,
        error: "Payment has not been marked as paid yet.",
        statuses
      });
    }

    const activation = await activateSubscription({
      userId: checkoutContext.userId,
      planId: checkoutContext.planId,
      billingCycle: checkoutContext.billingCycle,
      amount: checkoutContext.amount,
      features: checkoutContext.features
    });

    return res.status(200).json({
      success: true,
      plan: activation.plan,
      endDate: activation.endDate
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected PayMongo verification error.";
    return res.status(500).json({ error: message });
  }
}