"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  Sparkles,
  Clock,
  Plus,
  RefreshCw,
  BookOpen,
  Pencil,
} from "lucide-react";
import Link from "next/link";
import { ServiceBanner } from "@/components/portal/ServiceBanner";

interface BrainDumpResult {
  notesCreated: number;
  notesUpdated: number;
  summary: string;
  entities?: Array<{
    action: "created" | "updated";
    noteId: string;
    title: string;
    type: string;
  }>;
}

interface HistoryEntry {
  id: string;
  rawText: string;
  notesCreated: number;
  notesUpdated: number;
  model: string;
  tokensUsed: number | null;
  createdAt: string;
}

export default function BrainDumpPage() {
  const [text, setText] = useState("");
  const [result, setResult] = useState<BrainDumpResult | null>(null);
  const queryClient = useQueryClient();

  const { data: history, isLoading: historyLoading, error: historyError } = useQuery<HistoryEntry[]>({
    queryKey: ["brain-dump-history"],
    queryFn: async () => {
      const r = await fetch("/api/brain-dump/history");
      if (!r.ok) throw await r.json();
      return r.json();
    },
  });

  const { mutate: runDump, isPending, error: dumpError } = useMutation({
    mutationFn: async (rawText: string) => {
      const r = await fetch("/api/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText }),
      });
      if (!r.ok) throw await r.json();
      return r.json();
    },
    onSuccess: (data: BrainDumpResult) => {
      setResult(data);
      setText("");
      queryClient.invalidateQueries({ queryKey: ["brain-dump-history"] });
      queryClient.invalidateQueries({ queryKey: ["lore"] });
    },
  });

  const charCount = text.length;
  const isReady = charCount >= 10 && !isPending;

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold text-primary"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Brain Dump
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pour your raw worldbuilding thoughts here. AllKnower will extract, classify,
          and file every entity into the lore chronicle.
        </p>
      </div>

      {/* Input */}
      <Card className="border-border/60">
        <CardContent className="pt-4 space-y-3">
          <Textarea
            placeholder={`Write anything — story fragments, NPC ideas, place descriptions, plot points…\n\nExample:\n"Kaelthar is an elven archmage who lives in the Tower of Aethos in the Frostpeak Mountains. He was once the court wizard of King Aldric III before a rift drove him to exile. He hates the Thornwood Faction."`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="resize-none font-[var(--font-crimson)] text-base leading-relaxed"
            disabled={isPending}
          />
          <div className="flex items-center justify-between">
            <span
              className={`text-xs ${
                charCount < 10
                  ? "text-muted-foreground/50"
                  : charCount > 45000
                  ? "text-destructive"
                  : "text-muted-foreground"
              }`}
            >
              {charCount.toLocaleString()} / 50,000 characters
            </span>
            <Button
              onClick={() => runDump(text)}
              disabled={!isReady}
              className="gap-2"
              size="sm"
            >
              {isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Process with AllKnower
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      {dumpError && !isPending && <ServiceBanner service="AllKnower" error={dumpError} />}

      {/* Result */}
      {result && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-3 border-b border-primary/20">
            <CardTitle
              className="text-sm font-semibold text-primary flex items-center gap-2"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              <Brain className="h-4 w-4" />
              Processing Complete
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
                  {result.notesCreated}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Plus className="h-3 w-3" /> Created
                </div>
              </div>
              <Separator orientation="vertical" className="h-10 self-center" />
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
                  {result.notesUpdated}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Pencil className="h-3 w-3" /> Updated
                </div>
              </div>
            </div>

            {result.summary && (
              <p className="text-sm text-foreground/80 leading-relaxed italic border-l-2 border-primary/40 pl-3">
                {result.summary}
              </p>
            )}

            {result.entities && result.entities.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Entries affected
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.entities.map((e) => (
                    <Link
                      key={e.noteId}
                      href={`/lore/${e.noteId}`}
                      className="flex items-center gap-1.5 text-xs bg-secondary rounded-md px-2 py-1 hover:bg-accent transition-colors"
                    >
                      <BookOpen className="h-3 w-3 text-primary" />
                      {e.title}
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${e.action === "created" ? "text-green-400 border-green-500/40" : "text-yellow-400 border-yellow-500/40"}`}
                      >
                        {e.action}
                      </Badge>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* History */}
      <div>
        <h2
          className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Recent History
        </h2>
        {historyError && <ServiceBanner service="AllKnower" error={historyError} />}
        {historyLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : !history?.length ? (
          <p className="text-sm text-muted-foreground italic">
            No brain dumps yet.
          </p>
        ) : (
          <div className="space-y-2">
            {history.map((entry) => (
              <div
                key={entry.id}
                className="rounded-lg border border-border/40 bg-card/40 p-3 hover:border-border/70 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm line-clamp-2 text-foreground/70">
                    {entry.rawText.slice(0, 120)}
                    {entry.rawText.length > 120 ? "…" : ""}
                  </p>
                  <div className="flex items-center gap-2 shrink-0">
                    {entry.notesCreated > 0 && (
                      <Badge variant="outline" className="text-[10px] text-green-400 border-green-500/40">
                        +{entry.notesCreated}
                      </Badge>
                    )}
                    {entry.notesUpdated > 0 && (
                      <Badge variant="outline" className="text-[10px] text-yellow-400 border-yellow-500/40">
                        ~{entry.notesUpdated}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                  {entry.model && <span>{entry.model}</span>}
                  {entry.tokensUsed && (
                    <span>{entry.tokensUsed.toLocaleString()} tokens</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
