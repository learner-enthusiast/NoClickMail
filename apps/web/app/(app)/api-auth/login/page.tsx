"use client";

import React from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { Card, CardContent } from "~/components/ui/card";
import { GoogleSignInButton } from "~/components/ui/GoogleSignInButton";

import { useAuth } from "~/components/ui/orion/authProvider";
import { getSupportedAuthenticationProviders } from "~/hooks/api/auth";
export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  const { data: providers, isPending: isLoadingProviders } = getSupportedAuthenticationProviders();

  const googleProvider = providers?.find((provider) => provider.provider === "GOOGLE_OAUTH");

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/");
    }
  }, [isAuthenticated, router]);

  function handleGoogleLogin() {
    if (!googleProvider?.authUrl) return;
    window.location.href = googleProvider.authUrl;
  }

  return (
    <main className="flex  items-center justify-center px-4 flex-col gap-5 overflow-hidden">
      <Image
        src="/loginBg.png"
        alt=""
        fill
        priority
        className="-z-10 object-cover object-center w-full h-full"
        aria-hidden
      />
      <Image
        src="/loginBg-light.png"
        alt=""
        fill
        priority
        className="-z-10 object-cover object-center w-full h-full dark:hidden"
        aria-hidden
      />
      <div className="flex flex-col gap-5 items-center justify-center mt-14">
        <Image src="/orion.png" alt="Logo" width={100} height={100} />
        <p className="text-5xl">Orion</p>
        <p className="text-2xl text-muted-foreground">QUIET INTELLIGENCE</p>
      </div>
      <Card className="w-full max-w-md items-center justify-center text-center ">
        <CardContent className="space-y-6">
          <p className="text-2xl font-bold">Welcome Back</p>
          <p>Sign in to your account to continue</p>
          <GoogleSignInButton
            onClick={handleGoogleLogin}
            disabled={isLoadingProviders || !googleProvider?.authUrl}
          />
        </CardContent>
      </Card>
    </main>
  );
}
