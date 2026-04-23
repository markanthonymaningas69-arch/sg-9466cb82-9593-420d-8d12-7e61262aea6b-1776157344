import type React from "react";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Check, ChevronsUpDown } from "lucide-react";
import { authService } from "@/services/authService";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { supabase } from "@/integrations/supabase/client";
import { COUNTRY_OPTIONS, OUT_OF_SERVICE_MESSAGE, isSupportedCountry, type CountryOption } from "@/config/pricing";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const router = useRouter();
  const [fullName, setFullName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [country, setCountry] = useState<CountryOption | "">("");
  const [countrySearch, setCountrySearch] = useState<string>("");
  const [countryOpen, setCountryOpen] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (!router.isReady) {
      return;
    }

    const queryCountry = router.query.country;
    if (typeof queryCountry === "string" && COUNTRY_OPTIONS.includes(queryCountry as CountryOption)) {
      setCountry(queryCountry as CountryOption);
    }
  }, [router.isReady, router.query.country]);

  const filteredCountries = useMemo(() => {
    const normalizedSearch = countrySearch.trim().toLowerCase();

    if (!normalizedSearch) {
      return COUNTRY_OPTIONS;
    }

    return COUNTRY_OPTIONS.filter((option) => option.toLowerCase().startsWith(normalizedSearch));
  }, [countrySearch]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!country) {
      setError("Please select a country.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!isSupportedCountry(country)) {
      setError(OUT_OF_SERVICE_MESSAGE);
      return;
    }

    setSubmitting(true);

    const { user, error: authError } = await authService.signUp(email, password);

    if (authError) {
      setError(authError.message);
      setSubmitting(false);
      return;
    }

    if (user) {
      await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName,
        assigned_module: null,
        country
      });

      setSuccess("Account created successfully. Redirecting to workspace setup...");
      setTimeout(() => {
        router.push("/onboarding");
      }, 1500);
    }

    setSubmitting(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
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
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="country-selector">Country</Label>
              <Popover
                open={countryOpen}
                onOpenChange={(open) => {
                  setCountryOpen(open);
                  if (!open) {
                    setCountrySearch("");
                  }
                }}
              >
                <PopoverTrigger asChild>
                  <Button
                    id="country-selector"
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={countryOpen}
                    disabled={submitting}
                    className={cn("w-full justify-between font-normal")}
                  >
                    <span className="truncate">{country}</span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                  <Command shouldFilter={false}>
                    <CommandInput
                      value={countrySearch}
                      onValueChange={setCountrySearch}
                      placeholder="Type country"
                    />
                    <CommandList>
                      <CommandEmpty>No country found.</CommandEmpty>
                      <CommandGroup>
                        {filteredCountries.map((option) => (
                          <CommandItem
                            key={option}
                            value={option}
                            onSelect={() => {
                              setCountry(option);
                              setCountryOpen(false);
                              setCountrySearch("");
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                country === option ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {option}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
              <p className="rounded bg-destructive/10 p-2 text-sm font-medium text-destructive">
                {error}
              </p>
            )}
            {success && (
              <p className="rounded border border-green-200 bg-green-50 p-2 text-sm font-medium text-green-700">
                {success}
              </p>
            )}
            {country && !isSupportedCountry(country) && (
              <p className="rounded bg-destructive/10 p-2 text-sm font-medium text-destructive">
                {OUT_OF_SERVICE_MESSAGE}
              </p>
            )}

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? "Processing..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link
              href="/auth/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Log in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}