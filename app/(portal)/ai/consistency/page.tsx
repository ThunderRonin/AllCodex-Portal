"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldAlert, RefreshCw, AlertTriangle, Info, AlertCircle, X } from "lucide-react";
import Link from "next/link";
import { ServiceBanner } from "@/components/portal/ServiceBanner";

interface ConsistencyIssue {
  type: "contradiction" | "timeline" | "orphan" | "naming";
  severity: "high" | "medium" | "low";
  description: string;
  affectedNoteIds: string[];
}

interface ConsistencyResult {
  issues: ConsistencyIssue[];
  summary: string;
}

const SEVERITY_CONFIG = {
  high: { icon: AlertCircle, color: "text-red-400", border: "border-red-500/30", bg: "bg-red-500/5", badge: "text-red-400 border-red-500/40" },
  medium: { icon: AlertTriangle, color: "text-yellow-400", border: "border-yellow-500/30", bg: "bg-yellow-500/5", badge: "text-yellow-400 border-yellow-500/40" },
  low: { icon: Info, color: "text-blue-400", border: "border-blue-500/30", bg: "bg-blue-500/5", badge: "text-blue-400 border-blue-500/40" },
};

const TYPE_LABELS: Record<string, string> = {
  contradiction: "Contradiction",
  timeline: "Timeline Conflict",
  orphan: "Orphaned Reference",
  naming: "Naming Inconsistency",
};

export default function ConsistencyPage() {
  const [noteIdInput, setNoteIdInput] = useState("");
  const [result, setResult] = useState<ConsistencyResult | null>(null);

  const noteIds = noteIdInput
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const { mutate: runCheck, isPending, error: checkError } = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/ai/consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds: noteIds.length ? noteIds : undefined }),
      });
      if (!r.ok) throw await r.json();
      return r.json();
    },
    onSuccess: (data: ConsistencyResult) => setResult(data),
  });

  const highCount = result?.issues.filter((i) => i.severity === "high").length ?? 0;
  const medCount = result?.issues.filter((i) => i.severity === "medium").length ?? 0;
  const lowCount = result?.issues.filter((i) => i.severity === "low").length ?? 0;

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1
          className="text-2xl font-bold text-primary"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Consistency Check
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Scans your lore for contradictions, timeline conflicts, orphaned references,
          and naming inconsistencies.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="pt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="note-ids" className="text-xs text-muted-foreground">
              Specific Note IDs (optional — leave blank to scan all lore)
            </Label>
            <Input
              id="note-ids"
              placeholder="noteId1, noteId2, noteId3"
              value={noteIdInput}
              onChange={(e) => setNoteIdInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground/60">
              Comma-separated. If blank, checks up to 30 lore entries.
            </p>
          </div>
          <Button onClick={() => runCheck()} disabled={isPending} className="gap-2" size="sm">
            {isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                Run Check
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {!isPending && checkError && <ServiceBanner service="AllKnower" error={checkError} />}

      {result && !isPending && (
        <div className="space-y-6">
          {/* Summary */}
          <Card className="border-border/60">
            <CardHeader className="pb-3 border-b border-border/30">
              <CardTitle
                className="text-sm uppercase tracking-wider text-primary"
                style={{ fontFamily: "var(--font-cinzel)" }}
              >
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm leading-relaxed">{result.summary}</p>
              <div className="flex gap-4">
                <div className="text-center">
                  <div className="text-xl font-bold text-red-400">{highCount}</div>
                  <div className="text-xs text-muted-foreground">High</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-yellow-400">{medCount}</div>
                  <div className="text-xs text-muted-foreground">Medium</div>
                </div>
                <div className="text-center">
                  <div className="text-xl font-bold text-blue-400">{lowCount}</div>
                  <div className="text-xs text-muted-foreground">Low</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {result.issues.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-center gap-3">
              <ShieldAlert className="h-12 w-12 text-green-400/50" />
              <p className="text-sm font-medium text-green-400">No issues found</p>
              <p className="text-xs text-muted-foreground">Your lore is internally consistent.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {result.issues.map((issue, i) => {
                const cfg = SEVERITY_CONFIG[issue.severity];
                const Icon = cfg.icon;
                return (
                  <div
                    key={i}
                    className={`rounded-lg border ${cfg.border} ${cfg.bg} p-4 space-y-2`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${cfg.color}`} />
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-xs ${cfg.badge}`}>
                            {TYPE_LABELS[issue.type] ?? issue.type}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${cfg.badge}`}>
                            {issue.severity}
                          </Badge>
                        </div>
                        <p className="text-sm">{issue.description}</p>
                        {issue.affectedNoteIds?.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1">
                            {issue.affectedNoteIds.map((nid) => (
                              <Link
                                key={nid}
                                href={`/lore/${nid}`}
                                className="text-xs text-primary/70 hover:text-primary bg-secondary/50 rounded px-1.5 py-0.5 transition-colors"
                              >
                                {nid}
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
