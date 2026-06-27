import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK_ROUTE = "/subscription/ph";

function detectSubscriptionRouteFromBrowser(): string {
  if (typeof window === "undefined") {
    return FALLBACK_ROUTE;
  }

  const browserLocales = [navigator.language, ...(navigator.languages || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  if (browserLocales.includes("-ae") || browserLocales.includes("ar-ae") || timeZone === "Asia/Dubai") {
    return "/subscription/uae";
  }

  if (
    browserLocales.includes("-ph") ||
    browserLocales.includes("en-ph") ||
    browserLocales.includes("fil") ||
    timeZone === "Asia/Manila"
  ) {
    return "/subscription/ph";
  }

  return FALLBACK_ROUTE;
}

async function getSubscriptionRouteFromUser(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      return null;
    }

    // Check user's profile for country
    const { data: profile } = await supabase
      .from("profiles")
      .select("company_id")
      .eq("id", session.user.id)
      .single();

    if (!profile?.company_id) {
      return null;
    }

    // Get company country
    const { data: company } = await supabase
      .from("companies")
      .select("country")
      .eq("id", profile.company_id)
      .single();

    if (!company?.country) {
      return null;
    }

    const country = company.country.toLowerCase();

    // Route based on registered country
    if (country.includes("philippines") || country === "ph") {
      return "/subscription/ph";
    }

    if (country.includes("uae") || country.includes("emirates") || country === "ae") {
      return "/subscription/uae";
    }

    return null;
  } catch (error) {
    console.error("Error fetching user country:", error);
    return null;
  }
}

export default function SubscriptionRedirectPage() {
  const router = useRouter();
  const [targetRoute, setTargetRoute] = useState<string>(FALLBACK_ROUTE);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    async function determineRoute() {
      // First priority: Check user's registered country
      const userRoute = await getSubscriptionRouteFromUser();
      
      if (userRoute) {
        setTargetRoute(userRoute);
        void router.replace(userRoute);
        return;
      }

      // Fallback: Use browser detection
      const browserRoute = detectSubscriptionRouteFromBrowser();
      setTargetRoute(browserRoute);
      void router.replace(browserRoute);
    }

    void determineRoute().finally(() => setIsLoading(false));
  }, [router]);

  return (
    <Layout>
      <div className="mx-auto flex min-h-[60vh] max-w-2xl items-center justify-center px-4 py-12">
        <Card className="w-full border-primary/20 shadow-lg">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
            <CardTitle className="text-3xl font-heading font-bold">Preparing your subscription page</CardTitle>
            <CardDescription className="text-base">
              {isLoading 
                ? "Checking your account details..." 
                : "Opening the correct pricing page for your country."}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center text-sm text-muted-foreground">
            Redirecting to <span className="font-medium text-foreground">{targetRoute}</span>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}