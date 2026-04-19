import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import { SettingsProvider } from "@/contexts/SettingsProvider";
import { Toaster } from "@/components/ui/toaster";
import { authService } from "@/services/authService";
import { Inter, Outfit, Playfair_Display } from "next/font/google";
import { supabase } from "@/integrations/supabase/client";

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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const activeUserId = localStorage.getItem('app_active_user_id');
      
      if (session?.user) {
        if (activeUserId && activeUserId !== session.user.id) {
          // Another account logged in from a different tab. Force reload to clear state and sync.
          window.location.reload();
        } else {
          localStorage.setItem('app_active_user_id', session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        localStorage.removeItem('app_active_user_id');
        const publicPaths = ["/auth/login", "/auth/register", "/404", "/system-monitor", "/pricing"];
        if (!publicPaths.includes(window.location.pathname)) {
          window.location.href = '/auth/login';
        }
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

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