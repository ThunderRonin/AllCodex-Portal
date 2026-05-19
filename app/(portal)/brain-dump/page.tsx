"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useBrainDumpStore } from "@/lib/stores/brain-dump-store";
import { useSSEStream } from "@/hooks/use-sse-stream";
import { LORE_TEMPLATES } from "@/components/editor/TemplatePicker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  Sparkles,
  Clock,
  Plus,
  RefreshCw,
  Pencil,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Inbox,
  Eye,
  Zap,
  AlertTriangle,
  SkipForward,
  ArrowRight,
  Trash2,
  ExternalLink,
  Cpu,
} from "lucide-react";
import Link from "next/link";
import { ServiceBanner } from "@/components/portal/ServiceBanner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  BrainDumpAnyResult,
  BrainDumpResult,
  BrainDumpReviewResult,
  ProposedEntity,
} from "@/lib/allknower-schemas";

// ── Entity type helpers ───────────────────────────────────────────────────────

function EntityIcon({ type, className }: { type: string; className?: string }) {
  const template = LORE_TEMPLATES.find((t) => t.value === type);
  const Icon = template?.icon;
  if (!Icon) return null;
  return <Icon className={className ?? "h-3.5 w-3.5"} />;
}

function ActionBadge({ action }: { action: string }) {
  return (
    <Badge
      variant="outline"
      className={`text-[10px] capitalize shrink-0 ${
        action === "created" || action === "create"
          ? "text-green-400 border-green-500/40"
          : "text-yellow-400 border-yellow-500/40"
      }`}
    >
      {action === "create" ? "new" : action === "update" ? "update" : action}
    </Badge>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <Badge
      variant="secondary"
      className="text-[10px] capitalize gap-1 border border-border/40"
    >
      <EntityIcon type={type} className="h-2.5 w-2.5" />
      {type}
    </Badge>
  );
}

