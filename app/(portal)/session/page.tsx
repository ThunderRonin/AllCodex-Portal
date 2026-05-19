"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Swords,
  Zap,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Clock,
  Plus,
  X,
  Shield,
} from "lucide-react";
import { StatblockCard } from "@/components/portal/StatblockCard";

interface CapturedEntity {
  noteId: string;
  title: string;
  type: string;
  wasUpdated: boolean;
}

interface SessionPin {
  noteId: string;
  title: string;
  href: string;
}

function EntityPill({ entity }: { entity: CapturedEntity }) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border/50 bg-muted/30 px-2 py-1 text-xs">
      {entity.wasUpdated ? (
        <CheckCircle2 className="h-3 w-3 text-amber-400 shrink-0" />
      ) : (
        <Plus className="h-3 w-3 text-emerald-400 shrink-0" />
      )}
      <span className="font-medium">{entity.title}</span>
      <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">{entity.type}</Badge>
    </div>
  );
}

/**
 * Render the Session Workspace UI for quick capture, pinned notes, scene notes, statblock lookup, and session recap.
 *
 * Manages local UI state (capture text, captured entities, pins, scene notes, statblock selection) and uses react-query to load brain-dump history, perform quick-capture mutations, and run pin/statblock searches.
 *
 * @returns The session workspace React element containing three columns: quick capture & pinned notes (left), scene notes (center), and statblock lookup & recap (right).
 */
