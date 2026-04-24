import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

const FALLBACK_ROUTE = "/subscription/ph";

function detectSubscriptionRoute(): string {
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

export default function SubscriptionRedirectPage() {
  const router = useRouter();
  const [targetRoute, setTargetRoute] = useState<string>(FALLBACK_ROUTE);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const nextRoute = detectSubscriptionRoute();
    setTargetRoute(nextRoute);
    void router.replace(nextRoute);
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
              We are checking your country and opening the correct billing page automatically.
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