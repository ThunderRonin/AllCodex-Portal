"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

/**
 * Render an error UI for brain-dump failures and log the error to the console.
 *
 * Logs the provided `error` to `console.error` when the component mounts or when `error` changes.
 *
 * @param error - The error to display; its `message` is shown and it may include a `digest` field for grouping.
 * @param reset - Callback invoked when the user clicks the "Try again" button to retry or reset the error state.
 * @returns A React element that displays the brain dump error UI.
 */
export default function BrainDumpError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[brain dump error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="font-cinzel text-xl text-foreground">Brain dump unavailable</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || "The brain dump pipeline encountered an error. Check that AllKnower is running."}
      </p>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
