import React, { createContext, useContext, useState, useEffect } from "react";

type CurrencyType = "USD" | "EUR" | "GBP" | "JPY" | "PHP" | "AUD" | "CAD" | "SGD" | "AED" | "INR";
const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "PHP", "AUD", "CAD", "SGD", "AED", "INR"];
type PlanType = "starter" | "professional";

export interface CompanySettings {
  name: string;
  address: string;
  taxId: string;
  website: string;
  logo: string;
}

const defaultCompany: CompanySettings = {
  name: "Thea-X Construction",
  address: "123 Builder Street, Construction City",
  taxId: "12-3456789",
  website: "www.theaxconstruction.com",
  logo: ""
};

interface SettingsContextType {
  currency: CurrencyType;
  setCurrency: (currency: CurrencyType) => void;
  formatCurrency: (value: number) => string;
  formatNumber: (value: number) => string;
  company: CompanySettings;
  setCompany: (company: CompanySettings) => void;
  currentPlan: PlanType;
  setCurrentPlan: (plan: PlanType) => void;
  isLocked: boolean;
  lockReason: "trial_expired" | "subscription_expired" | "none";
  isTrial: boolean;
  daysRemaining: number;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyType>("AED");
  const [company, setCompanyState] = useState<CompanySettings>(defaultCompany);
  const [currentPlan, setCurrentPlanState] = useState<PlanType>("professional");
  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [lockReason, setLockReason] = useState<"trial_expired" | "subscription_expired" | "none">("none");
  const [isTrial, setIsTrial] = useState<boolean>(true);
  const [daysRemaining, setDaysRemaining] = useState<number>(7);

  useEffect(() => {
    // Force AED currency
    setCurrencyState("AED");
    localStorage.setItem("app_currency", "AED");
    
    const savedCompany = localStorage.getItem("app_company");
    if (savedCompany) {
      try {
        setCompanyState(JSON.parse(savedCompany));
      } catch (e) {
        console.error("Failed to parse company settings", e);
      }
    }
    
    const savedPlan = localStorage.getItem("app_plan") as PlanType;
    if (savedPlan && ["starter", "professional"].includes(savedPlan)) {
      setCurrentPlanState(savedPlan);
    }

    // Trial logic based on company creation date (mocked via localStorage for now)
    let companyCreated = localStorage.getItem("app_created_at");
    if (!companyCreated) {
      companyCreated = new Date().toISOString();
      localStorage.setItem("app_created_at", companyCreated);
    }

    const createdDate = new Date(companyCreated);
    const currentDate = new Date();
    
    // Check for paid subscription
    const isPaid = localStorage.getItem("app_is_paid") === "true";
    const expiresAtStr = localStorage.getItem("app_subscription_expires_at");
    
    if (isPaid) {
      setIsTrial(false);
      setDaysRemaining(0);
      
      if (expiresAtStr) {
        const expiresAt = new Date(expiresAtStr);
        if (currentDate > expiresAt) {
          setIsLocked(true);
          setLockReason("subscription_expired");
        } else {
          setIsLocked(false);
          setLockReason("none");
        }
      } else {
        // Fallback for previously active plans without an explicit expiration date
        setIsLocked(false);
        setLockReason("none");
      }
    } else {
      // Trial logic
      setIsTrial(true);
      const diffTime = Math.abs(currentDate.getTime() - createdDate.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      const remaining = Math.max(0, 7 - diffDays);
      setDaysRemaining(remaining);
      
      if (diffDays > 7) {
        setIsLocked(true);
        setLockReason("trial_expired");
      } else {
        setIsLocked(false);
        setLockReason("none");
      }
    }
  }, []);

  const setCurrency = (newCurrency: CurrencyType) => {
    setCurrencyState(newCurrency);
    localStorage.setItem("app_currency", newCurrency);
  };

  const setCompany = (newCompany: CompanySettings) => {
    setCompanyState(newCompany);
    localStorage.setItem("app_company", JSON.stringify(newCompany));
  };

  const setCurrentPlan = (plan: PlanType) => {
    setCurrentPlanState(plan);
    localStorage.setItem("app_plan", plan);
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
    <SettingsContext.Provider value={{ currency, setCurrency, formatCurrency, formatNumber, company, setCompany, currentPlan, setCurrentPlan, isLocked, lockReason, isTrial, daysRemaining }}>
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