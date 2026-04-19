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

    // 1. Sign up user
    const { user, error: authError } = await authService.signUp(email, password);

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    if (user) {
      // Set the user's full name and send to onboarding
      await supabase.from('profiles').update({ 
        full_name: fullName,
        assigned_module: null
      }).eq('id', user.id);
      
      setSuccess("Account created successfully. Redirecting to workspace setup...");
      setTimeout(() => {
        router.push("/onboarding");
      }, 1500);
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