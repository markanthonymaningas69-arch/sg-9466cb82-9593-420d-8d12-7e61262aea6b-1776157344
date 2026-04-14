import type React from "react";
import { useState } from "react";
import Link from "next/link";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

export default function RegisterPage() {
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
    let assignedModule = "GM";
    let inviteId = null;

    if (inviteCode.trim()) {
      const { data: invData, error: invError } = await supabase
        .from('invite_codes')
        .select('*')
        .eq('code', inviteCode.trim().toUpperCase())
        .eq('status', 'active')
        .maybeSingle();

      if (!invData || invError) {
        setError("Invalid or expired invite code.");
        setSubmitting(false);
        return;
      }
      assignedModule = invData.module;
      inviteId = invData.id;
    }

    const { user, error: authError } = await authService.signUp(email, password);

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    if (user) {
      // The profile trigger might have created the row already, so we update it
      await supabase.from('profiles').update({ assigned_module: assignedModule }).eq('id', user.id);
      
      if (inviteId) {
        await supabase.from('invite_codes').update({ status: 'used' }).eq('id', inviteId);
      }
      
      setSuccess(`Account created. You have been assigned the ${assignedModule} role. Check your inbox if confirmation is required.`);
    } else {
      setSuccess("If email confirmation is required, please check your inbox.");
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
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
            </div>
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
              <Label htmlFor="confirmPassword">Confirm password</Label>
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
            <div className="space-y-2">
              <Label htmlFor="inviteCode">Invite Code (Optional)</Label>
              <Input
                id="inviteCode"
                type="text"
                placeholder="Enter 6-character code"
                value={inviteCode}
                onChange={(event) => setInviteCode(event.target.value.toUpperCase())}
                disabled={submitting}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Leave blank if you are setting up a new company.</p>
            </div>
            {error && (
              <p className="text-sm text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-green-600">
                {success}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Creating account..." : "Create account"}
            </Button>
          </form>
          <p className="mt-4 text-sm text-center text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="text-primary underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}