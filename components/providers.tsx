"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";

/**
 * Wraps application content with theme, React Query, and tooltip providers.
 *
 * Renders `children` inside a ThemeProvider (class-based, defaulting to `dark` with system sync disabled),
 * a QueryClientProvider (single client instance configured with queries `staleTime: 30000` and `retry: 1`),
 * and a TooltipProvider (300ms delay).
 *
 * @param children - The React nodes to render inside the provider tree
 * @returns The provider-wrapped `children` as a JSX element
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      })
  );

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={300}>{children}</TooltipProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
