import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Building2, UserPlus, LogOut, ArrowRight, Loader2 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";
import { plans } from "@/config/pricing";

export default function Onboarding() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  
  const [fullName, setFullName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  
  const [joining, setJoining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    checkSession();
  }, []);

  const checkSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/auth/login');
      return;
    }

    setUserId(session.user.id);

    const { data: profile } = await supabase
      .from('profiles')
      .select('assigned_module, full_name')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.full_name) {
      setFullName(profile.full_name);
    }

    if (profile?.assigned_module) {
      // Already onboarded, redirect to root which will route them properly
      router.push('/dashboard');
    } else {
      setLoading(false);
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim()) {
      toast({ title: "Required", description: "Please enter an invite code.", variant: "destructive" });
      return;
    }

    setJoining(true);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Not authenticated");

      const { data: invData, error: invError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', inviteCode.trim().toUpperCase())
        .eq('status', 'active')
        .maybeSingle();

      if (invError || !invData) {
        toast({
          title: "Invalid Code",
          description: "The invite code is invalid or has expired.",
          variant: "destructive"
        });
        setJoining(false);
        return;
      }

      // The module is pre-determined by the GM who created the invite code
      const primaryModule = invData.modules && invData.modules.length > 0 ? invData.modules[0] : invData.module;
      const allModules = invData.modules && invData.modules.length > 0 ? invData.modules : [invData.module];

      // Use the secure backend function with the GM's explicitly chosen modules
      const { error: rpcError } = await supabase.rpc('assign_user_module', {
        p_user_id: user.id,
        p_module: primaryModule,
        p_project_ids: invData.project_ids || [],
        p_modules: allModules
      });

      if (rpcError) {
        const { error: upsertError } = await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName,
          assigned_module: primaryModule,
          assigned_project_ids: invData.project_ids || [],
          assigned_modules: allModules,
          updated_at: new Date().toISOString()
        });
        if (upsertError) throw upsertError;
      }

      // Mark code as used
      await supabase
        .from('invite_codes')
        .update({ status: 'used' })
        .eq('id', invData.id);

      toast({
        title: "Success!",
        description: `You have joined the workspace with access to: ${allModules.join(', ')}.`,
      });

      // Use hard reload
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error("Join company error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to join company.",
        variant: "destructive"
      });
      setJoining(false);
    }
  };

  const handleCreateCompany = async () => {
    setCreating(true);
    try {
      // Get fresh user just in case state is stale
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Not authenticated");

      // Use the secure backend function
      const { error: rpcError } = await supabase.rpc('assign_user_module', {
        p_user_id: user.id,
        p_module: 'GM'
      });

      if (rpcError) {
        console.warn("RPC failed, falling back to upsert:", rpcError);
        // Fallback to direct upsert if RPC fails for any reason
        const { error: upsertError } = await supabase.from('profiles').upsert({
          id: user.id,
          full_name: fullName,
          assigned_module: 'GM',
          updated_at: new Date().toISOString()
        });
        if (upsertError) throw upsertError;
      }

      // Generate a 7-day trial subscription for the new General Manager
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(startDate.getDate() + 7);

      const { error: subError } = await supabase.from('subscriptions').insert({
        user_id: user.id,
        plan: 'trial',
        status: 'active',
        amount: 0,
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0],
        features: {}
      });

      if (subError) {
        console.warn("Failed to create trial subscription:", subError);
      }

      toast({
        title: "Workspace Created",
        description: "You are now the General Manager. Your 7-Day Trial has been activated.",
      });

      // Use hard reload to completely clear any cached auth/profile states in Next.js
      window.location.href = '/dashboard';
    } catch (error: any) {
      console.error("Create company error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create workspace. Please try again.",
        variant: "destructive"
      });
      setCreating(false);
    }
  };

  const handleLogout = async () => {
    await authService.signOut();
    router.push('/auth/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 p-4">
      <div className="max-w-4xl w-full space-y-6">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 font-bold text-2xl">
            TX
          </div>
          <h1 className="text-3xl font-heading font-bold">Welcome to Thea-X, {fullName.split(' ')[0]}!</h1>
          <p className="text-muted-foreground mt-2 text-lg">Choose how you want to set up your workspace.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mt-4">
          {/* Join Company Card */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors flex flex-col">
            <CardHeader>
              <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                <UserPlus className="h-6 w-6" />
              </div>
              <CardTitle>Join a Company</CardTitle>
              <CardDescription>
                Enter an invite code provided by your General Manager to join their workspace.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <form id="join-form" onSubmit={handleJoinCompany} className="flex flex-col gap-5">
                <div className="space-y-2">
                  <Label>Invite Code *</Label>
                  <Input 
                    placeholder="Enter 6-character code" 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="text-lg tracking-widest uppercase font-mono text-center"
                    maxLength={8}
                    disabled={joining || creating}
                  />
                </div>
              </form>
            </CardContent>
            <CardFooter>
              <Button type="submit" form="join-form" disabled={!inviteCode.trim() || joining || creating} className="w-full h-12 text-lg">
                {joining ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Join Workspace
                {!joining && <ArrowRight className="ml-2 h-5 w-5" />}
              </Button>
            </CardFooter>
          </Card>

          {/* Create Company Card */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors flex flex-col">
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6" />
              </div>
              <CardTitle>Create a Company</CardTitle>
              <CardDescription>
                Set up a new workspace. You will be assigned the General Manager (GM) role.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col justify-center">
              <div className="text-sm text-center text-muted-foreground p-6 bg-muted/50 rounded-xl border border-dashed">
                Clicking start will initialize a new workspace and automatically grant you <strong>Full Administrator Access</strong> to all modules.
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleCreateCompany}
                disabled={joining || creating}
                className="w-full h-12 text-lg bg-green-600 hover:bg-green-700 text-white"
              >
                {creating ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Start New Workspace
                {!creating && <ArrowRight className="ml-2 h-5 w-5" />}
              </Button>
            </CardFooter>
          </Card>
        </div>

        <div className="mt-8 text-center pb-8">
          <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out and try another account
          </Button>
        </div>
      </div>
    </div>
  );
}