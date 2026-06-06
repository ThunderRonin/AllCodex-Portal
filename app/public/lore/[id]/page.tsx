"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Lock, Scroll } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchJsonOrThrow } from "@/lib/fetch-json";

interface PublicLoreDetail {
  noteId: string;
  title: string;
  loreType: string | null;
  contentHtml: string;
  dateModified: string;
}

export default function PublicLoreDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading, isError } = useQuery<PublicLoreDetail>({
    queryKey: ["public-lore", id],
    queryFn: () => fetchJsonOrThrow(`/api/public/lore/${id}`),
    retry: false,
    enabled: Boolean(id),
  });

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 bg-card/30 px-5 py-4">
        <div className="mx-auto flex max-w-4xl items-center gap-3">
          <Scroll className="h-5 w-5 text-primary" />
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.18em] text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
            AllCodex
          </Link>
          <Button asChild size="sm" variant="outline" className="ml-auto gap-2 rounded-none">
            <Link href="/login">
              <Lock className="h-3.5 w-3.5" />
              Owner Login
            </Link>
          </Button>
        </div>
      </header>

      <article className="mx-auto max-w-4xl px-5 py-8">
        <Button asChild size="sm" variant="ghost" className="mb-5 gap-2 rounded-none">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : isError || !data ? (
          <div className="border border-border/40 bg-card/50 p-6 text-sm text-muted-foreground">
            Lore entry is not published.
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-muted-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>
                <BookOpen className="h-3.5 w-3.5" />
                {data.loreType ?? "lore"}
              </div>
              <h1 className="text-3xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
                {data.title}
              </h1>
            </div>
            <div
              className="prose prose-invert max-w-none border border-border/40 bg-card/40 p-5 font-[var(--font-crimson)] text-base leading-relaxed"
              dangerouslySetInnerHTML={{ __html: data.contentHtml }}
            />
          </div>
        )}
      </article>
    </main>
  );
}