export default function SessionPage() {
  const queryClient = useQueryClient();
  const [captureText, setCaptureText] = useState("");
  const [capturedEntities, setCapturedEntities] = useState<CapturedEntity[]>([]);
  const [pins, setPins] = useState<SessionPin[]>([]);
  const [pinSearchQuery, setPinSearchQuery] = useState("");
  const [sceneNotes, setSceneNotes] = useState("");
  const [statblockQuery, setStatblockQuery] = useState("");
  const [activeStatblock, setActiveStatblock] = useState<{ noteId: string; title: string; attributes: Array<{ name: string; value: string; type: string }> } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load recent brain-dump history for recap
  const { data: historyEntries } = useQuery<Array<{ id: string; createdAt: string; summary?: string; notesCreated?: string[]; notesUpdated?: string[] }>>({
    queryKey: ["brain-dump-history"],
    queryFn: async () => {
      const r = await fetch("/api/brain-dump/history");
      const data = await r.json();
      return data.items ?? (Array.isArray(data) ? data : []);
    },
    staleTime: 60_000,
  });

  // Quick-capture mutation → brain-dump mode="auto"
  const captureMutation = useMutation({
    mutationFn: (rawText: string) =>
      fetch("/api/brain-dump", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText, mode: "auto" }),
      }).then((r) => r.json()),
    onSuccess: (data) => {
      const newEntities: CapturedEntity[] = [
        ...(data.created ?? []).map((e: { noteId: string; title: string; type: string }) => ({
          noteId: e.noteId,
          title: e.title,
          type: e.type ?? "note",
          wasUpdated: false,
        })),
        ...(data.updated ?? []).map((e: { noteId: string; title: string; type: string }) => ({
          noteId: e.noteId,
          title: e.title,
          type: e.type ?? "note",
          wasUpdated: true,
        })),
      ];
      setCapturedEntities((prev) => [...newEntities, ...prev]);
      setCaptureText("");
      queryClient.invalidateQueries({ queryKey: ["brain-dump-history"] });
    },
  });

  // Pin search
  const { data: searchResults } = useQuery<Array<{ noteId: string; title: string }>>({
    queryKey: ["pin-search", pinSearchQuery],
    queryFn: () =>
      fetch(`/api/search?q=${encodeURIComponent(pinSearchQuery)}&limit=8`).then(async (r) => {
        const data = await r.json();
        // search API returns { mode, results } or bare array
        const items: Array<{ noteId: string; title: string }> = Array.isArray(data)
          ? data
          : (data?.results ?? []);
        return items.slice(0, 8);
      }),
    enabled: pinSearchQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  function handleCapture() {
    const text = captureText.trim();
    if (!text) return;
    captureMutation.mutate(text);
  }

  function addPin(item: { noteId: string; title: string }) {
    if (pins.some((p) => p.noteId === item.noteId)) return;
    setPins((prev) => [...prev, { noteId: item.noteId, title: item.title, href: `/lore/${item.noteId}` }]);
    setPinSearchQuery("");
  }

  function removePin(noteId: string) {
    setPins((prev) => prev.filter((p) => p.noteId !== noteId));
  }

  const recentHistory = (Array.isArray(historyEntries) ? historyEntries : []).slice(0, 5);

  // Statblock quick-lookup
  const { data: statblockResults } = useQuery<Array<{ noteId: string; title: string; attributes: Array<{ name: string; value: string; type: string }> }>>({
    queryKey: ["statblock-search", statblockQuery],
    queryFn: () =>
      fetch(`/api/search?q=${encodeURIComponent(`#statblock ${statblockQuery}`)}&limit=6`)
        .then(async (r) => {
          const data = await r.json();
          const items = Array.isArray(data) ? data : (data?.results ?? []);
          return items.slice(0, 6);
        }),
    enabled: statblockQuery.trim().length >= 2,
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-border/50 shrink-0">
        <Swords className="h-5 w-5 text-primary" />
        <h1 className="font-bold text-lg" style={{ fontFamily: "var(--font-cinzel)" }}>
          Session Workspace
        </h1>
        <Badge variant="secondary" className="ml-auto text-xs">
          Live
        </Badge>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden divide-x divide-border/40">

        {/* Left: Quick Capture + Pinned Notes */}
        <div className="w-[300px] shrink-0 flex flex-col overflow-hidden">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">

              {/* Quick Capture */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="h-4 w-4 text-amber-400" />
                  <span className="text-sm font-semibold">Quick Capture</span>
                </div>
                <Textarea
                  ref={textareaRef}
                  value={captureText}
                  onChange={(e) => setCaptureText(e.target.value)}
                  onKeyDown={(e) => {
                    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                      e.preventDefault();
                      handleCapture();
                    }
                  }}
                  placeholder="Jot down a name, event, or detail... (⌘↵ to send)"
                  className="min-h-[100px] text-sm resize-none"
                />
                <Button
                  size="sm"
                  className="mt-2 w-full"
                  onClick={handleCapture}
                  disabled={captureMutation.isPending || !captureText.trim()}
                >
                  {captureMutation.isPending ? "Capturing…" : "Send to Lore"}
                </Button>

                {captureMutation.isError && (
                  <p className="mt-1 text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    Capture failed — check AllKnower connection
                  </p>
                )}
              </div>

              {/* Captured entities this session */}
              {capturedEntities.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2 font-medium">Captured this session</p>
                  <div className="flex flex-wrap gap-1.5">
                    {capturedEntities.map((e) => (
                      <EntityPill key={e.noteId} entity={e} />
                    ))}
                  </div>
                </div>
              )}

              <Separator className="opacity-30" />

              {/* Pinned Notes */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <BookOpen className="h-4 w-4 text-primary" />
                  <span className="text-sm font-semibold">Pinned Notes</span>
                </div>
                <input
                  value={pinSearchQuery}
                  onChange={(e) => setPinSearchQuery(e.target.value)}
                  placeholder="Search to pin a note…"
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
                />
                {searchResults && searchResults.length > 0 && pinSearchQuery.trim().length >= 2 && (
                  <div className="mt-1 rounded-md border border-border/50 bg-popover shadow-md overflow-hidden">
                    {searchResults.map((r) => (
                      <button
                        key={r.noteId}
                        onClick={() => addPin(r)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                      >
                        {r.title}
                      </button>
                    ))}
                  </div>
                )}

                {pins.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {pins.map((pin) => (
                      <div key={pin.noteId} className="flex items-center gap-2 group rounded-md px-2 py-1.5 bg-muted/30 border border-border/40">
                        <a
                          href={pin.href}
                          className="flex-1 text-sm truncate hover:text-primary transition-colors"
                        >
                          {pin.title}
                        </a>
                        <button
                          onClick={() => removePin(pin.noteId)}
                          className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </div>

        {/* Center: Scene Notes */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 shrink-0">
            <span className="text-sm font-semibold text-muted-foreground">Scene Notes</span>
            <span className="text-xs text-muted-foreground/50 ml-auto">Scratch space — not synced</span>
          </div>
          <Textarea
            value={sceneNotes}
            onChange={(e) => setSceneNotes(e.target.value)}
            placeholder="Scene description, NPC dialogue, combat notes — anything for this moment…"
            className="flex-1 resize-none rounded-none border-0 focus-visible:ring-0 text-sm p-4 bg-background/60"
          />
        </div>

        {/* Right: Statblock Lookup + Session Recap */}
        <div className="w-[300px] shrink-0 flex flex-col overflow-hidden divide-y divide-border/30">

          {/* Statblock quick-lookup */}
          <div className="flex flex-col overflow-hidden" style={{ maxHeight: "60%" }}>
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border/30 shrink-0">
              <Shield className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Statblock Lookup</span>
            </div>
            <div className="px-3 py-2 shrink-0">
              <input
                value={statblockQuery}
                onChange={(e) => setStatblockQuery(e.target.value)}
                placeholder="Search statblocks…"
                className="w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground/50"
              />
              {statblockResults && statblockResults.length > 0 && statblockQuery.trim().length >= 2 && !activeStatblock && (
                <div className="mt-1 rounded-md border border-border/50 bg-popover shadow-md overflow-hidden">
                  {statblockResults.map((r) => (
                    <button
                      key={r.noteId}
                      onClick={() => setActiveStatblock(r)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                    >
                      {r.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {activeStatblock && (
              <ScrollArea className="flex-1 px-3 pb-3">
                <div className="flex justify-end mb-1">
                  <button
                    onClick={() => { setActiveStatblock(null); setStatblockQuery(""); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    ✕ clear
                  </button>
                </div>
                <StatblockCard note={activeStatblock} />
              </ScrollArea>
            )}
          </div>

          {/* Session Recap */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 shrink-0">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-semibold">Recap</span>
            </div>
            <ScrollArea className="flex-1 px-4 pb-4">
              {recentHistory.length === 0 ? (
                <p className="text-xs text-muted-foreground opacity-60">
                  Recent brain-dump entries will appear here. Capture something to start tracking lore changes.
                </p>
              ) : (
                <div className="space-y-3">
                  {recentHistory.map((entry) => (
                    <Card key={entry.id} className="border-border/40 bg-muted/20">
                      <CardHeader className="px-3 py-2 pb-1">
                        <CardTitle className="text-xs font-medium text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="px-3 py-2 pt-0">
                        {entry.summary ? (
                          <p className="text-xs leading-relaxed">{entry.summary}</p>
                        ) : (
                          <p className="text-xs text-muted-foreground/60 italic">
                            {(entry.notesCreated?.length ?? 0) + (entry.notesUpdated?.length ?? 0)} entr{((entry.notesCreated?.length ?? 0) + (entry.notesUpdated?.length ?? 0)) === 1 ? "y" : "ies"} captured
                          </p>
                        )}
                        <a
                          href={`/brain-dump/history/${entry.id}`}
                          className="mt-1.5 inline-block text-[10px] text-primary hover:underline"
                        >
                          View details →
                        </a>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </div>
      </div>
    </div>
  );
}
