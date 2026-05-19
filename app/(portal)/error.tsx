"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Client-side error UI that logs the provided error to the console and displays a retry action.
 *
 * @param error - Error object (may include `digest`) whose message is shown to the user
 * @param reset - Callback invoked when the user requests to retry
 * @returns A React element rendering the error message and a "Try again" button
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[portal error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="font-cinzel text-xl text-foreground">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || "An unexpected error occurred. Try again or reload the page."}
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
