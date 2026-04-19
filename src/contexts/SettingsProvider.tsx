import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

type CurrencyType = "USD" | "EUR" | "GBP" | "JPY" | "PHP" | "AUD" | "CAD" | "SGD" | "AED" | "INR";
const SUPPORTED_CURRENCIES = ["USD", "EUR", "GBP", "JPY", "PHP", "AUD", "CAD", "SGD", "AED", "INR"];
type PlanType = "trial" | "starter" | "professional";
type ThemeColor = "blue" | "green" | "orange" | "rose" | "violet";

export interface CompanySettings {
  name: string;
  address: string;
  taxId: string;
  website: string;
  logo: string;
  logo_url?: string;
  auto_approve_materials?: boolean;
}

const defaultCompany: CompanySettings = {
  name: "Thea-X Construction",
  address: "123 Builder Street, Construction City",
  taxId: "12-3456789",
  website: "www.theaxconstruction.com",
  logo: "",
  auto_approve_materials: false
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
  const [currentPlan, setCurrentPlanState] = useState<PlanType>("trial");
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

    // Function to load company data securely from DB
    const loadCompanyFromDb = async (userId: string) => {
      // IMMEDIATELY clear state to prevent memory leaks from previous user in SPA
      setCompanyState(defaultCompany);
      setCompanyId(null);

      try {
        // 1. Fetch Company Data to find the Owner
        const { data: profile } = await supabase.from('profiles').select('company_id').eq('id', userId).single();
        let compId = profile?.company_id;

        if (!compId) {
          // If no company, create one (graceful fallback)
          const { data: newComp, error: insertError } = await supabase.from('company_settings').insert({
            user_id: userId,
            name: "My Company"
          }).select().single();

          if (newComp) {
            compId = newComp.id;
            await supabase.from('profiles').update({ company_id: compId }).eq('id', userId);
          } else if (insertError) {
            console.error("Failed to create fallback company:", insertError);
          }
        }

        let ownerId = userId;

        if (compId) {
          setCompanyId(compId);
          const { data: compSettings } = await supabase.from('company_settings').select('*').eq('id', compId).single();
          if (compSettings) {
            if (compSettings.user_id) ownerId = compSettings.user_id; // Set owner to the company's creator (GM)
            setCompanyState({
              name: compSettings.name || "",
              address: compSettings.address || "",
              taxId: compSettings.tax_id || "",
              website: compSettings.website || "",
              logo: compSettings.logo || "",
              auto_approve_materials: compSettings.auto_approve_materials || false
            });
          }
        }

        // 2. Fetch Subscription Data using the Company Owner's ID
        const { data: subs } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('user_id', ownerId)
          .order('created_at', { ascending: false });

        if (subs && subs.length > 0) {
          const sub = subs[0];
          setCurrentPlanState(sub.plan as PlanType);
          
          if (sub.features) {
            localStorage.setItem('app_subscription_features', JSON.stringify(sub.features));
          }
          
          if (sub.end_date) {
            const endDate = new Date(sub.end_date);
            const now = new Date();
            const isExpired = now > endDate;

            if (sub.plan === 'trial') {
              setIsTrial(true);
              const diffTime = endDate.getTime() - now.getTime();
              const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
              setDaysRemaining(Math.max(0, diffDays));
              
              if (isExpired) {
                setIsLocked(true);
                setLockReason("trial_expired");
              } else {
                setIsLocked(false);
                setLockReason("none");
              }
            } else {
              setIsTrial(false);
              setDaysRemaining(0);
              
              if (isExpired) {
                setIsLocked(true);
                setLockReason("subscription_expired");
              } else {
                setIsLocked(false);
                setLockReason("none");
              }
            }
          }
        } else {
          // Default fallback if no record is found
          setIsTrial(true);
          setCurrentPlanState("trial");
          setIsLocked(false);
          setDaysRemaining(7);
        }
      } catch (err) {
        console.error("Error loading company/subscription data:", err);
      }
    };

    // Listen for Auth changes - automatically reset state on logout and fetch on login
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        loadCompanyFromDb(session.user.id);
      } else {
        // Completely wipe state on logout
        setCompanyState(defaultCompany);
        setCompanyId(null);
        setCurrentPlanState("trial");
        setIsTrial(true);
        setIsLocked(false);
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
  };

  const setCurrentPlan = (plan: PlanType) => {
    setCurrentPlanState(plan);
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