"use client";

import { useQuery } from "@tanstack/react-query";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Search, BookOpen } from "lucide-react";
import Link from "next/link";
import { LoreTree } from "@/components/portal/LoreTree";
import { ServiceBanner } from "@/components/portal/ServiceBanner";
import { fetchJsonOrThrow } from "@/lib/fetch-json";
import { CopilotTrigger } from "@/components/portal/CopilotTrigger";
import { useCopilotStore } from "@/lib/stores/copilot-store";

interface Note {
  noteId: string;
  title: string;
  type: string;
  dateModified: string;
  dateCreated: string;
  attributes: Array<{ name: string; value: string; type?: string }>;
  parentNoteIds: string[];
}

const LORE_TYPE_QUERIES: Record<string, string> = {
  All: "#lore",
  Drafts: "#lore #draft",
  Character: "#lore #loreType=character",
  Location: "#lore #loreType=location",
  Faction: "#lore #loreType=faction",
  Creature: "#lore #loreType=creature",
  Event: "#lore #loreType=event",
  Manuscript: "#lore #loreType=manuscript",
};

const TYPE_COLORS: Record<string, string> = {
  character: "border-blue-500/60 text-blue-300 bg-blue-500/10",
  location: "border-green-500/60 text-green-300 bg-green-500/10",
  faction: "border-purple-500/60 text-purple-300 bg-purple-500/10",
  creature: "border-red-500/60 text-red-300 bg-red-500/10",
  event: "border-yellow-500/60 text-yellow-300 bg-yellow-500/10",
  manuscript: "border-orange-500/60 text-orange-300 bg-orange-500/10",
};

function getLoreType(note: Note): string {
  return (
    note.attributes?.find((a) => a.name === "loreType")?.value ??
    note.attributes?.find((a) => a.name === "template")?.value ??
    "entry"
  );
}

/**
 * Render the Lore Browser page content with search, category filtering, and a list of lore entries.
 *
 * Synchronizes search and category state with the URL (search is debounced), fetches lore entries,
 * applies client-side title and category filtering, and renders the sidebar, header, filter input,
 * a responsive grid of lore cards (with loading, error, and empty states), and a floating Copilot trigger.
 *
 * @returns A React element containing the lore browser UI.
 */
function LorePageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const searchParam = searchParams.get("search") ?? "";
  const categoryParam = searchParams.get("category") ?? "All";

  // Local draft for immediate input response; debounced to URL after 300 ms
  const [draftSearch, setDraftSearch] = useState(searchParam);

  useEffect(() => {
    if (draftSearch === searchParam) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      if (draftSearch) params.set("search", draftSearch);
      else params.delete("search");
      router.replace(`${pathname}?${params}`, { scroll: false });
    }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftSearch]);

  function handleCategorySelect(id: string | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (id && id !== "All") params.set("category", id);
    else params.delete("category");
    router.replace(`${pathname}?${params}`, { scroll: false });
  }

  const query = "#lore";

  const { data: notes, isLoading, isError, error } = useQuery<Note[]>({
    queryKey: ["lore", query],
    queryFn: () => fetchJsonOrThrow<Note[]>(`/api/lore?q=${encodeURIComponent(query)}`),
    retry: false,
  });

  const searched = Array.isArray(notes)
    ? notes.filter((n) => n.title.toLowerCase().includes(draftSearch.toLowerCase()))
    : [];

  const filtered = categoryParam && categoryParam !== "All"
    ? searched.filter(n => getLoreType(n) === categoryParam)
    : searched;

  return (
    <div className="flex flex-col lg:flex-row gap-8 items-start">
      {/* Sidebar Tree */}
      <div className="w-full lg:w-72 shrink-0 rounded-xl border border-border bg-card shadow-sm overflow-hidden hidden lg:block h-[calc(100vh-140px)] sticky top-6">
        <div className="p-3 border-b bg-muted/10 font-medium text-sm text-foreground/80 flex justify-between items-center" style={{ fontFamily: "var(--font-cinzel)" }}>
          Categories
        </div>
        <div className="h-[calc(100%-45px)]">
          <LoreTree selectedId={categoryParam} onSelectNode={handleCategorySelect} />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0 space-y-6 w-full">
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
        <Button asChild size="sm" className="min-h-11 gap-2">
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
            value={draftSearch}
            onChange={(e) => setDraftSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-lg" />
          ))}
        </div>
      ) : isError ? (
        <ServiceBanner service="AllCodex" error={error} />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <BookOpen className="h-16 w-16 text-muted-foreground/20 mb-4" />
          <h2 className="text-lg font-medium text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>
            The chronicle is empty
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            {draftSearch
              ? `No entries matching "${draftSearch}"`
              : "Create your first lore entry to begin the chronicle"}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((note) => {
            const loreType = getLoreType(note);
            const colorClass = TYPE_COLORS[loreType] ?? "border-white/20 text-muted-foreground bg-white/5";
            const modifiedDate = new Date(note.dateModified).toLocaleDateString();
            return (
              <Link
                key={note.noteId}
                href={`/lore/${note.noteId}`}
                aria-label={`${note.title}, ${loreType}, modified ${modifiedDate}`}
                className="group block min-h-11 rounded-lg border border-border bg-card/80 p-4 hover:border-primary/50 hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold leading-tight group-hover:text-primary transition-colors line-clamp-2">
                    {note.title}
                  </h3>
                  <div className="flex gap-1.5 items-center">
                    <Badge
                      variant="outline"
                      className={`shrink-0 text-[10px] uppercase tracking-wider font-semibold ${colorClass}`}
                    >
                      {loreType}
                    </Badge>
                    {note.attributes?.some(a => a.name === "draft") && (
                      <Badge variant="outline" className="shrink-0 text-[10px] uppercase tracking-wider font-semibold border-amber-500/40 text-amber-500 bg-amber-500/10">
                        Draft
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="grimoire-divider mt-3 mb-2" />
                <p className="text-xs text-muted-foreground">
                  Modified {modifiedDate}
                </p>
              </Link>
            );
          })}
        </div>
      )}
      </div>

      {/* Floating Copilot Trigger */}
      <div className="fixed bottom-6 right-6 z-50">
        <CopilotTrigger noteId={useCopilotStore.getState().activeNoteId || filtered[0]?.noteId || ""} />
      </div>
    </div>
  );
}

export default function LorePage() {
  return (
    <Suspense>
      <LorePageContent />
    </Suspense>
  );
}
