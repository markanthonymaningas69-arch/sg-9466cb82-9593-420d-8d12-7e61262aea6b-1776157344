import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DemoRedirect() {
  const router = useRouter();
  const { toast } = useToast();
  const [status, setStatus] = useState("Preparing Demo Environment...");

  useEffect(() => {
    const setupDemo = async () => {
      try {
        // Sign out any existing user first
        await supabase.auth.signOut();
        setStatus("Logging into Demo Account...");
        
        // Log into the securely restricted demo user
        const { error } = await supabase.auth.signInWithPassword({
          email: 'demo@thea-x.com',
          password: 'Demo1234!'
        });

        if (error) {
          // If the account doesn't exist yet, sign them up on the fly
          const { error: signUpError } = await supabase.auth.signUp({
            email: 'demo@thea-x.com',
            password: 'Demo1234!'
          });
          if (signUpError) throw signUpError;
        }
        
        setStatus("Redirecting to Dashboard...");
        
        // Toast notification to explain it's a read-only mode
        toast({ 
          title: "Demo Mode Activated", 
          description: "You have been logged into the live demo. You can view and filter data, but modifications are restricted.",
          duration: 5000,
        });

        // Redirect to the main dashboard
        router.push("/dashboard");
      } catch (error: any) {
        toast({ title: "Demo Login Failed", description: error.message, variant: "destructive" });
        setTimeout(() => router.push("/"), 2000);
      }
    };
    
    setupDemo();
  }, [router, toast]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-sans">
      <div className="text-center space-y-6 max-w-md px-6">
        <div className="bg-primary/10 p-4 rounded-full inline-flex">
          <Loader2 className="w-12 h-12 animate-spin text-primary" />
        </div>
        <h2 className="text-2xl font-bold font-heading">{status}</h2>
        <p className="text-muted-foreground">
          We are securely logging you into the live environment. You'll be able to explore the full G+1 Villa Sample Project across all modules.
        </p>
      </div>
    </div>
  );
}