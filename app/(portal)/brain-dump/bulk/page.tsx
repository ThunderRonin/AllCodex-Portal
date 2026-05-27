"use client";

import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Upload,
  Play,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Loader2,
  Trash2,
  FileText,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { readFileAsText } from "@/lib/read-file-text";

interface StagedItem {
  id: string;
  rawText: string;
  fileName?: string;
}

type BatchMode = "auto" | "review";

function statusBadge(status: string) {
  switch (status) {
    case "queued":
      return <Badge variant="outline" className="text-amber-400 border-amber-400/40"><Clock className="h-3 w-3 mr-1" />Queued</Badge>;
    case "running":
      return <Badge variant="outline" className="text-blue-400 border-blue-400/40"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Running</Badge>;
    case "done":
      return <Badge variant="outline" className="text-emerald-400 border-emerald-400/40"><CheckCircle className="h-3 w-3 mr-1" />Done</Badge>;
    case "failed":
      return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Failed</Badge>;
    case "cancelled":
      return <Badge variant="secondary"><X className="h-3 w-3 mr-1" />Cancelled</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function BulkBrainDumpPage() {
  const queryClient = useQueryClient();
  const [staged, setStaged] = useState<StagedItem[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [mode, setMode] = useState<BatchMode>("auto");
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback((files: FileList) => {
    const validFiles = Array.from(files).filter(
      (f) => f.name.endsWith(".txt") || f.name.endsWith(".md"),
    );
    for (const file of validFiles) {
      readFileAsText(file).then((text) => {
        if (text.trim()) {
          setStaged((prev) => [...prev, { id: crypto.randomUUID(), rawText: text.trim(), fileName: file.name }]);
        }
      });
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  const handlePaste = () => {
    if (!pasteText.trim()) return;
    const items = pasteText.split(/\n---\n/).filter((t) => t.trim());
    const newItems = items.map((text) => ({ id: crypto.randomUUID(), rawText: text.trim() }));
    setStaged((prev) => [...prev, ...newItems]);
    setPasteText("");
  };

  const removeStaged = (id: string) => setStaged((prev) => prev.filter((s) => s.id !== id));

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/brain-dump/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: staged.map((s) => ({ rawText: s.rawText, mode })) }),
      });
      if (!res.ok) throw new Error(`Submit failed: ${res.status}`);
      return res.json() as Promise<{ batchId: string }>;
    },
    onSuccess: (data) => {
      setActiveBatchId(data.batchId);
      setStaged([]);
      setError(null);
    },
    onError: (err: Error) => setError(err.message),
  });

  const batchQuery = useQuery({
    queryKey: ["brain-dump-batch", activeBatchId],
    queryFn: async () => {
      const res = await fetch(`/api/brain-dump/batch/${activeBatchId}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      return res.json();
    },
    enabled: !!activeBatchId,
    refetchInterval: (query) => query.state.data?.terminal ? false : 3_000,
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/brain-dump/batch/${activeBatchId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(`Cancel failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["brain-dump-batch", activeBatchId] }),
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-amber-100">Bulk Brain Dump</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload multiple session logs at once. They&apos;ll be queued and processed sequentially.
        </p>
      </div>

      {!activeBatchId && (
        <>
          {/* Drop zone */}
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-amber-900/40 rounded-lg p-8 text-center cursor-pointer hover:border-amber-700/50 transition-colors"
            onClick={() => {
              const input = document.createElement("input");
              input.type = "file";
              input.multiple = true;
              input.accept = ".txt,.md";
              input.onchange = (e) => {
                const files = (e.target as HTMLInputElement).files;
                if (files) handleFiles(files);
              };
              input.click();
            }}
          >
            <Upload className="h-8 w-8 mx-auto mb-2 text-amber-500/60" />
            <p className="text-sm text-amber-200/80">Drop .txt or .md files here, or click to browse</p>
            <p className="text-xs text-muted-foreground mt-1">Each file becomes one brain dump job</p>
          </div>

          {/* Paste area */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Or paste multiple texts separated by <code className="bg-muted px-1 rounded">---</code></p>
            <Textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="Paste session logs here, separated by --- on its own line..."
              className="min-h-[100px] bg-amber-950/20 border-amber-900/30 text-amber-100"
            />
            <Button size="sm" variant="outline" onClick={handlePaste} disabled={!pasteText.trim()}>
              Add to Queue
            </Button>
          </div>

          <Separator />

          {/* Staged items */}
          {staged.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-amber-200">{staged.length} item{staged.length !== 1 ? "s" : ""} staged</h2>
                <div className="flex items-center gap-2">
                  <select
                    value={mode}
                    onChange={(e) => setMode(e.target.value as BatchMode)}
                    className="text-xs bg-amber-950/40 border border-amber-900/30 rounded px-2 py-1 text-amber-200"
                  >
                    <option value="auto">Auto (create immediately)</option>
                    <option value="review">Review (propose first)</option>
                  </select>
                  <Button
                    size="sm"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                  >
                    {submitMutation.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Play className="h-3 w-3 mr-1" />}
                    Submit Batch
                  </Button>
                </div>
              </div>

              {staged.map((item) => (
                <div key={item.id} className="flex items-start gap-3 p-3 rounded border border-amber-900/20 bg-amber-950/10">
                  <FileText className="h-4 w-4 mt-0.5 text-amber-500/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    {item.fileName && <p className="text-xs font-medium text-amber-300">{item.fileName}</p>}
                    <p className="text-xs text-muted-foreground truncate">{item.rawText.slice(0, 200)}</p>
                  </div>
                  <button onClick={() => removeStaged(item.id)} className="text-muted-foreground hover:text-red-400">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded border border-red-500/30 bg-red-500/10 text-red-300 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
        </>
      )}

      {/* Active batch status */}
      {activeBatchId && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-amber-200">Batch: {activeBatchId}</h2>
              {batchQuery.data && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {Object.entries(batchQuery.data.counts || {}).map(([k, v]) => `${v} ${k}`).join(" · ")}
                  {batchQuery.data.terminal && " · Complete"}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {!batchQuery.data?.terminal && (
                <Button size="sm" variant="destructive" onClick={() => cancelMutation.mutate()} disabled={cancelMutation.isPending}>
                  <Trash2 className="h-3 w-3 mr-1" /> Cancel Queued
                </Button>
              )}
              {batchQuery.data?.terminal && (
                <Button size="sm" variant="outline" onClick={() => { setActiveBatchId(null); setStaged([]); }}>
                  New Batch
                </Button>
              )}
            </div>
          </div>

          {batchQuery.isLoading && (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          )}

          {batchQuery.data?.jobs?.map((job: any) => (
            <div key={job.id} className="flex items-start gap-3 p-3 rounded border border-amber-900/20 bg-amber-950/10">
              <div className="shrink-0 mt-0.5">{statusBadge(job.status)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{job.rawText.slice(0, 200)}</p>
                {job.error && <p className="text-xs text-red-400 mt-1">{job.error}</p>}
              </div>
              <div className="shrink-0 flex items-center gap-1">
                {job.status === "done" && job.resultHistoryId && (
                  <Link href={`/brain-dump/${job.resultHistoryId}`} className="text-xs text-amber-400 hover:underline flex items-center gap-1">
                    View <ArrowRight className="h-3 w-3" />
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
