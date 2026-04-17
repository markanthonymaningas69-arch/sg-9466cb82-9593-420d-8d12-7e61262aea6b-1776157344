import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type CurrencyType = "USD" | "EUR" | "GBP" | "JPY" | "PHP" | "AUD" | "CAD" | "SGD" | "AED" | "INR";
const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "PHP", "AUD", "CAD", "SGD", "AED", "INR"];
type PlanType = "starter" | "professional";
type ThemeColor = "blue" | "green" | "orange" | "rose" | "violet";

export interface CompanySettings {
  name: string;
  address: string;
  taxId: string;
  website: string;
  logo: string;
  logo_url?: string;
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
  themeColor: ThemeColor;
  setThemeColor: (color: ThemeColor) => void;
  companyId: string | null;
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
  const [themeColor, setThemeColorState] = useState<ThemeColor>("blue");
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    // Force AED currency
    setCurrencyState("AED");
    localStorage.setItem("app_currency", "AED");
    
    const savedColor = localStorage.getItem("app_theme_color") as ThemeColor;
    if (savedColor) setThemeColorState(savedColor);

    const savedPlan = localStorage.getItem("app_plan") as PlanType;
    if (savedPlan && ["starter", "professional"].includes(savedPlan)) {
      setCurrentPlanState(savedPlan);
    }

    // Trial logic based on company creation date
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
        // Fallback for previously active plans
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

    // Function to load company data securely from DB
    const loadCompanyFromDb = async (userId: string) => {
      const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', userId).single();
      let compId = profile?.company_id;

      if (!compId) {
        // If no company, create one (graceful fallback)
        const { data: newComp } = await supabase.from('company_settings').insert({
          user_id: userId,
          name: "My Company"
        }).select().single();

        if (newComp) {
          compId = newComp.id;
          await supabase.from('profiles').update({ company_id: compId }).eq('id', userId);
        }
      }

      if (compId) {
        setCompanyId(compId);
        const { data: compSettings } = await supabase.from('company_settings').select('*').eq('id', compId).single();
        if (compSettings) {
          setCompanyState({
            name: compSettings.name || "",
            address: compSettings.address || "",
            taxId: compSettings.tax_id || "",
            website: compSettings.website || "",
            logo: compSettings.logo || ""
          });
        }
      }
    };

    // Listen for Auth changes - automatically reset state on logout and fetch on login
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        loadCompanyFromDb(session.user.id);
      } else {
        // Completely wipe company state on logout
        setCompanyState(defaultCompany);
        setCompanyId(null);
      }
    });

    // Initial load check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        loadCompanyFromDb(session.user.id);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const html = document.documentElement;
    const colors = ["theme-blue", "theme-green", "theme-orange", "theme-rose", "theme-violet"];
    html.classList.remove(...colors);
    html.classList.add(`theme-${themeColor}`);
  }, [themeColor]);

  const setCurrency = (newCurrency: CurrencyType) => {
    setCurrencyState(newCurrency);
    localStorage.setItem("app_currency", newCurrency);
  };

  const setCompany = (newCompany: CompanySettings) => {
    setCompanyState(newCompany);
    // REMOVED localStorage saving here to enforce strict multi-tenant isolation
  };

  const setCurrentPlan = (plan: PlanType) => {
    setCurrentPlanState(plan);
    localStorage.setItem("app_plan", plan);
  };

  const setThemeColor = (color: ThemeColor) => {
    setThemeColorState(color);
    localStorage.setItem("app_theme_color", color);
  };

  const formatCurrency = (value: number) => {
    if (!Number.isFinite(value)) return "AED 0.00";
    
    return new Intl.NumberFormat("en-AE", {
      style: "currency",
      currency: "AED",
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
    <SettingsContext.Provider value={{ currency, setCurrency, formatCurrency, formatNumber, company, setCompany, currentPlan, setCurrentPlan, isLocked, lockReason, isTrial, daysRemaining, themeColor, setThemeColor, companyId }}>
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