"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Network, RefreshCw, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, Suspense } from "react";

interface Suggestion {
  targetNoteId: string;
  targetTitle: string;
  relationshipType: string;
  description: string;
}

const RELATION_COLORS: Record<string, string> = {
  ally: "text-green-400 border-green-500/40",
  enemy: "text-red-400 border-red-500/40",
  family: "text-pink-400 border-pink-500/40",
  location: "text-blue-400 border-blue-500/40",
  event: "text-yellow-400 border-yellow-500/40",
  faction: "text-purple-400 border-purple-500/40",
  other: "text-muted-foreground border-border",
};

function RelationshipsContent() {
  const searchParams = useSearchParams();
  const noteId = searchParams.get("noteId");
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  useEffect(() => {
    if (noteId) {
      // Pre-fill with note ID info if provided
      setText(`Note ID: ${noteId}\n\n`);
    }
  }, [noteId]);

  const { mutate: getSuggestions, isPending } = useMutation({
    mutationFn: (t: string) =>
      fetch("/api/ai/relationships", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: t }),
      }).then((r) => r.json()),
    onSuccess: (data: { suggestions: Suggestion[] }) =>
      setSuggestions(data.suggestions ?? []),
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
            return (
              <div
                key={i}
                className="rounded-lg border border-border/50 bg-card/60 p-4 space-y-2 hover:border-primary/30 transition-colors"
              >
                <div className="flex items-center gap-2 justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-xs capitalize ${colorClass}`}>
                      {s.relationshipType}
                    </Badge>
                    <Link
                      href={`/lore/${s.targetNoteId}`}
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      {s.targetTitle}
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  </div>
                  <span className="text-xs text-muted-foreground/50 font-mono">
                    {s.targetNoteId}
                  </span>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {s.description}
                </p>
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
