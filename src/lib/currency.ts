import { DEFAULT_COUNTRY, isSupportedCountry, type SupportedCountry } from "@/config/pricing";

export type CurrencyCode = "AED" | "PHP";

export interface CountryCurrencyFormatOptions {
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
}

const COUNTRY_CURRENCY_MAP: Record<SupportedCountry, { currency: CurrencyCode; locale: string }> = {
  UAE: {
    currency: "AED",
    locale: "en-AE"
  },
  Philippines: {
    currency: "PHP",
    locale: "en-PH"
  }
};

export function resolveSupportedCountry(country: string | null | undefined): SupportedCountry {
  if (isSupportedCountry(country)) {
    return country;
  }

  return DEFAULT_COUNTRY;
}

export function getCurrencyCodeForCountry(country: string | null | undefined): CurrencyCode {
  return COUNTRY_CURRENCY_MAP[resolveSupportedCountry(country)].currency;
}

export function formatCountryCurrency(
  value: number,
  country: string | null | undefined,
  options: CountryCurrencyFormatOptions = {}
): string {
  const safeValue = Number.isFinite(value) ? value : 0;
  const config = COUNTRY_CURRENCY_MAP[resolveSupportedCountry(country)];

  return new Intl.NumberFormat(config.locale, {
    style: "currency",
    currency: config.currency,
    minimumFractionDigits: options.minimumFractionDigits ?? 2,
    maximumFractionDigits: options.maximumFractionDigits ?? 2
  }).format(safeValue);
}