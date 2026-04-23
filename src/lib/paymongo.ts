const PAYMONGO_API_BASE_URL = "https://api.paymongo.com/v1";

function getRequiredEnv(name: "PAYMONGO_SECRET_KEY" | "NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY"): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is not configured.`);
  }

  return value;
}

export function getPayMongoApiBaseUrl(): string {
  return PAYMONGO_API_BASE_URL;
}

export function getPayMongoSecretKey(): string {
  return getRequiredEnv("PAYMONGO_SECRET_KEY");
}

export function getPayMongoPublicKey(): string {
  return getRequiredEnv("NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY");
}

export function getPayMongoAuthHeader(): string {
  return `Basic ${Buffer.from(`${getPayMongoSecretKey()}:`).toString("base64")}`;
}

export function isPayMongoConfigured(): boolean {
  return Boolean(process.env.PAYMONGO_SECRET_KEY);
}