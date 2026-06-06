"use client";

import { useQuery } from "@tanstack/react-query";
import { BookOpen, Lock, Scroll } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJsonOrThrow } from "@/lib/fetch-json";

interface PublicLoreItem {
  noteId: string;
  title: string;
  loreType: string | null;
  dateModified: string;
}

export default function PublicHomePage() {
  const { data, isLoading, isError } = useQuery<{ items: PublicLoreItem[] }>({
    queryKey: ["public-lore"],
    queryFn: () => fetchJsonOrThrow("/api/public/lore"),
    retry: false,
  });

  const items = data?.items ?? [];

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/30 px-5 py-4">
        <div className="mx-auto flex max-w-5xl items-center gap-3">
          <Scroll className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-sm font-bold uppercase tracking-[0.18em] text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
              AllCodex
            </h1>
            <p className="text-xs text-muted-foreground">Published lore archive</p>
          </div>
          <Button asChild size="sm" variant="outline" className="ml-auto gap-2 rounded-none">
            <Link href="/login">
              <Lock className="h-3.5 w-3.5" />
              Owner Login
            </Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-5 py-8">
        <div className="mb-6">
          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>
            Public Chronicle
          </p>
          <h2 className="mt-1 text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
            Published Lore
          </h2>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
          </div>
        ) : isError ? (
          <div className="border border-border/40 bg-card/50 p-6 text-sm text-muted-foreground">
            Published lore is not available.
          </div>
        ) : items.length === 0 ? (
          <div className="border border-border/40 bg-card/50 p-6 text-sm text-muted-foreground">
            No published lore yet.
          </div>
        ) : (
          <div className="divide-y divide-border/30 border border-border/40 bg-card/40">
            {items.map((item) => (
              <Link
                key={item.noteId}
                href={`/public/lore/${item.noteId}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-accent/20"
              >
                <BookOpen className="h-4 w-4 shrink-0 text-primary/70" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {item.dateModified ? new Date(item.dateModified).toLocaleDateString() : "Published"}
                  </p>
                </div>
                {item.loreType && <Badge variant="outline" className="shrink-0 text-xs capitalize">{item.loreType}</Badge>}
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
