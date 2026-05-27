"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Loader2, AlertCircle, BookOpen, Search, ChevronRight } from "lucide-react";
import { StatblockCard } from "@/components/portal/StatblockCard";

interface StatblockNote {
  noteId: string;
  title: string;
  attributes: Array<{ name: string; value: string; type: string }>;
}

function attr(note: StatblockNote, name: string): string | undefined {
  return note.attributes.find((a) => a.name === name)?.value;
}

const CR_ORDER: Record<string, number> = {
  "0": 0, "1/8": 0.125, "1/4": 0.25, "1/2": 0.5,
};
function crToNum(cr: string | undefined): number {
  if (!cr) return -1;
  if (cr in CR_ORDER) return CR_ORDER[cr];
  return parseFloat(cr) ?? -1;
}

export default function StatblocksPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [crFilter, setCrFilter] = useState<"all" | "low" | "mid" | "high">("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  const { data: statblocks, isLoading, isError } = useQuery<StatblockNote[]>({
    queryKey: ["statblocks"],
    queryFn: () => fetch("/api/statblocks").then((r) => r.json()),
    staleTime: 30_000,
  });

  const { mutate: createStatblock, isPending: isCreating } = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/lore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "New Statblock",
          loreType: "statblock",
          templateId: "_template_statblock",
          attributes: {
            crName: "New Statblock",
            challengeRating: "0",
            crLevel: "0",
            ac: "10",
            hp: "10",
            speed: "30 ft.",
            str: "10",
            dex: "10",
            con: "10",
            int: "10",
            wis: "10",
            cha: "10",
          },
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: (data) => {
      const noteId = data?.note?.noteId;
      if (noteId) {
        queryClient.invalidateQueries({ queryKey: ["statblocks"] });
        setNewlyCreatedId(noteId);
        setSelectedId(noteId);
      }
    },
  });

  const filtered = (statblocks ?? []).filter((n) => {
    const name = (attr(n, "crName") ?? n.title).toLowerCase();
    const type = (attr(n, "creatureType") ?? "").toLowerCase();
    if (search && !name.includes(search.toLowerCase()) && !type.includes(search.toLowerCase())) {
      return false;
    }
    if (crFilter !== "all") {
      const cr = crToNum(attr(n, "challengeRating") ?? attr(n, "crLevel"));
      if (crFilter === "low" && cr > 4) return false;
      if (crFilter === "mid" && (cr < 5 || cr > 14)) return false;
      if (crFilter === "high" && cr < 15) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    return crToNum(attr(a, "challengeRating") ?? attr(a, "crLevel")) -
           crToNum(attr(b, "challengeRating") ?? attr(b, "crLevel"));
  });

  const selectedNote = statblocks?.find((n) => n.noteId === selectedId);

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left pane */}
      <div className="w-72 shrink-0 flex flex-col border-r border-border/30 overflow-hidden bg-card/20">
        <div className="px-4 py-3 border-b border-border/30 shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-[0.12em]" style={{ fontFamily: "var(--font-cinzel)" }}>
              Statblock Library
            </span>
            {statblocks && (
              <span className="text-[10px] text-muted-foreground ml-1">{statblocks.length}</span>
            )}
            <button
              onClick={() => createStatblock()}
              disabled={isCreating}
              className="ml-auto flex items-center gap-1 bg-amber-900/40 hover:bg-amber-900/60 border border-amber-800 text-[10px] text-amber-200 px-2 py-0.5 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? (
                <>
                  <Loader2 className="h-2.5 w-2.5 animate-spin" />
                  Creating…
                </>
              ) : (
                "+ New"
              )}
            </button>
          </div>
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-7 h-7 text-xs rounded-none bg-muted/20 border-border/40"
            />
          </div>
          <div className="flex gap-1">
            {(["all", "low", "mid", "high"] as const).map((tier) => (
              <button
                key={tier}
                onClick={() => setCrFilter(tier)}
                className={`flex-1 py-0.5 text-[10px] transition-colors ${
                  crFilter === tier
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                {tier === "all" ? "All" : tier === "low" ? "0–4" : tier === "mid" ? "5–14" : "15+"}
              </button>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {isLoading && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-xs">Loading…</span>
            </div>
          )}
          {isError && (
            <div className="flex items-center gap-2 p-4 text-destructive text-xs">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              Connection error
            </div>
          )}
          {!isLoading && !isError && sorted.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8 italic">
              {statblocks?.length === 0 ? "No statblocks found" : "No matches"}
            </p>
          )}
          {sorted.map((n) => {
            const name = attr(n, "crName") ?? n.title;
            const cr = attr(n, "challengeRating") ?? attr(n, "crLevel");
            const type = attr(n, "creatureType");
            const isSelected = n.noteId === selectedId;
            return (
              <button
                key={n.noteId}
                onClick={() => setSelectedId(n.noteId)}
                className={`w-full text-left px-4 py-2.5 border-b border-border/15 transition-colors flex items-center gap-2 ${
                  isSelected
                    ? "bg-primary/10 border-l-2 border-l-primary"
                    : "hover:bg-card/50 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-medium truncate ${isSelected ? "text-primary" : ""}`} style={{ fontFamily: "var(--font-cinzel)" }}>
                    {name}
                  </p>
                  {type && <p className="text-[10px] text-muted-foreground capitalize truncate mt-0.5">{type}</p>}
                </div>
                {cr !== undefined && (
                  <span className="text-[10px] text-primary/70 font-mono shrink-0">CR {cr}</span>
                )}
                {isSelected && <ChevronRight className="h-3 w-3 text-primary shrink-0" />}
              </button>
            );
          })}
        </ScrollArea>
      </div>

      {/* Right pane */}
      <div className="flex-1 overflow-auto">
        {!selectedNote ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <BookOpen className="h-10 w-10 mb-3 opacity-20" />
            <p className="text-sm opacity-60" style={{ fontFamily: "var(--font-cinzel)" }}>Select a statblock</p>
            <p className="text-xs opacity-40 mt-1">Choose an entry from the library</p>
          </div>
        ) : (
          <div className="p-6 max-w-2xl">
            <StatblockCard
              key={selectedNote.noteId}
              note={selectedNote}
              initialIsEditing={selectedNote.noteId === newlyCreatedId}
              onEditToggle={(editing) => {
                if (!editing) setNewlyCreatedId(null);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
