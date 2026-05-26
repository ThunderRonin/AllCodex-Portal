"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
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
  FileText,
  Code2,
} from "lucide-react";
import Link from "next/link";
import { computeLineDiff, htmlToPlain } from "@/components/portal/diff-helpers";

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
    revisions?: Array<{
      noteId: string;
      title: string;
      contentBefore: string;
      contentAfter: string;
    }>;
  } | null;
}

function RevisionDiffCard({ rev }: { rev: { noteId: string; title: string; contentBefore: string; contentAfter: string } }) {
  const [diffMode, setDiffMode] = useState<"visual" | "raw">("visual");

  const beforeText = useMemo(() => {
    return diffMode === "visual" ? htmlToPlain(rev.contentBefore) : rev.contentBefore;
  }, [rev.contentBefore, diffMode]);

  const afterText = useMemo(() => {
    return diffMode === "visual" ? htmlToPlain(rev.contentAfter) : rev.contentAfter;
  }, [rev.contentAfter, diffMode]);

  const diffLines = useMemo(() => computeLineDiff(beforeText, afterText), [beforeText, afterText]);

  let leftNo = 0;
  let rightNo = 0;

  return (
    <div className="rounded-none border border-border/30 bg-card/40 overflow-hidden">
      {/* Card Header */}
      <div className="px-4 py-3 border-b border-border/20 flex flex-wrap items-center justify-between gap-2 bg-muted/5">
        <div className="flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          {rev.noteId ? (
            <Link href={`/lore/${rev.noteId}`} className="text-sm font-semibold text-primary hover:underline">
              {rev.title || "Untitled Lore"}
            </Link>
          ) : (
            <span className="text-sm font-semibold text-primary">{rev.title || "Untitled Lore"}</span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            variant={diffMode === "visual" ? "secondary" : "ghost"}
            className="h-7 text-xs rounded-none gap-1"
            onClick={() => setDiffMode("visual")}
          >
            <FileText className="h-3.5 w-3.5" />
            Visual Text
          </Button>
          <Button
            size="sm"
            variant={diffMode === "raw" ? "secondary" : "ghost"}
            className="h-7 text-xs rounded-none gap-1"
            onClick={() => setDiffMode("raw")}
          >
            <Code2 className="h-3.5 w-3.5" />
            Raw HTML Source
          </Button>
        </div>
      </div>

      {/* Card Body — The diff lines */}
      <div className="overflow-x-auto max-h-[400px] overflow-y-auto font-mono text-xs bg-muted/10 select-text">
        {diffLines.length === 0 ? (
          <div className="p-4 text-muted-foreground italic text-center">No content changes.</div>
        ) : (
          <div className="min-w-[600px] divide-y divide-border/5">
            {diffLines.map((line, lineIdx) => {
              let leftVal = "";
              let rightVal = "";
              let prefix = " ";
              let rowClass = "text-muted-foreground/80 hover:bg-muted/5";
              let numClass = "text-muted-foreground/30 border-r border-border/15 select-none text-right pr-2 w-10 shrink-0 font-sans text-[10px]";
              
              if (line.type === "added") {
                rightNo++;
                rightVal = rightNo.toString();
                prefix = "+";
                rowClass = "bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/30 border-l-2 border-l-emerald-500/80";
              } else if (line.type === "removed") {
                leftNo++;
                leftVal = leftNo.toString();
                prefix = "-";
                rowClass = "bg-rose-950/20 text-rose-400 hover:bg-rose-950/30 border-l-2 border-l-rose-500/80";
              } else {
                leftNo++;
                rightNo++;
                leftVal = leftNo.toString();
                rightVal = rightNo.toString();
                prefix = " ";
              }

              return (
                <div key={lineIdx} className={`flex items-start ${rowClass} py-0.5 leading-5`}>
                  <div className={`${numClass} mr-2`}>{leftVal}</div>
                  <div className={`${numClass} mr-2`}>{rightVal}</div>
                  <div className="w-5 select-none text-center font-bold text-[11px] font-mono shrink-0">{prefix}</div>
                  <div className="flex-1 whitespace-pre-wrap pl-2 break-all pr-4">{line.text || " "}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
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

      {/* Lore Revisions Diff */}
      {!isLoading && entry && entry.parsedJson?.revisions && entry.parsedJson.revisions.length > 0 && (
        <div className="space-y-4 pt-4 border-t border-border/20">
          <h2
            className="text-sm font-semibold text-muted-foreground uppercase tracking-wider"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            Detailed Lore Revisions
          </h2>
          <div className="space-y-6">
            {entry.parsedJson.revisions.map((rev, idx) => (
              <RevisionDiffCard key={rev.noteId || idx} rev={rev} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
