"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { useAuth } from "~/components/ui/orion/authProvider";
import { getSupportedAuthenticationProviders } from "~/hooks/api/auth";
import { trpc } from "~/trpc/client";

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoggingIn, isAuthenticated } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const { data: providers, isPending: isLoadingProviders } = getSupportedAuthenticationProviders();
  console.log(providers);
  const googleProvider = providers?.find((provider) => provider.provider === "GOOGLE_OAUTH");
  console.log(googleProvider);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  async function handleEmailLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    try {
      await login({ email, password });
      router.replace("/");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Unable to log in.");
    }
  }

  function handleGoogleLogin() {
    if (!googleProvider?.authUrl) return;
    console.log(googleProvider.authUrl);
    debugger;
    window.location.href = googleProvider.authUrl;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Log in</CardTitle>
          <CardDescription>Use your email and password, or continue with Google.</CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {formError ? (
            <Alert variant="destructive">
              <AlertDescription>{formError}</AlertDescription>
            </Alert>
          ) : null}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoggingIn}>
              {isLoggingIn ? "Logging in..." : "Log in"}
            </Button>
          </form>

          <div className="relative text-center text-sm text-muted-foreground">
            <span className="bg-card px-2">or</span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isLoadingProviders || !googleProvider?.authUrl}
          >
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
