"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tabs,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Search, Sparkles, Tag, ArrowRight, BookOpen } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Suspense } from "react";

interface NoteResult {
  noteId: string;
  title: string;
  type?: string;
  score?: number;
  content?: string;
}

const TYPE_COLORS: Record<string, string> = {
  character: "border-blue-500/40 text-blue-300",
  location: "border-green-500/40 text-green-300",
  faction: "border-purple-500/40 text-purple-300",
  creature: "border-orange-500/40 text-orange-300",
  event: "border-yellow-500/40 text-yellow-300",
  manuscript: "border-pink-500/40 text-pink-300",
};

function SearchContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = (searchParams.get("mode") as "rag" | "etapi") ?? "rag";
  const initialQ = searchParams.get("q") ?? "";

  const [query, setQuery] = useState(initialQ);
  const [mode, setMode] = useState<"rag" | "etapi">(initialMode);
  const [submitted, setSubmitted] = useState(!!initialQ);
  const [searchKey, setSearchKey] = useState(0);

  const { data, isLoading } = useQuery<{ results: NoteResult[] } | NoteResult[]>({
    queryKey: ["search", query, mode, searchKey],
    queryFn: async () => {
      if (mode === "rag") {
        const res = await fetch("/api/rag", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: query, topK: 20 }),
        });
        return res.json();
      } else {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(query)}&mode=etapi`
        );
        return res.json();
      }
    },
    enabled: submitted && !!query.trim(),
  });

  const results: NoteResult[] = (() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    return (data as any).results ?? (data as any).notes ?? [];
  })();

  function handleSearch(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setSubmitted(true);
    setSearchKey((k) => k + 1);
    router.push(`/search?q=${encodeURIComponent(query)}&mode=${mode}`, {
      scroll: false,
    });
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-primary"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Chronicle Search
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Search your lore using semantic similarity or attribute-based
          full-text lookup.
        </p>
      </div>

      <form onSubmit={handleSearch} className="space-y-3">
        <Tabs
          value={mode}
          onValueChange={(v) => setMode(v as "rag" | "etapi")}
        >
          <TabsList className="mb-3">
            <TabsTrigger value="rag" className="gap-1.5 text-xs">
              <Sparkles className="h-3 w-3" />
              Semantic (AI)
            </TabsTrigger>
            <TabsTrigger value="etapi" className="gap-1.5 text-xs">
              <Tag className="h-3 w-3" />
              Attribute
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-2">
          <Input
            placeholder={
              mode === "rag"
                ? "Describe what you're looking for…"
                : "Search by title or attribute…"
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={!query.trim() || isLoading}>
            <Search className="h-4 w-4" />
            <span className="sr-only">Search</span>
          </Button>
        </div>
        {mode === "rag" && (
          <p className="text-xs text-muted-foreground">
            AI semantic search finds conceptually related entries, even with
            different wording.
          </p>
        )}
        {mode === "etapi" && (
          <p className="text-xs text-muted-foreground">
            Attribute search matches titles and labels stored in AllCodex.
          </p>
        )}
      </form>

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!isLoading && submitted && results.length > 0 && (
        <div className="space-y-2">
          <p
            className="text-xs uppercase tracking-wider text-muted-foreground"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            {results.length} result{results.length !== 1 ? "s" : ""}
            {mode === "rag" ? " (semantic)" : " (attribute)"}
          </p>
          {results.map((r) => {
            const typeColor =
              r.type ? TYPE_COLORS[r.type.toLowerCase()] ?? "border-border text-muted-foreground" : "border-border text-muted-foreground";
            return (
              <Link
                key={r.noteId}
                href={`/lore/${r.noteId}`}
                className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-4 py-3 hover:border-primary/40 hover:bg-card/80 transition-all group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <BookOpen className="h-4 w-4 text-primary/50 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {r.title}
                    </p>
                    {r.content && (
                      <p className="text-xs text-muted-foreground truncate max-w-xs mt-0.5">
                        {r.content.replace(/<[^>]+>/g, "").slice(0, 80)}…
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-3">
                  {r.type && (
                    <Badge variant="outline" className={`text-xs capitalize ${typeColor}`}>
                      {r.type}
                    </Badge>
                  )}
                  {typeof r.score === "number" && (
                    <span className="text-xs text-muted-foreground font-mono">
                      {(r.score * 100).toFixed(0)}%
                    </span>
                  )}
                  <ArrowRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {!isLoading && submitted && results.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-20" />
          <p className="text-sm">No results found for &ldquo;{query}&rdquo;.</p>
          {mode === "rag" && (
            <p className="text-xs mt-1 opacity-60">
              Try switching to attribute search or refining your query.
            </p>
          )}
        </div>
      )}

      {!submitted && (
        <div className="text-center py-12 text-muted-foreground">
          <Search className="h-10 w-10 mx-auto mb-3 opacity-15" />
          <p className="text-sm">Enter a search query above.</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 w-full" />}>
      <SearchContent />
    </Suspense>
  );
}
