import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { SettingsProvider } from "@/contexts/SettingsProvider";
import { Toaster } from "@/components/ui/toaster";
import { authService } from "@/services/authService";
import { Inter, Outfit, Playfair_Display } from "next/font/google";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const outfit = Outfit({ subsets: ["latin"], variable: "--font-sans" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-serif" });

function AppInner({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState<boolean>(false);

  useEffect(() => {
    const publicPaths = ["/auth/login", "/auth/register", "/404", "/system-monitor"];
    const path = router.pathname;

    if (publicPaths.includes(path)) {
      setAuthChecked(true);
      return;
    }

    let isMounted = true;

    authService
      .getCurrentUser()
      .then((user) => {
        if (!user && isMounted) {
          router.replace("/auth/login");
        }
      })
      .finally(() => {
        if (isMounted) {
          setAuthChecked(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [router.pathname, router]);

  if (!authChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  return <Component {...pageProps} />;
}

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <style jsx global>{`
        :root {
          --font-sans: ${inter.style.fontFamily}, ${outfit.style.fontFamily}, sans-serif;
          --font-serif: ${playfair.style.fontFamily}, serif;
        }
      `}</style>
      <ThemeProvider>
        <SettingsProvider>
          <Component {...pageProps} />
          <Toaster />
        </SettingsProvider>
      </ThemeProvider>
    </>
  );
}