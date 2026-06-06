"use client";

import { useQuery } from "@tanstack/react-query";
import { Lock, Scroll } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJsonOrThrow } from "@/lib/fetch-json";

interface PublicSharePage {
  noteId: string;
  title: string;
  contentHtml: string;
  dateModified: string;
}

export default function PublicHomePage() {
  const { data, isLoading, isError } = useQuery<PublicSharePage>({
    queryKey: ["public-lore"],
    queryFn: () => fetchJsonOrThrow("/api/public/lore"),
    retry: false,
  });

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
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isError || !data ? (
          <div className="border border-border/40 bg-card/50 p-6 text-sm text-muted-foreground">
            Published lore is not available.
          </div>
        ) : !data.contentHtml ? (
          <div className="border border-border/40 bg-card/50 p-6 text-sm text-muted-foreground">
            No published lore yet.
          </div>
        ) : (
          <div className="space-y-5">
            <h3 className="text-2xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
              {data.title}
            </h3>
            <div
              className="prose prose-invert max-w-none border border-border/40 bg-card/40 p-5 font-[var(--font-crimson)] text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: data.contentHtml }}
            />
          </div>
        )}
      </section>
    </main>
  );
}
