"use client";

import { AlertTriangle, WifiOff, Settings } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { isRouteErrorPayload } from "@/lib/fetch-json";

interface ServiceBannerProps {
  service: "AllCodex" | "AllKnower";
  error: unknown;
}

/**
 * Renders a service status banner for "AllCodex" or "AllKnower" showing an icon, a short status label, the error message, and an optional link to settings.
 *
 * @param service - The service name to display; either `"AllCodex"` or `"AllKnower"`.
 * @param error - The error payload to display. Can be any value; the component derives a display message from it and decides whether to show a Settings link when the error indicates the service is not configured or credentials are expired.
 * @returns A React element containing the styled banner with icon, status text, error message, and an optional Settings link.
 */
export function ServiceBanner({ service, error }: ServiceBannerProps) {
  const code = error instanceof Error ? "SERVICE_ERROR" : isRouteErrorPayload(error) ? error.error : "SERVICE_ERROR";
  const message = error instanceof Error ? error.message : isRouteErrorPayload(error) ? error.message : String(error);
  const needsSettings = code === "NOT_CONFIGURED" || code === "UNAUTHORIZED";
  const Icon = code === "UNREACHABLE" ? WifiOff : AlertTriangle;

  const label =
    code === "NOT_CONFIGURED"
      ? "not connected"
      : code === "UNAUTHORIZED"
        ? "credentials expired"
        : "unavailable";

  return (
    <div
      className={`rounded-lg border p-4 flex items-start gap-3 ${
        needsSettings
          ? "border-yellow-500/30 bg-yellow-500/10"
          : "border-red-500/30 bg-red-500/10"
      }`}
    >
      <Icon
        className={`h-4 w-4 mt-0.5 shrink-0 ${
          needsSettings ? "text-yellow-400" : "text-red-400"
        }`}
      />
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-medium ${
            needsSettings ? "text-yellow-300" : "text-red-300"
          }`}
        >
          {service} {label}
        </p>
        <p
          className={`text-xs mt-0.5 ${
            needsSettings ? "text-yellow-400/80" : "text-red-400/80"
          }`}
        >
          {message}
        </p>
      </div>
      {needsSettings && (
        <Button
          asChild
          size="sm"
          variant="outline"
          className="shrink-0 border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10"
        >
          <Link href="/settings">
            <Settings className="h-3.5 w-3.5 mr-1.5" />
            Settings
          </Link>
        </Button>
      )}
    </div>
  );
}
