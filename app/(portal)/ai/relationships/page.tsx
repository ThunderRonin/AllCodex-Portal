"use client";

import { useMutation } from "@tanstack/react-query";
import { useAIToolsStore } from "@/lib/stores/ai-tools-store";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Network, RefreshCw, ArrowRight, Plus, Check, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense, useState } from "react";
import { ServiceBanner } from "@/components/portal/ServiceBanner";

interface Suggestion {
  targetNoteId: string;
  targetTitle: string;
  relationshipType: string;
  description: string;
  confidence?: "high" | "medium" | "low";
}

const RELATION_COLORS: Record<string, string> = {
  ally: "text-green-400 border-green-500/40",
  enemy: "text-red-400 border-red-500/40",
  rival: "text-orange-400 border-orange-500/40",
  family: "text-pink-400 border-pink-500/40",
  member_of: "text-violet-400 border-violet-500/40",
  leader_of: "text-purple-400 border-purple-500/40",
  serves: "text-indigo-400 border-indigo-500/40",
  located_in: "text-sky-400 border-sky-500/40",
  originates_from: "text-cyan-400 border-cyan-500/40",
  participated_in: "text-amber-400 border-amber-500/40",
  caused: "text-yellow-500 border-yellow-500/40",
  created: "text-emerald-400 border-emerald-500/40",
  owns: "text-orange-300 border-orange-400/40",
  wields: "text-fuchsia-400 border-fuchsia-500/40",
  worships: "text-violet-300 border-violet-400/40",
  inhabits: "text-teal-400 border-teal-500/40",
  related_to: "text-muted-foreground border-border",
};

interface ApplyRelationshipsResult {
  applied: Array<{
    sourceNoteId: string;
    targetNoteId: string;
    relationshipType: string;
    relationName: string;
  }>;
  skipped: Array<{
    sourceNoteId: string;
    targetNoteId: string;
    relationshipType: string;
    reason: string;
  }>;
  failed: Array<{
    sourceNoteId: string;
    targetNoteId: string;
    relationshipType: string;
    error: string;
  }>;
}

/**
 * Render the Relationship Suggestions UI that lets the user paste lore text, fetch AI-generated relationship suggestions, and apply selected bidirectional relationships to a note.
 *
 * The component reads an optional `noteId` from URL search params and, when present, loads the note's plain text into the input. It posts the pasted or loaded text to the suggestions API, presents results with apply controls, and manages per-suggestion application state and failure messages.
 *
 * @returns A React element containing the relationship suggestions interface.
 */
