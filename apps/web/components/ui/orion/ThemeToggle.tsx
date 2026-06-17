"use client";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "../button";
import { Moon, Sun } from "lucide-react";
export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null; // avoid hydration mismatch
  const isDark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}
