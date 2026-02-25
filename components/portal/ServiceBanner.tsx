"use client";

import Link from "next/link";
import { AlertTriangle, WifiOff, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

type ErrorPayload = { error: string; message: string };

function parseError(e: unknown): ErrorPayload {
  if (
    typeof e === "object" &&
    e !== null &&
    "error" in e &&
    "message" in e
  ) {
    return e as ErrorPayload;
  }
  return { error: "SERVICE_ERROR", message: String(e) };
}

interface ServiceBannerProps {
  service: "AllCodex" | "AllKnower";
  error: unknown;
}

export function ServiceBanner({ service, error }: ServiceBannerProps) {
  const { error: code, message } = parseError(error);
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
