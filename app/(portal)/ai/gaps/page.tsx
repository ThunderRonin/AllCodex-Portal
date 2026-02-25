"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Radar, RefreshCw, AlertCircle, Info } from "lucide-react";
import { ServiceBanner } from "@/components/portal/ServiceBanner";

interface Gap {
  area: string;
  description: string;
  severity: "high" | "medium" | "low";
  suggestion: string;
}

const SEVERITY_CONFIG = {
  high: {
    label: "High Priority",
    badge: "text-red-300 border-red-500/40 bg-red-500/10",
    border: "border-l-red-500",
    icon: <AlertCircle className="h-4 w-4 text-red-400" />,
  },
  medium: {
    label: "Medium Priority",
    badge: "text-yellow-300 border-yellow-500/40 bg-yellow-500/10",
    border: "border-l-yellow-500",
    icon: <AlertCircle className="h-4 w-4 text-yellow-400" />,
  },
  low: {
    label: "Low Priority",
    badge: "text-blue-300 border-blue-500/40 bg-blue-500/10",
    border: "border-l-blue-500",
    icon: <Info className="h-4 w-4 text-blue-400" />,
  },
};

export default function GapsPage() {
  const [enabled, setEnabled] = useState(false);

  const { data, isLoading, error, refetch } = useQuery<{ gaps: Gap[] }>({
    queryKey: ["gaps"],
    queryFn: async () => {
      const r = await fetch("/api/ai/gaps");
      if (!r.ok) throw await r.json();
      return r.json();
    },
    enabled,
  });

  const gaps = data?.gaps ?? [];
  const counts = {
    high: gaps.filter((g) => g.severity === "high").length,
    medium: gaps.filter((g) => g.severity === "medium").length,
    low: gaps.filter((g) => g.severity === "low").length,
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1
          className="text-2xl font-bold text-primary"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Lore Gap Detector
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          AllKnower scans your entire chronicle and identifies underdeveloped
          areas, missing backstory, and narrative inconsistencies.
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          onClick={() => {
            setEnabled(true);
            if (enabled) refetch();
          }}
          disabled={isLoading}
          className="gap-2"
        >
          {isLoading ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Scanning chronicle…
            </>
          ) : (
            <>
              <Radar className="h-4 w-4" />
              {enabled ? "Re-scan Chronicle" : "Scan for Gaps"}
            </>
          )}
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {error && <ServiceBanner service="AllKnower" error={error} />}

      {!isLoading && gaps.length > 0 && (
        <>
          {/* Summary bar */}
          <div className="flex gap-4">
            <Card className="flex-1 border-red-500/20">
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-red-400">{counts.high}</div>
                <div className="text-xs text-muted-foreground">High</div>
              </CardContent>
            </Card>
            <Card className="flex-1 border-yellow-500/20">
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-yellow-400">{counts.medium}</div>
                <div className="text-xs text-muted-foreground">Medium</div>
              </CardContent>
            </Card>
            <Card className="flex-1 border-blue-500/20">
              <CardContent className="py-3 text-center">
                <div className="text-2xl font-bold text-blue-400">{counts.low}</div>
                <div className="text-xs text-muted-foreground">Low</div>
              </CardContent>
            </Card>
          </div>

          {(["high", "medium", "low"] as const).map((severity) => {
            const severityGaps = gaps.filter((g) => g.severity === severity);
            if (severityGaps.length === 0) return null;
            const cfg = SEVERITY_CONFIG[severity];
            return (
              <div key={severity} className="space-y-2">
                <h2
                  className="text-xs uppercase tracking-wider text-muted-foreground"
                  style={{ fontFamily: "var(--font-cinzel)" }}
                >
                  {cfg.label}
                </h2>
                {severityGaps.map((gap, i) => (
                  <div
                    key={i}
                    className={`rounded-lg border border-border/50 border-l-4 ${cfg.border} bg-card/60 p-4 space-y-2`}
                  >
                    <div className="flex items-start gap-2 justify-between">
                      <div className="flex items-center gap-2">
                        {cfg.icon}
                        <span className="text-sm font-semibold text-foreground">
                          {gap.area}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs capitalize ${cfg.badge}`}
                      >
                        {severity}
                      </Badge>
                    </div>
                    <p className="text-sm text-foreground/70">{gap.description}</p>
                    <div className="rounded-md bg-muted/20 border border-border/30 px-3 py-2">
                      <p className="text-xs text-primary/80 italic">
                        <span className="font-medium text-primary not-italic">Suggestion: </span>
                        {gap.suggestion}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </>
      )}

      {!isLoading && enabled && gaps.length === 0 && !error && (
        <div className="text-center py-16 text-muted-foreground">
          <Radar className="h-12 w-12 mx-auto mb-3 opacity-20" />
          <p className="text-sm">
            No gaps detected. Your chronicle appears complete.
          </p>
        </div>
      )}

      {!enabled && (
        <div className="text-center py-16 text-muted-foreground">
          <Radar className="h-12 w-12 mx-auto mb-3 opacity-15" />
          <p className="text-sm">
            Click &ldquo;Scan for Gaps&rdquo; to analyse the entire lore
            chronicle.
          </p>
          <p className="text-xs mt-1 opacity-60">
            This may take a moment depending on chronicle size.
          </p>
        </div>
      )}
    </div>
  );
}
