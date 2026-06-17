"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Renders an error UI indicating that AI tools are unavailable.
 *
 * Displays the error message when present or a fallback prompt to verify AllKnower in Settings, and provides a "Try again" button that invokes `reset`. Logs the provided `error` to the console whenever it changes.
 *
 * @param error - The error object to display; may include an optional `digest` field.
 * @param reset - Callback invoked when the user clicks the "Try again" button to retry loading the AI tool.
 * @returns The rendered error UI for unavailable AI tools.
 */
export default function AIToolsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[ai tools error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="font-cinzel text-xl text-foreground">Automated tools unavailable</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || "Could not load this tool. Verify that AllKnower is connected in Settings."}
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
