import React, { createContext, useContext, useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";

type CurrencyType = "USD" | "EUR" | "GBP" | "JPY" | "PHP";

interface SettingsContextType {
  currency: CurrencyType;
  setCurrency: (currency: CurrencyType) => void;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrency] = useState<CurrencyType>("USD");

  useEffect(() => {
    const savedCurrency = localStorage.getItem("app_currency") as CurrencyType;
    if (savedCurrency && ["USD", "EUR", "GBP", "JPY", "PHP"].includes(savedCurrency)) {
      setCurrency(savedCurrency);
    }
  }, []);

  const handleSetCurrency = (newCurrency: CurrencyType) => {
    setCurrency(newCurrency);
    localStorage.setItem("app_currency", newCurrency);
  };

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "0.00";
    
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    if (!Number.isFinite(value)) return "0.00";
    
    return new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  };

  return (
    <SettingsContext.Provider value={{ currency, setCurrency: handleSetCurrency, formatCurrency, formatNumber }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}