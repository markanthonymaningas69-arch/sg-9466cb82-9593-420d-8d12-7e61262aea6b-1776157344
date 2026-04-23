import type { SupportedCountry } from "@/config/pricing";

export type PaymentProvider = "stripe" | "gcash_link";

export interface CountrySubscriptionConfig {
  country: SupportedCountry;
  paymentProvider: PaymentProvider;
  currencyCode: string;
  currencyLocale: string;
  paymentLink: string | null;
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
    paymentLink: null,
    paymentMethodLabel: "Card payment via Stripe",
    checkoutLabel: "Confirm & Pay",
    helperText: "Your subscription is processed through the current Stripe billing flow."
  },
  Philippines: {
    country: "Philippines",
    paymentProvider: "gcash_link",
    currencyCode: "PHP",
    currencyLocale: "en-PH",
    paymentLink: null,
    paymentMethodLabel: "GCash payment link",
    checkoutLabel: "Open GCash Payment",
    helperText: "Philippines accounts use a country-specific GCash payment flow. Add-on numeric values stay the same and only the currency presentation changes to Peso."
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