import crypto from "crypto";
import type { BillingCycle } from "@/config/pricing";

export interface PayMongoCheckoutContext {
  userId: string;
  planId: string;
  billingCycle: BillingCycle;
  amount: number;
  features: Record<string, number>;
  issuedAt: string;
}

function getSigningSecret(): string {
  return (
    process.env.PAYMONGO_SECRET_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ""
  );
}

function createSignature(encodedPayload: string): string {
  const secret = getSigningSecret();

  if (!secret) {
    throw new Error("Missing server signing secret.");
  }

  return crypto.createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function createPayMongoCheckoutToken(payload: PayMongoCheckoutContext): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const signature = createSignature(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifyPayMongoCheckoutToken(token: string): PayMongoCheckoutContext | null {
  const [encodedPayload, providedSignature] = token.split(".");

  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = createSignature(encodedPayload);
  const providedBuffer = Buffer.from(providedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8")) as PayMongoCheckoutContext;

    if (
      !parsed.userId ||
      !parsed.planId ||
      !parsed.billingCycle ||
      typeof parsed.amount !== "number" ||
      !parsed.issuedAt
    ) {
      return null;
    }

    return {
      userId: parsed.userId,
      planId: parsed.planId,
      billingCycle: parsed.billingCycle,
      amount: parsed.amount,
      features: parsed.features || {},
      issuedAt: parsed.issuedAt
    };
  } catch {
    return null;
  }
}