"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Brain,
  Clock,
  BookOpen,
  Plus,
  Pencil,
  Cpu,
  Zap,
} from "lucide-react";
import Link from "next/link";

interface BrainDumpDetailEntry {
  id: string;
  rawText: string;
  summary: string | null;
  notesCreated: string[];
  notesUpdated: string[];
  model: string;
  tokensUsed: number | null;
  createdAt: string;
  parsedJson: {
    entities?: Array<{
      noteId?: string;
      title: string;
      type: string;
      action?: "created" | "updated" | "skipped";
    }>;
    summary?: string;
  } | null;
}

/**
 * Renders the Brain Dump detail page for a single history entry, showing metadata (timestamp, model, tokens),
 * activity stats (created/updated counts), the raw text, an AI-generated summary, and a list of affected entities.
 *
 * Sections are rendered conditionally based on load state and available entry data; entity items link to notes when a `noteId` is present.
 *
 * @returns The JSX element for the Brain Dump detail page.
 */
export default function BrainDumpDetailPage() {
  const { id } = useParams<{ id: string }>();

  const { data: entry, isLoading, error } = useQuery<BrainDumpDetailEntry>({
    queryKey: ["brain-dump-entry", id],
    queryFn: async () => {
      const r = await fetch(`/api/brain-dump/history/${id}`);
      if (!r.ok) throw await r.json();
      return r.json();
    },
  });

  const entities = entry?.parsedJson?.entities ?? [];
  const summary = entry?.summary ?? entry?.parsedJson?.summary ?? null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back */}
      <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
        <Link href="/brain-dump">
          <ArrowLeft className="h-4 w-4" />
          Brain Dump
        </Link>
      </Button>

      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-primary"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Brain Dump Detail
        </h1>
        {isLoading ? (
          <Skeleton className="h-4 w-40 mt-1" />
        ) : entry ? (
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-3">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(entry.createdAt).toLocaleString()}
            </span>
            {entry.model && (
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" />
                {entry.model}
              </span>
            )}
            {entry.tokensUsed && (
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {entry.tokensUsed.toLocaleString()} tokens
              </span>
            )}
          </p>
        ) : null}
      </div>

      {error && (
        <p className="text-sm text-destructive rounded-none bg-destructive/10 border border-destructive/20 p-3">
          Failed to load entry.
        </p>
      )}

      {/* Stats */}
      {!isLoading && entry && (
        <div className="flex gap-6">
          <div className="text-center">
            <div
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              {entry.notesCreated.length}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Plus className="h-3 w-3" /> Created
            </div>
          </div>
          <div className="text-center">
            <div
              className="text-2xl font-bold text-primary"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              {entry.notesUpdated.length}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <Pencil className="h-3 w-3" /> Updated
            </div>
          </div>
        </div>
      )}

      {/* Raw text */}
      <div className="rounded-none border border-border/30 bg-card/40 overflow-hidden">
        <div className="px-4 py-3 border-b border-border/20">
          <p className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Raw Text</p>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-full" />
              ))}
            </div>
          ) : (
            <blockquote className="border-l-2 border-border/40 pl-4 text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
              {entry?.rawText}
            </blockquote>
          )}
        </div>
      </div>

      {/* AI Summary */}
      {(isLoading || summary) && (
        <div className="rounded-none border border-primary/20 bg-primary/5 border-l-2 border-l-primary/40 overflow-hidden">
          <div className="px-4 py-3 border-b border-primary/15">
            <h3
              className="text-sm text-primary flex items-center gap-2 font-semibold"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              <Brain className="h-4 w-4" />
              AllKnower Summary
            </h3>
          </div>
          <div className="p-4">
            {isLoading ? (
              <Skeleton className="h-4 w-3/4" />
            ) : (
              <p className="text-sm text-foreground/80 leading-relaxed italic">
                {summary}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Entity cards */}
      {(isLoading || entities.length > 0) && (
        <div>
          <h2
            className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            Entries Affected
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {entities.map((e, i) => {
                const action = e.action ?? "created";
                const className = `flex items-center gap-3 border-l-2 p-3 hover:bg-card/70 transition-colors ${
                  action === "created"
                    ? "border-l-[var(--accent)] bg-[var(--accent)]/5"
                    : "border-l-primary/60 bg-primary/5"
                }`;
                const inner = (
                  <>
                    <div className={`p-2 shrink-0 ${action === "created" ? "text-[var(--accent)]" : "text-primary"}`}>
                      <BookOpen className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      <p className="text-xs text-muted-foreground capitalize">{e.type}</p>
                    </div>
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] rounded-none ${
                        action === "created"
                          ? "text-[var(--accent)] border-[var(--accent)]/40"
                          : "text-primary border-primary/40"
                      }`}
                    >
                      {action}
                    </Badge>
                  </>
                );
                return e.noteId ? (
                  <Link key={e.noteId} href={`/lore/${e.noteId}`} className={className}>{inner}</Link>
                ) : (
                  <div key={e.title ?? i} className={className}>{inner}</div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
