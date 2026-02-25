"use client";

import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, Plus, Search, Filter, ChevronDown } from "lucide-react";
import Link from "next/link";

interface Note {
  noteId: string;
  title: string;
  type: string;
  dateModified: string;
  dateCreated: string;
  attributes: Array<{ name: string; value: string; type?: string }>;
}

const LORE_TYPE_QUERIES: Record<string, string> = {
  All: "#lore",
  Character: "#lore #loreType=character",
  Location: "#lore #loreType=location",
  Faction: "#lore #loreType=faction",
  Creature: "#lore #loreType=creature",
  Event: "#lore #loreType=event",
  Manuscript: "#lore #loreType=manuscript",
};

const TYPE_COLORS: Record<string, string> = {
  character: "border-blue-500/40 text-blue-400",
  location: "border-green-500/40 text-green-400",
  faction: "border-purple-500/40 text-purple-400",
  creature: "border-red-500/40 text-red-400",
  event: "border-yellow-500/40 text-yellow-400",
  manuscript: "border-orange-500/40 text-orange-400",
};

function getLoreType(note: Note): string {
  return (
    note.attributes?.find((a) => a.name === "loreType")?.value ??
    note.attributes?.find((a) => a.name === "template")?.value ??
    "entry"
  );
}

export default function LorePage() {
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");

  const query = LORE_TYPE_QUERIES[filter] ?? "#lore";

  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ["lore", query],
    queryFn: async () => {
      const r = await fetch(`/api/lore?q=${encodeURIComponent(query)}`);
      if (!r.ok) throw new Error((await r.json()).error ?? r.statusText);
      return r.json() as Promise<Note[]>;
    },
  });

  const filtered = Array.isArray(notes)
    ? notes.filter((n) => n.title.toLowerCase().includes(search.toLowerCase()))
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-primary"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            Lore Browser
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isLoading ? "Loading entries…" : `${filtered.length} entries`}
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/lore/new">
            <Plus className="h-4 w-4" />
            New Entry
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filter by title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-2 shrink-0">
              <Filter className="h-4 w-4" />
              {filter}
              <ChevronDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {Object.keys(LORE_TYPE_QUERIES).map((t) => (
              <DropdownMenuItem key={t} onClick={() => setFilter(t)}>
                {t}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h2 className="text-lg font-medium text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>
            The chronicle is empty
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {search
              ? `No entries matching "${search}"`
              : "Create your first lore entry to begin the chronicle"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => {
            const loreType = getLoreType(note);
            const colorClass = TYPE_COLORS[loreType] ?? "border-border/60 text-muted-foreground";
            return (
              <Link
                key={note.noteId}
                href={`/lore/${note.noteId}`}
                className="group block rounded-lg border bg-card p-4 hover:border-primary/50 hover:bg-card/80 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {note.title}
                  </h3>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs capitalize ${colorClass}`}
                  >
                    {loreType}
                  </Badge>
                </div>
                <div className="grimoire-divider mt-3 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Modified {new Date(note.dateModified).toLocaleDateString()}
                </p>
                {/* Attributes preview */}
                <div className="flex flex-wrap gap-1 mt-2">
                  {note.attributes
                    ?.filter(
                      (a) =>
                        a.type !== "relation" &&
                        !["template", "loreType"].includes(a.name) &&
                        a.value
                    )
                    .slice(0, 3)
                    .map((attr) => (
                      <span
                        key={attr.name}
                        className="text-[10px] text-muted-foreground/70 bg-secondary/50 rounded px-1.5 py-0.5"
                      >
                        {attr.name}: {attr.value}
                      </span>
                    ))}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
