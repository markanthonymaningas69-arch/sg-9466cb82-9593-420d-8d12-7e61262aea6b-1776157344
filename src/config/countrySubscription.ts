import type { SupportedCountry } from "@/config/pricing";

export type PaymentProvider = "stripe" | "gcash_link";

export interface CountrySubscriptionConfig {
  country: SupportedCountry;
  paymentProvider: PaymentProvider;
  currencyCode: string;
  currencyLocale: string;
  paymentLink: string | null;
}

export const COUNTRY_SUBSCRIPTION_CONFIG: Record<SupportedCountry, CountrySubscriptionConfig> = {
  UAE: {
    country: "UAE",
    paymentProvider: "stripe",
    currencyCode: "AED",
    currencyLocale: "en-AE",
    paymentLink: null
  },
  Philippines: {
    country: "Philippines",
    paymentProvider: "gcash_link",
    currencyCode: "PHP",
    currencyLocale: "en-PH",
    paymentLink: null
  }
};

export function getCountrySubscriptionConfig(country: SupportedCountry): CountrySubscriptionConfig {
  return COUNTRY_SUBSCRIPTION_CONFIG[country];
}

export function usesStripeSubscription(country: SupportedCountry): boolean {
  return getCountrySubscriptionConfig(country).paymentProvider === "stripe";
}

export function usesManualPaymentLink(country: SupportedCountry): boolean {
  return getCountrySubscriptionConfig(country).paymentProvider === "gcash_link";
}