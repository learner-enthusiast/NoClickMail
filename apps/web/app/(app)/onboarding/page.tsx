"use client";

import { useEffect } from "react";

export default function OnboardingPage() {
  useEffect(() => {
    window.location.href = "/dashboard/inbox";
  }, []);

  return null;
}
