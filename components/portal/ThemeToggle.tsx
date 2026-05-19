"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

/**
 * Renders an icon-only button that toggles the Next.js theme between "light" and "dark".
 *
 * Before the component is mounted on the client, it renders an inert ghost icon button containing only a screen-reader label ("Toggle theme") to avoid hydration mismatches. After mounting it renders an interactive ghost icon button that flips the theme via `setTheme`. The button visually shows a sun in light mode and a moon in dark mode (icons are animated via CSS classes) and includes an accessible label.
 *
 * @returns The themed toggle button element; inert before client mount, interactive after mount.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="min-h-11 min-w-11 rounded-full">
        <span className="sr-only">Toggle theme</span>
      </Button>
    );
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="min-h-11 min-w-11 rounded-full"
      onClick={() => setTheme(theme === "light" ? "dark" : "light")}
    >
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Toggle theme</span>
    </Button>
  );
}
