import type { SupportedCountry } from "@/config/pricing";

export type PaymentProvider = "stripe" | "paymongo_gcash";

export interface CountrySubscriptionConfig {
  country: SupportedCountry;
  paymentProvider: PaymentProvider;
  currencyCode: string;
  currencyLocale: string;
  checkoutApiPath: string | null;
  paymentMethodLabel: string;
  checkoutLabel: string;
  helperText: string;
}

export const COUNTRY_SUBSCRIPTION_CONFIG: Record<SupportedCountry, CountrySubscriptionConfig> = {
  UAE: {
    country: "UAE",
    paymentProvider: "stripe",
    currencyCode: "AED",
    currencyLocale: "en-AE",
    checkoutApiPath: null,
    paymentMethodLabel: "Card payment via Stripe",
    checkoutLabel: "Confirm & Pay",
    helperText: "Your subscription is processed through the current Stripe billing flow."
  },
  Philippines: {
    country: "Philippines",
    paymentProvider: "stripe",
    currencyCode: "PHP",
    currencyLocale: "en-PH",
    checkoutApiPath: null,
    paymentMethodLabel: "Card payment via Stripe",
    checkoutLabel: "Confirm & Pay",
    helperText: "Your subscription is processed through the current Stripe billing flow."
  }
};

export function getCountrySubscriptionConfig(country: SupportedCountry): CountrySubscriptionConfig {
  return COUNTRY_SUBSCRIPTION_CONFIG[country];
}

export function usesStripeSubscription(country: SupportedCountry): boolean {
  return getCountrySubscriptionConfig(country).paymentProvider === "stripe";
}

export function usesPayMongoCheckout(country: SupportedCountry): boolean {
  return getCountrySubscriptionConfig(country).paymentProvider === "paymongo_gcash";
}