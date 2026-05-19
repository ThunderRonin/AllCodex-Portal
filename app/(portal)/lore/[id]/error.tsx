"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/**
 * Renders a centered fallback UI for when a lore entry fails to load.
 *
 * Also logs the provided `error` to the console with the tag "[lore detail error]".
 *
 * @param error - The error that occurred (may include an optional `digest` field); its `message` is shown in the UI when present.
 * @param reset - Callback invoked when the user requests a retry (wired to the "Try again" button).
 * @returns A React element displaying the error message and actions to retry or navigate back to the lore list.
 */
export default function LoreDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[lore detail error]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="font-cinzel text-xl text-foreground">Could not load lore entry</h2>
      <p className="text-sm text-muted-foreground max-w-md">
        {error.message || "This entry may have been deleted or is temporarily unavailable."}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          Try again
        </Button>
        <Button variant="ghost" asChild>
          <Link href="/lore">Back to Lore</Link>
        </Button>
      </div>
    </div>
  );
}
