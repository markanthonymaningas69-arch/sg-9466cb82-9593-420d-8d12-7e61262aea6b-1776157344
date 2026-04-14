import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, UserPlus, LogOut, ArrowRight, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { authService } from "@/services/authService";

export default function Onboarding() {
  const router = useRouter();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
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
      .select('assigned_module')
      .eq('id', session.user.id)
      .maybeSingle();

    if (profile?.assigned_module) {
      // Already onboarded, redirect to root which will route them properly
      router.push('/');
    } else {
      setLoading(false);
    }
  };

  const handleJoinCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode.trim() || !userId) return;

    setJoining(true);
    try {
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

      // Use upsert here too to be safe
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId, 
          assigned_module: invData.module,
          updated_at: new Date().toISOString()
        });

      if (updateError) throw updateError;

      // Mark code as used
      await supabase
        .from('invite_codes')
        .update({ status: 'used' })
        .eq('id', invData.id);

      toast({
        title: "Success!",
        description: `You have joined the company as ${invData.module}.`,
      });

      router.push('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to join company.",
        variant: "destructive"
      });
      setJoining(false);
    }
  };

  const handleCreateCompany = async () => {
    if (!userId) return;
    setCreating(true);
    try {
      // Use upsert to handle cases where the profile might not exist yet
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ 
          id: userId, 
          assigned_module: 'GM',
          updated_at: new Date().toISOString()
        });

      if (updateError) throw updateError;

      toast({
        title: "Workspace Created",
        description: "You are now the General Manager.",
      });

      router.push('/');
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create workspace.",
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
      <div className="max-w-4xl w-full">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-primary-foreground mb-4 font-bold text-2xl">
            TX
          </div>
          <h1 className="text-3xl font-heading font-bold">Welcome to Thea-X</h1>
          <p className="text-muted-foreground mt-2 text-lg">Choose how you want to get started with your account.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Join Company Card */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mb-4">
                <UserPlus className="h-6 w-6" />
              </div>
              <CardTitle>Join a Company</CardTitle>
              <CardDescription>
                Enter an invite code provided by your General Manager to access your assigned module.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleJoinCompany} className="flex flex-col gap-4">
                <div className="space-y-2">
                  <Input 
                    placeholder="Enter 6-character code" 
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                    className="text-lg tracking-widest uppercase font-mono text-center"
                    maxLength={8}
                    disabled={joining || creating}
                  />
                </div>
                <Button type="submit" disabled={!inviteCode.trim() || joining || creating} className="w-full">
                  {joining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Join Workspace
                  {!joining && <ArrowRight className="ml-2 h-4 w-4" />}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Create Company Card */}
          <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="h-12 w-12 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mb-4">
                <Building2 className="h-6 w-6" />
              </div>
              <CardTitle>Create a Company</CardTitle>
              <CardDescription>
                Set up a new workspace. You will be assigned the General Manager (GM) role with full access.
              </CardDescription>
            </CardHeader>
            <CardContent className="h-full flex flex-col justify-end pb-6">
              <Button 
                variant="outline" 
                className="w-full border-2 border-primary/20 hover:bg-primary/5"
                onClick={handleCreateCompany}
                disabled={joining || creating}
              >
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Create Workspace
                {!creating && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 text-center">
          <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
            <LogOut className="mr-2 h-4 w-4" />
            Sign out and try another account
          </Button>
        </div>
      </div>
    </div>
  );
}