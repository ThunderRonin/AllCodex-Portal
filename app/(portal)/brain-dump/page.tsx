"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef } from "react";
import { useBrainDumpStore } from "@/lib/stores/brain-dump-store";
import { useNotificationStore } from "@/lib/stores/notification-store";
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
import { parseStreamingEntities } from "@/lib/parse-streaming-entities";
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
    streamStartedAt, streamTokenCount,
    isStreaming, runStreamingIngestion, cancelStreamingIngestion,
  } = useBrainDumpStore();
  const queryClient = useQueryClient();
  
  const dumpWatchIdRef = useRef<string | null>(null);
  const commitWatchIdRef = useRef<string | null>(null);

  const streamTokens = useBrainDumpStore((s) => s.streamTokens);
  const { completed: streamingEntities, partial: partialStreamingEntity } = parseStreamingEntities(streamTokens);
  const streamPreviewVisible =
    isStreaming || streamStatus?.stage === "write" || streamStatus?.stage === "complete";
  const [streamElapsedSeconds, setStreamElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!streamStartedAt || !streamPreviewVisible) {
      setStreamElapsedSeconds(0);
      return;
    }

    const updateElapsed = () => {
      setStreamElapsedSeconds(Math.floor((Date.now() - streamStartedAt) / 1000));
    };
    updateElapsed();
    const intervalId = window.setInterval(updateElapsed, 500);
    return () => window.clearInterval(intervalId);
  }, [streamStartedAt, streamPreviewVisible]);

  const [activeTab, setActiveTab] = useState<"single" | "bulk">("single");
  const [bulkFiles, setBulkFiles] = useState<Array<{ name: string; content: string; status: "pending" | "processing" | "success" | "error"; error?: string }>>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [currentBulkIndex, setCurrentBulkIndex] = useState(-1);
  const [pastedBulkText, setPastedBulkText] = useState("");

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
    onMutate: () => {
      const watchId = "brain-dump-" + Date.now();
      dumpWatchIdRef.current = watchId;
      useNotificationStore.getState().watch({
        id: watchId,
        kind: "brain-dump",
        title: "Brain Dump",
        href: "/brain-dump",
      });
    },
    onSuccess: (data) => {
      const watchId = dumpWatchIdRef.current;
      if (watchId) {
        useNotificationStore.getState().complete(watchId, {
          summary: data.mode === "review" ? "Prepared proposals." : "Created and updated lore entries.",
          href: "/brain-dump",
        });
      }
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
    onError: (err: any) => {
      const watchId = dumpWatchIdRef.current;
      if (watchId) {
        useNotificationStore.getState().fail(watchId, {
          error: err.message || "Operation failed.",
        });
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
    onMutate: () => {
      const watchId = "commit-review-" + Date.now();
      commitWatchIdRef.current = watchId;
      useNotificationStore.getState().watch({
        id: watchId,
        kind: "review-commit",
        title: "Commit Review",
        href: "/brain-dump",
      });
    },
    onSuccess: (data) => {
      const watchId = commitWatchIdRef.current;
      if (watchId) {
        useNotificationStore.getState().complete(watchId, {
          summary: "Committed changes to AllCodex.",
          href: "/brain-dump",
        });
      }
      const normalized = normalizeResult(data);
      setResult(normalized);
      setReviewState(null);
      void queryClient.invalidateQueries({ queryKey: ["brain-dump-history"] });
      void queryClient.invalidateQueries({ queryKey: ["lore"] });
    },
    onError: (err: any) => {
      const watchId = commitWatchIdRef.current;
      if (watchId) {
        useNotificationStore.getState().fail(watchId, {
          error: err.message || "Failed to commit.",
        });
      }
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
    setResult(null);
    setReviewState(null);
    void runStreamingIngestion(rawText, model ?? null, queryClient, runConsistencyCheck);
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    
    filesArray.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const textContent = event.target?.result as string;
        setBulkFiles((prev) => [
          ...prev,
          { name: file.name, content: textContent, status: "pending" },
        ]);
      };
      reader.readAsText(file);
    });
  };

  const handleAddPastedBulk = () => {
    if (!pastedBulkText.trim()) return;
    const pieces = pastedBulkText.split(/=== DUMP ===|=== SESSION ===/i);
    const validPieces = pieces.map(p => p.trim()).filter(p => p.length > 10);
    
    setBulkFiles(prev => [
      ...prev,
      ...validPieces.map((content, idx) => ({
        name: `Pasted Dump #${prev.length + idx + 1}`,
        content,
        status: "pending" as const,
      })),
    ]);
    setPastedBulkText("");
  };

  const runBulkProcessing = async () => {
    const watchId = "bulk-dump-" + Date.now();
    useNotificationStore.getState().watch({
      id: watchId,
      kind: "bulk-dump",
      title: "Bulk Ingestion",
      href: "/brain-dump",
    });
    setIsBulkProcessing(true);
    
    try {
      for (let i = 0; i < bulkFiles.length; i++) {
        if (bulkFiles[i].status !== "pending") continue;
        
        setCurrentBulkIndex(i);
        setBulkFiles(prev => {
          const copy = [...prev];
          copy[i].status = "processing";
          return copy;
        });
        
        try {
          const res = await fetch("/api/brain-dump", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              rawText: bulkFiles[i].content, 
              mode: "auto", 
              ...(selectedModel && { model: selectedModel }) 
            }),
          });
          
          if (!res.ok) {
            throw new Error(`Failed with status: ${res.status}`);
          }
          
          setBulkFiles(prev => {
            const copy = [...prev];
            copy[i].status = "success";
            return copy;
          });
        } catch (err: any) {
          setBulkFiles(prev => {
            const copy = [...prev];
            copy[i].status = "error";
            copy[i].error = err.message || String(err);
            return copy;
          });
        }
      }
      
      setIsBulkProcessing(false);
      setCurrentBulkIndex(-1);
      
      void queryClient.invalidateQueries({ queryKey: ["brain-dump-history"] });
      void queryClient.invalidateQueries({ queryKey: ["lore"] });
      
      useNotificationStore.getState().complete(watchId, {
        summary: "Finished processing bulk queue.",
        href: "/brain-dump",
      });
    } catch (err) {
      setIsBulkProcessing(false);
      setCurrentBulkIndex(-1);
      useNotificationStore.getState().fail(watchId, {
        error: "Bulk queue failed.",
      });
    }
  };

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

      {/* Tabs */}
      <div className="flex gap-4 border-b border-border/20">
        <button
          onClick={() => setActiveTab("single")}
          className={`py-2 px-4 text-xs font-semibold tracking-wider transition-colors border-b-2 -mb-px uppercase ${
            activeTab === "single"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Single Dump
        </button>
        <button
          onClick={() => setActiveTab("bulk")}
          className={`py-2 px-4 text-xs font-semibold tracking-wider transition-colors border-b-2 -mb-px uppercase ${
            activeTab === "bulk"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Bulk Upload Queue
        </button>
      </div>

      {activeTab === "single" ? (
        /* Input + mode tabs */
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
              <div className="flex items-center gap-2">
                {isStreaming && (
                  <Button variant="outline" size="sm" onClick={cancelStreamingIngestion} className="rounded-none text-rose-400 hover:text-rose-300 border-rose-950 hover:bg-rose-950/20">
                    Cancel
                  </Button>
                )}
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
        </div>
      ) : (
        /* Bulk Ingestion UI */
        <div className="space-y-4 rounded-none border border-border/30 bg-card/40 p-4">
          <div className="space-y-2">
            <h3 style={{ fontFamily: "var(--font-cinzel)" }} className="text-sm font-semibold tracking-wider text-primary uppercase">
              Upload Files
            </h3>
            <p className="text-xs text-muted-foreground">Select multiple lore snippets or session notes to queue and process sequentially.</p>
            <input 
              type="file" 
              multiple 
              accept=".txt,.md,.markdown" 
              onChange={handleFileChange}
              disabled={isBulkProcessing}
              className="text-xs text-muted-foreground file:mr-4 file:py-1.5 file:px-3 file:border file:border-border/40 file:bg-muted/15 file:text-foreground hover:file:bg-muted/30 file:cursor-pointer"
            />
          </div>

          <Separator className="bg-border/20" />

          <div className="space-y-2">
            <h3 style={{ fontFamily: "var(--font-cinzel)" }} className="text-sm font-semibold tracking-wider text-primary uppercase">
              Paste delimited sessions
            </h3>
            <p className="text-xs text-muted-foreground">Separate different notes or sessions with <code className="font-mono bg-muted/20 px-1 py-0.5 rounded text-amber-500">=== SESSION ===</code> or <code className="font-mono bg-muted/20 px-1 py-0.5 rounded text-amber-500">=== DUMP ===</code>.</p>
            <Textarea
              placeholder="Paste raw content here..."
              value={pastedBulkText}
              onChange={(e) => setPastedBulkText(e.target.value)}
              rows={4}
              disabled={isBulkProcessing}
              className="resize-none rounded-none border-border/50 bg-muted/10 font-[var(--font-crimson)] text-base"
            />
            <Button size="sm" variant="secondary" onClick={handleAddPastedBulk} disabled={isBulkProcessing || !pastedBulkText.trim()} className="rounded-none">
              Add pasted text to queue
            </Button>
          </div>

          {bulkFiles.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-t border-border/20 pt-3">
                <span style={{ fontFamily: "var(--font-cinzel)" }} className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Ingestion Queue ({bulkFiles.filter(f => f.status === "success").length} / {bulkFiles.length} complete)
                </span>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" disabled={isBulkProcessing} onClick={() => setBulkFiles([])} className="h-7 text-xs text-rose-400 hover:text-rose-300">
                    Clear Queue
                  </Button>
                  <Button size="sm" disabled={isBulkProcessing || bulkFiles.every(f => f.status !== "pending")} onClick={runBulkProcessing} className="h-7 text-xs">
                    {isBulkProcessing ? (
                      <><RefreshCw className="h-3 w-3 animate-spin mr-1.5" />Processing...</>
                    ) : "Process Queue"}
                  </Button>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 border border-border/20 p-2 bg-muted/5 font-mono text-xs">
                {bulkFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-card/25 border border-border/10">
                    <span className="truncate max-w-[200px] font-sans font-medium">{file.name}</span>
                    <div className="flex items-center gap-3">
                      {file.status === "pending" && <span className="text-muted-foreground/60 text-[10px] uppercase">Pending</span>}
                      {file.status === "processing" && <span className="text-amber-500 animate-pulse text-[10px] uppercase font-bold">Processing</span>}
                      {file.status === "success" && <span className="text-green-500 text-[10px] uppercase font-bold">✓ Success</span>}
                      {file.status === "error" && (
                        <span className="text-rose-500 text-[10px] uppercase font-bold" title={file.error}>
                          ⚠ Error
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Streaming entities live preview */}
      {streamPreviewVisible && (streamingEntities.length > 0 || partialStreamingEntity) && (
        <div className="space-y-3 p-4 border border-amber-500/25 bg-amber-950/5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-xs font-semibold tracking-wider text-amber-500 uppercase" style={{ fontFamily: "var(--font-cinzel)" }}>
              Scribing Entities in Real-Time…
            </h4>
            <div className="flex items-center gap-2 text-[11px] text-amber-300/80">
              <span>{streamingEntities.length} found</span>
              <span className="text-amber-500/40">·</span>
              <span>{streamTokenCount} tokens</span>
              <span className="text-amber-500/40">·</span>
              <span>{streamElapsedSeconds}s</span>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {streamingEntities.map((e, idx) => (
              <div key={idx} className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-950/10">
                <div className="mt-0.5 p-1.5 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
                  <EntityIcon type={e.type} className="h-3.5 w-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300 leading-tight truncate">{e.title}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-[10px] capitalize bg-amber-500/5 text-amber-400 border border-amber-500/20">
                      {e.type}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize text-green-400 border-green-500/30">
                      {e.action === "create" ? "new" : "update"}
                    </Badge>
                  </div>
                </div>
                <CheckSquare className="h-4 w-4 text-green-400 shrink-0 mt-0.5" />
              </div>
            ))}
            {isStreaming && partialStreamingEntity && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-950/5 opacity-70 animate-pulse">
                <div className="mt-0.5 p-1.5 rounded-md bg-amber-500/10 text-amber-400 shrink-0">
                  {partialStreamingEntity.type ? (
                    <EntityIcon type={partialStreamingEntity.type} className="h-3.5 w-3.5" />
                  ) : (
                    <Cpu className="h-3.5 w-3.5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-300 leading-tight truncate">
                    {partialStreamingEntity.title || "Detecting entity"}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-[10px] capitalize bg-amber-500/5 text-amber-400 border border-amber-500/20">
                      {partialStreamingEntity.type || "type pending"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] capitalize text-amber-300/70 border-amber-500/25">
                      writing
                    </Badge>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