function RelationshipsContent() {
  const searchParams = useSearchParams();
  const noteId = searchParams.get("noteId");
  const [failures, setFailures] = useState<Record<string, string>>({});
  const {
    relationText: text,
    setRelationText: setText,
    suggestions,
    setSuggestions,
    appliedRelations,
    addApplied,
    resetApplied,
  } = useAIToolsStore();

  useEffect(() => {
    if (!noteId) return;
    fetch(`/api/lore/${noteId}/content`)
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to fetch note: ${r.status}`);
        return r.text();
      })
      .then((html) => {
        const doc = new DOMParser().parseFromString(html, "text/html");
        const plain = (doc.body.textContent || "").replace(/\s+/g, " ").trim();
        setText(plain);
      })
      .catch(() => {
        setText("");
      });
  }, [noteId]);

  const { mutate: getSuggestions, isPending, error: suggestionError } = useMutation({
    mutationFn: async (t: string) => {
      const r = await fetch("/api/ai/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t, ...(noteId ? { noteId } : {}) }),
      });
      if (!r.ok) throw await r.json();
      return r.json();
    },
    onSuccess: (data: { suggestions: Suggestion[] }) => {
      setSuggestions(data.suggestions ?? []);
      resetApplied(); // reset applied state on new results
      setFailures({});
    },
  });

  const { mutate: applyRelation, variables: applyingVars } = useMutation({
    mutationFn: async ({ suggestion }: { suggestion: Suggestion; key: string }) => {
      if (!noteId) throw new Error("No note ID");
      const r = await fetch("/api/ai/relationships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceNoteId: noteId,
          relations: [{
            targetNoteId: suggestion.targetNoteId,
            relationshipType: suggestion.relationshipType,
            description: suggestion.description,
          }],
          bidirectional: true,
        }),
      });
      if (!r.ok) throw new Error("Failed to apply relation");
      return r.json() as Promise<ApplyRelationshipsResult>;
    },
    onSuccess: (result, { key }) => {
      const appliedKeys = new Set(result.applied.map((rel) => `${rel.targetNoteId}::${rel.relationshipType}`));
      const skippedKeys = new Set(result.skipped.map((rel) => `${rel.targetNoteId}::${rel.relationshipType}`));
      const failedByKey = Object.fromEntries(
        result.failed.map((rel) => [`${rel.targetNoteId}::${rel.relationshipType}`, rel.error]),
      );

      if (appliedKeys.has(key) || skippedKeys.has(key)) {
        addApplied(key);
      }
      
      setFailures((prev) => {
        const next = { ...prev };
        delete next[key];
        for (const [failedKey, error] of Object.entries(failedByKey)) {
          next[failedKey] = error;
        }
        return next;
      });
    },
    onError: (error, { key }) => {
      setFailures((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Failed to apply relation.",
      }));
    },
  });

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1
          className="text-2xl font-bold text-primary"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Relationship Suggestions
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Paste a lore entry and AllKnower will suggest meaningful connections
          to existing entries in the chronicle.
        </p>
      </div>

      <Card className="border-border/60">
        <CardContent className="pt-5 space-y-3">
          <Textarea
            placeholder="Paste the text of a lore entry here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="resize-none"
            disabled={isPending}
          />
          <Button
            onClick={() => getSuggestions(text)}
            disabled={!text.trim() || isPending}
            className="gap-2"
            size="sm"
          >
            {isPending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Searching…
              </>
            ) : (
              <>
                <Network className="h-4 w-4" />
                Find Connections
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      )}

      {!isPending && suggestionError && <ServiceBanner service="AllKnower" error={suggestionError} />}

      {!isPending && suggestions.length > 0 && (
        <div className="space-y-3">
          <p
            className="text-xs uppercase tracking-wider text-muted-foreground"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            {suggestions.length} suggested connections
          </p>
          {suggestions.map((s, i) => {
            const colorClass =
              RELATION_COLORS[s.relationshipType] ?? RELATION_COLORS.other;
            const key = `${s.targetNoteId}::${s.relationshipType}`;
            const isApplied = appliedRelations.includes(key);
            const isApplying = applyingVars?.key === key;
            const failure = failures[key];
            return (
              <div
                key={i}
                className="rounded-lg border border-border/50 bg-card/60 p-4 space-y-2 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs capitalize ${colorClass}`}>
                      {s.relationshipType.replace(/_/g, " ")}
                    </Badge>
                    {s.confidence && (
                      <span className={`text-[10px] font-medium uppercase tracking-wide ${
                        s.confidence === "high" ? "text-green-400" :
                        s.confidence === "medium" ? "text-yellow-400" :
                        "text-muted-foreground"
                      }`}>
                        {s.confidence}
                      </span>
                    )}
                    <Link
                      href={`/lore/${s.targetNoteId}`}
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {s.targetTitle}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/50 font-mono hidden sm:inline">
                      {s.targetNoteId}
                    </span>
                    {noteId && (
                      <Button
                        size="sm"
                        variant={isApplied ? "secondary" : "outline"}
                        className="h-7 px-2 gap-1 text-xs"
                        disabled={isApplied || isApplying}
                        onClick={() => applyRelation({ suggestion: s, key })}
                      >
                        {isApplied ? (
                          <>
                            <Check className="h-3 w-3" />
                            Applied
                          </>
                        ) : isApplying ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <Plus className="h-3 w-3" />
                            Apply
                          </>
                        )}
                      </Button>
                    )}
                  </div>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {s.description}
                </p>
                {failure && (
                  <p className="text-sm text-destructive leading-relaxed mt-1">
                    Failed: {failure}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isPending && suggestions.length === 0 && text && (
        <div className="text-center py-12 text-muted-foreground">
          <Network className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">Run a search to see suggested connections.</p>
        </div>
      )}
    </div>
  );
}

export default function RelationshipsPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <RelationshipsContent />
    </Suspense>
  );
}
