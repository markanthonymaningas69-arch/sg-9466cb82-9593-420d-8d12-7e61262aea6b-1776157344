import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [inviteCode, setInviteCode] = useState<string>("");
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);

    // 1. Validate Invite Code FIRST if provided
    let invData = null;
    if (inviteCode.trim()) {
      const { data: codeData, error: codeError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', inviteCode.trim().toUpperCase())
        .eq('status', 'active')
        .maybeSingle();

      if (codeError || !codeData) {
        setError("Invalid or expired invite code. Please check and try again.");
        setSubmitting(false);
        return;
      }
      invData = codeData;
    }

    // 2. Sign up user
    const { user, error: authError } = await authService.signUp(email, password);

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    if (user) {
      if (invData) {
        // Assign module automatically based on invite code
        const primaryModule = invData.modules && invData.modules.length > 0 ? invData.modules[0] : invData.module;
        const allModules = invData.modules && invData.modules.length > 0 ? invData.modules : [invData.module];
        
        await supabase.from('profiles').update({ 
          full_name: fullName,
          assigned_module: primaryModule,
          assigned_modules: allModules,
          assigned_project_ids: invData.project_ids || [],
          company_id: invData.company_id,
          updated_at: new Date().toISOString()
        }).eq('id', user.id);

        // Mark code as used
        await supabase.from('invite_codes').update({ status: 'used' }).eq('id', invData.id);

        setSuccess(`Account created! Joined with access to: ${allModules.join(', ')}. Redirecting...`);
        setTimeout(() => {
          router.push("/dashboard");
        }, 1500);
      } else {
        // No invite code provided - send to onboarding to create workspace
        const { data: newComp } = await supabase.from('company_settings').insert({
          user_id: user.id,
          name: fullName + "'s Company"
        }).select().single();

        await supabase.from('profiles').update({ 
          full_name: fullName,
          assigned_module: null,
          company_id: newComp?.id
        }).eq('id', user.id);
        
        setSuccess("Account created successfully. Redirecting to workspace setup...");
        setTimeout(() => {
          router.push("/onboarding");
        }, 1500);
      }
    }

    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-heading">Create account</CardTitle>
          <CardDescription>
            Set up access to your Thea-X construction accounting workspace.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                disabled={submitting}
                placeholder="John Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
                placeholder="you@company.com"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>
            
            <div className="pt-2 border-t mt-4">
              <div className="space-y-2">
                <Label htmlFor="inviteCode" className="flex items-center justify-between">
                  <span>Invite Code <span className="text-muted-foreground font-normal">(Optional)</span></span>
                </Label>
                <Input
                  id="inviteCode"
                  type="text"
                  value={inviteCode}
                  onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                  disabled={submitting}
                  placeholder="e.g. A1B2C3"
                  className="font-mono uppercase tracking-wider"
                  maxLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Enter an invite code to join a specific department (HR, Warehouse, etc.). Leave blank to create a new workspace as General Manager.
                </p>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive font-medium p-2 bg-destructive/10 rounded">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-700 font-medium p-2 bg-green-50 border border-green-200 rounded">
                {success}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Processing..." : "Create Account"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-primary underline-offset-4 hover:underline font-medium"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}