function EntityCard({
  noteId,
  title,
  type,
  action,
}: {
  noteId?: string;
  title: string;
  type: string;
  action: string;
}) {
  const inner = (
    <div className="flex items-start gap-2.5 p-3 rounded-lg border border-border/40 bg-card/50 hover:border-primary/30 hover:bg-card/80 transition-colors">
      <div className="mt-0.5 p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
        <EntityIcon type={type} className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <TypeBadge type={type} />
          <ActionBadge action={action} />
        </div>
      </div>
      {noteId && <ExternalLink className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0 mt-0.5" />}
    </div>
  );
  if (noteId) return <Link href={`/lore/${noteId}`}>{inner}</Link>;
  return inner;
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  rawText: string;
  summary: string | null;
  notesCreated: string[];
  notesUpdated: string[];
  model: string;
  tokensUsed: number | null;
  createdAt: string;
}

function normalizeResult(raw: BrainDumpResult) {
  return {
    mode: "auto" as const,
    summary: raw.summary,
    created: raw.created ?? [],
    updated: raw.updated ?? [],
    skipped: raw.skipped ?? [],
    duplicates: raw.duplicates,
  };
}

// ── Scribe's Log — client-side stage simulation ──────────────────────────────

const SCRIBE_STAGES: Record<string, Array<{ icon: string; label: string; ms: number }>> = {
  auto: [
    { icon: "📚", label: "Consulting the archives…", ms: 0 },
    { icon: "🧠", label: "Channeling the AllKnower…", ms: 4500 },
    { icon: "✍️", label: "Scribing the chronicles…", ms: 52000 },
    { icon: "🕸️", label: "Weaving the threads of fate…", ms: 58000 },
  ],
  review: [
    { icon: "📚", label: "Consulting the archives…", ms: 0 },
    { icon: "🧠", label: "Channeling the AllKnower…", ms: 4500 },
    { icon: "📋", label: "Preparing proposals…", ms: 52000 },
  ],
  inbox: [
    { icon: "📥", label: "Queuing to inbox…", ms: 0 },
  ],
};

function ScribeLog({ mode, stage }: { mode: string; stage: number }) {
  const stages = SCRIBE_STAGES[mode] ?? SCRIBE_STAGES.auto;
  return (
    <div className="rounded-none border border-border/30 bg-card/40 p-4 space-y-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50" style={{ fontFamily: "var(--font-cinzel)" }}>
        Scribe&apos;s Log
      </p>
      <div className="space-y-2">
        {stages.map((s, i) => {
          const isDone = i < stage;
          const isActive = i === stage;
          return (
            <div
              key={i}
              className={`flex items-center gap-3 text-sm transition-all duration-500 ${
                isActive ? "opacity-100" : isDone ? "opacity-40" : "opacity-20"
              }`}
            >
              <span className={`text-base ${isActive ? "animate-pulse" : ""}`}>{s.icon}</span>
              <span
                className={`${
                  isDone
                    ? "line-through text-muted-foreground"
                    : isActive
                    ? "text-primary font-medium"
                    : "text-muted-foreground/50"
                }`}
              >
                {s.label}
              </span>
              {isDone && (
                <span className="ml-auto text-xs text-green-500/70">✓</span>
              )}
              {isActive && (
                <span className="ml-auto flex gap-0.5">
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
                      style={{ animationDelay: `${d * 150}ms` }}
                    />
                  ))}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}


const MODE_TABS = [
  { value: "auto" as const, label: "Auto-Create", icon: Zap, desc: "AllKnower writes everything immediately" },
  { value: "review" as const, label: "Review First", icon: Eye, desc: "Approve each entity before it's saved" },
  { value: "inbox" as const, label: "Inbox", icon: Inbox, desc: "Queue for later — process when ready" },
];

/**
 * Renders the Brain Dump page UI for submitting freeform text to AllKnower, controlling mode/model, streaming or non-stream processing, reviewing proposed entities, inspecting results, running best‑effort consistency checks, managing an inbox, and viewing recent history.
 *
 * The component coordinates state from the BrainDump store, server interactions (including SSE streaming for `auto` mode and fetch-based mutations for other modes), simulated processing progress, and query cache invalidation.
 *
 * @returns The React element tree for the Brain Dump page, including input controls, processing/review/result panels, contradiction warnings, inbox, and recent history.
 */

export default function BrainDumpPage() {
  const {
    text, setText,
    dumpMode, setDumpMode,
    selectedModel, setSelectedModel,
    result, setResult,
    reviewState, setReviewState, toggleReviewApproval,
    inboxItems, addToInbox, removeFromInbox,
    expandedIds, toggleExpanded,
    streamStatus, setStreamStatus, appendStreamToken, resetStream,
  } = useBrainDumpStore();
  const queryClient = useQueryClient();
  const { stream, cancel: _cancelStream } = useSSEStream();
  const [isStreaming, setIsStreaming] = useState(false);

  // Scribe's Log — stage simulation
  const [scribeStage, setScribeStage] = useState(0);
  const requestStartRef = useRef<number | null>(null);

  const { data: modelChains } = useQuery<Record<string, { models: string[]; autoMode: boolean }>>({
    queryKey: ["model-chains"],
    queryFn: async () => {
      const r = await fetch("/api/config/models");
      if (!r.ok) return {};
      return r.json();
    },
    staleTime: 60_000,
  });
  const brainDumpModels = modelChains?.["brain-dump"]?.models ?? [];
  const isAutoMode = modelChains?.["brain-dump"]?.autoMode ?? false;

  if (selectedModel && brainDumpModels.length > 0 && !brainDumpModels.includes(selectedModel)) {
    setSelectedModel(null);
  }

  const [consistencyResult, setConsistencyResult] = useState<{
    issues: Array<{ type: string; severity: string; description: string; affectedNoteIds: string[] }>;
    summary: string;
  } | null>(null);
  const [consistencyLoading, setConsistencyLoading] = useState(false);

  const { data: history, isLoading: historyLoading, error: historyError } = useQuery<HistoryEntry[]>({
    queryKey: ["brain-dump-history"],
    queryFn: async () => {
      const r = await fetch("/api/brain-dump/history");
      if (!r.ok) throw await r.json();
      const data = await r.json();
      return data.items ?? (Array.isArray(data) ? data : []);
    },
  });

  /**
   * Performs a best-effort contradiction/consistency check for the provided note IDs and updates local consistency state.
   *
   * Initiates a network request to evaluate consistency for `noteIds`, sets the loading flag while the check runs, and stores the returned issues if any are found. Failures and empty inputs are silently ignored; the loading flag is cleared when the operation completes.
   *
   * @param noteIds - Array of note IDs to include in the consistency check
   */
  async function runConsistencyCheck(noteIds: string[]) {
    if (noteIds.length === 0) return;
    setConsistencyLoading(true);
    setConsistencyResult(null);
    try {
      const r = await fetch("/api/ai/consistency", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noteIds }),
      });
      if (!r.ok) return;
      const data = await r.json();
      if (data.issues?.length > 0) setConsistencyResult(data);
    } catch {
      // best-effort silence
    } finally {
      setConsistencyLoading(false);
    }
  }

  const { mutate: runDump, isPending, error: dumpError } = useMutation({
    mutationFn: async ({ rawText, mode, model }: { rawText: string; mode: string; model?: string }) => {
      requestStartRef.current = Date.now();
      setScribeStage(0);
      const r = await fetch("/api/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, mode, ...(model && { model }) }),
      });
      if (!r.ok) throw await r.json();
      return r.json() as Promise<BrainDumpAnyResult>;
    },
    onSuccess: (data) => {
      if (data.mode === "review") {
        const rd = data as BrainDumpReviewResult;
        setReviewState({
          summary: rd.summary,
          proposedEntities: rd.proposedEntities,
          approvedIds: new Set(rd.proposedEntities.map((_, i) => i)),
        });
        setResult(null);
        setText("");
      } else {
        const normalized = normalizeResult(data as BrainDumpResult);
        setResult(normalized);
        setReviewState(null);
        setText("");
        void queryClient.invalidateQueries({ queryKey: ["brain-dump-history"] });
        void queryClient.invalidateQueries({ queryKey: ["lore"] });
        const newNoteIds = [
          ...normalized.created.map((e) => e.noteId),
          ...normalized.updated.map((e) => e.noteId),
        ];
        void runConsistencyCheck(newNoteIds);
      }
    },
  });

  const { mutate: commitReview, isPending: isCommitting } = useMutation({
    mutationFn: async ({ rawText, approvedEntities }: { rawText: string; approvedEntities: ProposedEntity[] }) => {
      const r = await fetch("/api/brain-dump/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, approvedEntities }),
      });
      if (!r.ok) throw await r.json();
      return r.json() as Promise<BrainDumpResult>;
    },
    onSuccess: (data) => {
      const normalized = normalizeResult(data);
      setResult(normalized);
      setReviewState(null);
      void queryClient.invalidateQueries({ queryKey: ["brain-dump-history"] });
      void queryClient.invalidateQueries({ queryKey: ["lore"] });
    },
  });

  const charCount = text.length;
  const isReady = charCount >= 10 && !isPending && !isStreaming;

  // Advance scribe stage based on elapsed time while pending
  useEffect(() => {
    if (!isPending) {
      setScribeStage(0);
      requestStartRef.current = null;
      return;
    }
    const stages = SCRIBE_STAGES[dumpMode] ?? SCRIBE_STAGES.auto;
    const interval = setInterval(() => {
      const elapsed = requestStartRef.current ? Date.now() - requestStartRef.current : 0;
      const activeStage = stages.reduce((acc, s, i) => (elapsed >= s.ms ? i : acc), 0);
      setScribeStage(activeStage);
    }, 500);
    return () => clearInterval(interval);
  }, [isPending, dumpMode]);

  /**
   * Streams an auto-create brain-dump to the backend, updates UI state with streaming progress, and applies the final parsed result.
   *
   * Starts a server-sent-events stream for the given `rawText` (optionally using `model`), sets the page into streaming mode, clears any prior result/review state, and processes stream events to:
   * - update streaming status messages,
   * - append incremental token content,
   * - on completion, parse and normalize the final result, set it as the current result, clear the input text, refresh relevant caches, and run a best-effort consistency check for affected notes,
   * - on error, record a streaming error status.
   *
   * The function ensures streaming state is cleared when the operation finishes or fails.
   *
   * @param rawText - The brain-dump text to submit for auto-processing.
   * @param model - Optional model identifier to request from the backend.
   */
  async function handleAutoStream(rawText: string, model?: string) {
    resetStream();
    setIsStreaming(true);
    setResult(null);
    setReviewState(null);

    try {
      for await (const event of stream("/api/brain-dump/stream", { rawText, ...(model && { model }) })) {
        switch (event.event) {
          case "status":
            setStreamStatus(event.data as { stage: string; message: string });
            break;
          case "token":
            appendStreamToken((event.data as { content: string }).content);
            break;
          case "done": {
            const doneData = event.data as { raw: string; tokensUsed: number; model: string; latencyMs: number };
            try {
              const parsed = JSON.parse(doneData.raw);
              const normalized = normalizeResult(parsed);
              setResult(normalized);
              setText("");
              void queryClient.invalidateQueries({ queryKey: ["brain-dump-history"] });
              void queryClient.invalidateQueries({ queryKey: ["lore"] });
              const newNoteIds = [
                ...normalized.created.map((e) => e.noteId),
                ...normalized.updated.map((e) => e.noteId),
              ];
              void runConsistencyCheck(newNoteIds);
            } catch (err) {
              console.error("[brain-dump] Failed to process done event:", err, "raw data:", doneData);
            }
            break;
          }
          case "error":
            setStreamStatus({ stage: "error", message: (event.data as { error: string }).error });
            break;
        }
      }
    } catch (err) {
      setStreamStatus({ stage: "error", message: err instanceof Error ? err.message : "Stream failed" });
    } finally {
      setIsStreaming(false);
    }
  }

  /**
   * Submit the current brain-dump text according to the active mode.
   *
   * If the mode is "inbox", the text is queued in the inbox. If the mode is "auto",
   * the text is processed via the streaming handler (optionally using the selected model).
   * For other modes, the non-streaming dump mutation is invoked with the chosen mode
   * and optional model override.
   */
  function handleSubmit() {
    if (dumpMode === "inbox") {
      addToInbox(text);
      return;
    }
    const modelOverride = selectedModel ?? undefined;
    if (dumpMode === "auto") {
      handleAutoStream(text, modelOverride);
      return;
    }
    runDump({ rawText: text, mode: dumpMode, model: modelOverride });
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
          Brain Dump
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pour your raw worldbuilding thoughts here. AllKnower will extract, classify,
          and file every entity into the lore chronicle.
        </p>
      </div>

      {/* Input + mode tabs */}
      <div className="rounded-none border border-border/30 bg-card/40 overflow-hidden">
        <div className="p-4 space-y-3">
          <div className="flex gap-0 border-b border-border/30">
            {MODE_TABS.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setDumpMode(value)}
                className={`flex items-center justify-center gap-1.5 py-2 px-4 text-xs font-medium transition-colors border-b-2 -mb-px ${
                  dumpMode === value
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground/70">
              {MODE_TABS.find((m) => m.value === dumpMode)?.desc}
            </p>
            {brainDumpModels.length > 1 && !isAutoMode && dumpMode !== "inbox" && (
              <div className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3 text-muted-foreground/50" />
                <Select
                  value={selectedModel ?? "__default__"}
                  onValueChange={(v) => setSelectedModel(v === "__default__" ? null : v)}
                >
                  <SelectTrigger className="h-7 w-auto min-w-[140px] text-xs rounded-none border-border/40 bg-muted/10">
                    <SelectValue placeholder="Default model" />
                  </SelectTrigger>
                  <SelectContent className="rounded-none">
                    <SelectItem value="__default__" className="text-xs">Default ({brainDumpModels[0]?.split("/").pop()})</SelectItem>
                    {brainDumpModels.slice(1).map((m) => (
                      <SelectItem key={m} value={m} className="text-xs">
                        {m.split("/").pop()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <Textarea
            placeholder={`Write anything — story fragments, NPC ideas, place descriptions, plot points…`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            className="resize-none rounded-none border-border/50 focus-visible:border-primary/60 bg-muted/10 font-[var(--font-crimson)] text-base leading-relaxed"
            disabled={isPending || isStreaming}
          />
          <div className="flex items-center justify-between">
            <span className={`text-xs ${charCount < 10 ? "text-muted-foreground/50" : charCount > 45000 ? "text-destructive" : "text-muted-foreground"}`}>
              {charCount.toLocaleString()} / 50,000 characters
            </span>
            <Button onClick={handleSubmit} disabled={!isReady || isCommitting} className="gap-2 rounded-none" size="sm">
              {(isPending || isStreaming) ? (
                <><RefreshCw className="h-4 w-4 animate-spin" />{dumpMode === "review" ? "Analysing…" : "Processing…"}</>
              ) : dumpMode === "inbox" ? (
                <><Inbox className="h-4 w-4" />Add to Inbox</>
              ) : dumpMode === "review" ? (
                <><Eye className="h-4 w-4" />Analyse</>
              ) : (
                <><Sparkles className="h-4 w-4" />Process with AllKnower</>
              )}
            </Button>
          </div>
        </div>
      </div>

      {(isPending || isStreaming) && (
        streamStatus ? (
          <div className="rounded-none border border-border/30 bg-card/40 p-4 space-y-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50" style={{ fontFamily: "var(--font-cinzel)" }}>
              Scribe&apos;s Log
            </p>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-base animate-pulse">{"\u{1F9E0}"}</span>
              <span className="text-primary font-medium">{streamStatus.message}</span>
              <span className="ml-auto flex gap-0.5">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </span>
            </div>
          </div>
        ) : (
          <ScribeLog mode={dumpMode} stage={scribeStage} />
        )
      )}

      {((dumpError && !isPending) || (streamStatus?.stage === "error" && !isStreaming)) && (
        <ServiceBanner service="AllKnower" error={dumpError ?? { error: "SERVICE_ERROR", message: streamStatus?.message ?? "Unknown error" }} />
      )}

      {/* Inbox queue */}
      {inboxItems.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-cinzel)" }}>
            Inbox ({inboxItems.length})
          </h2>
          {inboxItems.map((item, i) => (
            <div key={i} className="flex items-start gap-3 p-3 border-b border-border/30 bg-card/30 hover:bg-card/50 transition-colors">
              <p className="flex-1 text-sm text-foreground/70 line-clamp-2 whitespace-pre-wrap">{item}</p>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" className="h-7 gap-1.5 text-xs"
                  onClick={() => { setText(item); setDumpMode("auto"); removeFromInbox(i); }}>
                  <ArrowRight className="h-3.5 w-3.5" />Process
                </Button>
                <Button size="sm" variant="ghost" className="h-7 text-muted-foreground/60 hover:text-destructive"
                  onClick={() => removeFromInbox(i)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review First — approval UI */}
      {reviewState && (
        <div className="rounded-none border border-[var(--accent)]/30 bg-card/60 border-l-2 border-l-[var(--accent)]/40">
          <div className="pb-3 px-4 pt-4 border-b border-[var(--accent)]/20">
            <h3 className="text-sm font-semibold text-[var(--accent)] flex items-center gap-2" style={{ fontFamily: "var(--font-cinzel)" }}>
              <Eye className="h-4 w-4" />
              Review Proposed Entities
            </h3>
          </div>
          <div className="pt-4 px-4 pb-4 space-y-4">
            {reviewState.summary && (
              <p className="text-sm text-foreground/80 leading-relaxed italic border-l-2 border-accent/40 pl-3">
                {reviewState.summary}
              </p>
            )}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {reviewState.approvedIds.size} / {reviewState.proposedEntities.length} approved
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5"
                    onClick={() => reviewState.proposedEntities.forEach((_, i) => { if (!reviewState.approvedIds.has(i)) toggleReviewApproval(i); })}>
                    <CheckSquare className="h-3.5 w-3.5" /> All
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs gap-1.5"
                    onClick={() => reviewState.proposedEntities.forEach((_, i) => { if (reviewState.approvedIds.has(i)) toggleReviewApproval(i); })}>
                    <Square className="h-3.5 w-3.5" /> None
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {reviewState.proposedEntities.map((entity, i) => {
                  const approved = reviewState.approvedIds.has(i);
                  return (
                    <button key={i} onClick={() => toggleReviewApproval(i)}
                      className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-colors ${approved ? "border-primary/40 bg-primary/5" : "border-border/30 bg-card/30 opacity-50"}`}>
                      {approved
                        ? <CheckSquare className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        : <Square className="h-4 w-4 text-muted-foreground/40 shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{entity.title}</p>
                        <div className="flex gap-1.5 mt-1">
                          <TypeBadge type={entity.type} />
                          <ActionBadge action={entity.action} />
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex gap-2 pt-2 border-t border-border/30">
              <Button className="gap-2 rounded-none" disabled={reviewState.approvedIds.size === 0 || isCommitting}
                onClick={() => {
                  const approved = reviewState.proposedEntities.filter((_, i) => reviewState.approvedIds.has(i));
                  commitReview({ rawText: text || "review commit", approvedEntities: approved });
                }}>
                {isCommitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Commit {reviewState.approvedIds.size} Approved
              </Button>
              <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground rounded-none"
                onClick={() => setReviewState(null)}>
                <SkipForward className="h-4 w-4" />Discard
              </Button>
            </div>
          </div>
        </div>
      )}
      {result && (
        <div className="rounded-none border border-primary/30 bg-primary/5 border-l-2 border-l-primary/40">
          <div className="pb-3 px-4 pt-4 border-b border-primary/20">
            <h3 className="text-sm font-semibold text-primary flex items-center gap-2" style={{ fontFamily: "var(--font-cinzel)" }}>
              <Brain className="h-4 w-4" />
              Processing Complete
            </h3>
          </div>
          <div className="pt-4 px-4 pb-4 space-y-4">
            <div className="flex gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>{result.created.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Plus className="h-3 w-3" /> Created</div>
              </div>
              <Separator orientation="vertical" className="h-10 self-center" />
              <div className="text-center">
                <div className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>{result.updated.length}</div>
                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><Pencil className="h-3 w-3" /> Updated</div>
              </div>
              {result.skipped.length > 0 && (
                <>
                  <Separator orientation="vertical" className="h-10 self-center" />
                  <div className="text-center">
                    <div className="text-2xl font-bold text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>{result.skipped.length}</div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1"><SkipForward className="h-3 w-3" /> Skipped</div>
                  </div>
                </>
              )}
            </div>

            {result.summary && (
              <p className="text-sm text-foreground/80 leading-relaxed italic border-l-2 border-primary/40 pl-3">
                {result.summary}
              </p>
            )}

            {(result.created.length > 0 || result.updated.length > 0) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {result.created.map((e) => (
                  <EntityCard key={e.noteId} noteId={e.noteId} title={e.title} type={e.type} action="created" />
                ))}
                {result.updated.map((e) => (
                  <EntityCard key={e.noteId} noteId={e.noteId} title={e.title} type={e.type} action="updated" />
                ))}
              </div>
            )}

            {result.skipped.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Skipped</p>
                {result.skipped.map((s, i) => (
                  <p key={i} className="text-xs text-muted-foreground/60">
                    <span className="font-medium text-foreground/60">{s.title}</span>{" — "}{s.reason}
                  </p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Contradiction warnings */}
      {consistencyLoading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <RefreshCw className="h-3 w-3 animate-spin" />
          Checking for contradictions…
        </div>
      )}
      {consistencyResult && consistencyResult.issues.length > 0 && (
        <div className="rounded-none border border-destructive/30 bg-destructive/5 border-l-2 border-l-destructive/40">
          <div className="pb-2 px-4 pt-4 border-b border-destructive/20">
            <h3 className="text-sm font-semibold text-destructive flex items-center gap-2" style={{ fontFamily: "var(--font-cinzel)" }}>
              <AlertTriangle className="h-4 w-4" />
              Contradictions Found
            </h3>
          </div>
          <div className="pt-3 px-4 pb-4 space-y-2">
            {consistencyResult.issues.map((issue, i) => (
              <div key={i} className={`flex gap-2 p-2.5 border-l-2 ${
                issue.severity === "high" ? "border-l-destructive bg-destructive/5"
                : issue.severity === "medium" ? "border-l-yellow-500 bg-yellow-500/5"
                : "border-l-border/50 bg-muted/20"
              }`}>
                <AlertTriangle className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${
                  issue.severity === "high" ? "text-destructive"
                  : issue.severity === "medium" ? "text-yellow-400"
                  : "text-muted-foreground"
                }`} />
                <div className="text-xs space-y-1">
                  <p className="text-foreground/90">{issue.description}</p>
                  {issue.affectedNoteIds?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {issue.affectedNoteIds.map((id) => (
                        <Link key={id} href={`/lore/${id}`} className="text-primary hover:underline underline-offset-2">{id}</Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* History */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3" style={{ fontFamily: "var(--font-cinzel)" }}>
          Recent History
        </h2>
        {historyError && <ServiceBanner service="AllKnower" error={historyError} />}
        {historyLoading ? (
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
        ) : !history?.length ? (
          <p className="text-sm text-muted-foreground italic">No brain dumps yet.</p>
        ) : (
          <div className="space-y-0">
            {history.map((entry) => {
              const isExpanded = expandedIds.includes(entry.id);
              const needsTruncation = entry.rawText.length > 120;
              return (
                <Link key={entry.id} href={`/brain-dump/${entry.id}`}
                  className="block rounded-none border-b border-border/20 bg-card/40 p-4 hover:bg-card/70 transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-foreground/70 whitespace-pre-wrap break-words">
                      {entry.summary || (isExpanded || !needsTruncation ? entry.rawText : entry.rawText.slice(0, 120) + "…")}
                    </p>
                    <div className="flex items-center gap-2 shrink-0">
                      {entry.notesCreated.length > 0 && (
                        <Badge variant="outline" className="text-[10px] text-[var(--accent)] border-[var(--accent)]/40 rounded-none">+{entry.notesCreated.length}</Badge>
                      )}
                      {entry.notesUpdated.length > 0 && (
                        <Badge variant="outline" className="text-[10px] text-primary/80 border-primary/40 rounded-none">~{entry.notesUpdated.length}</Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(entry.createdAt).toLocaleString()}</span>
                    {entry.model && <span>{entry.model}</span>}
                    {entry.tokensUsed && <span>{entry.tokensUsed.toLocaleString()} tokens</span>}
                    {needsTruncation && (
                      <button onClick={(e) => { e.preventDefault(); toggleExpanded(entry.id); }}
                        className="flex items-center gap-0.5 ml-auto text-muted-foreground/60 hover:text-foreground transition-colors">
                        {isExpanded ? <><ChevronUp className="h-3 w-3" /> Show less</> : <><ChevronDown className="h-3 w-3" /> Show more</>}
                      </button>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
