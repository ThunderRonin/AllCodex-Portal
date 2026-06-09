"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Lock, Scroll, Music, Calendar } from "lucide-react";
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
  portraitImageNoteId?: string;
  themeSongUrl?: string;
  attributes: Array<{ name: string; value: string; rawKey: string }>;
}

function getSpotifyEmbedUrl(url: string): string | null {
  if (!url) return null;
  const cleanUrl = url.trim();
  
  if (cleanUrl.startsWith("spotify:")) {
    const parts = cleanUrl.split(":");
    if (parts.length >= 3) {
      return `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`;
    }
  }
  
  try {
    const regex = /open\.spotify\.com\/(track|playlist|album|artist)\/([a-zA-Z0-9]+)/i;
    const match = cleanUrl.match(regex);
    if (match) {
      return `https://open.spotify.com/embed/${match[1]}/${match[2]}`;
    }
  } catch (e) {
    // ignore
  }
  
  return null;
}

const formatDate = (dateStr: string) => {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
};

export default function PublicLoreDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const { data, isLoading, isError } = useQuery<PublicLoreDetail>({
    queryKey: ["public-lore", id],
    queryFn: () => fetchJsonOrThrow(`/api/public/lore/${id}`),
    retry: false,
    enabled: Boolean(id),
  });

  const spotifyEmbedUrl = data?.themeSongUrl ? getSpotifyEmbedUrl(data.themeSongUrl) : null;

  return (
    <main className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-neutral-900 via-neutral-950 to-black text-foreground antialiased">
      <header className="border-b border-primary/10 bg-black/40 backdrop-blur-md px-5 py-4 sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <Scroll className="h-5 w-5 text-primary animate-pulse" />
          <Link href="/" className="text-sm font-bold uppercase tracking-[0.25em] text-primary hover:text-primary-foreground transition-all duration-300" style={{ fontFamily: "var(--font-cinzel)" }}>
            AllCodex
          </Link>
          <span className="text-[10px] text-primary/40 uppercase tracking-[0.15em] border border-primary/20 px-2 py-0.5 rounded-sm" style={{ fontFamily: "var(--font-cinzel)" }}>
            Chronicle
          </span>
          <Button asChild size="sm" variant="outline" className="ml-auto gap-2 rounded-none border-primary/30 hover:border-primary hover:bg-primary/10 text-primary hover:text-primary transition-all duration-300">
            <Link href="/login">
              <Lock className="h-3.5 w-3.5" />
              Owner Login
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-5 py-8">
        <Button asChild size="sm" variant="ghost" className="mb-6 gap-2 rounded-none text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all duration-300">
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            Back to Chronicle
          </Link>
        </Button>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="md:col-span-3 space-y-6">
              <Skeleton className="h-4 w-24 bg-neutral-800" />
              <Skeleton className="h-12 w-2/3 bg-neutral-800" />
              <Skeleton className="h-[400px] w-full bg-neutral-800" />
            </div>
            <div className="md:col-span-1">
              <Skeleton className="h-[450px] w-full bg-neutral-800" />
            </div>
          </div>
        ) : isError || !data ? (
          <div className="border border-red-900/40 bg-red-950/10 p-6 text-sm text-red-400 max-w-xl mx-auto text-center rounded-none shadow-[0_0_15px_rgba(127,29,29,0.1)]">
            <p className="font-semibold" style={{ fontFamily: "var(--font-cinzel)" }}>Lore entry is not available</p>
            <p className="text-xs text-red-500/70 mt-1">This record might be marked as draft, GM-only, or password protected.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
            {/* Main Content Column */}
            <article className="md:col-span-3 space-y-6">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-primary/80" style={{ fontFamily: "var(--font-cinzel)" }}>
                  <BookOpen className="h-3.5 w-3.5 text-primary/65" />
                  {data.loreType ?? "lore entry"}
                </div>
                <h1 className="text-4xl md:text-5xl font-bold text-primary tracking-wide leading-tight shadow-sm" style={{ fontFamily: "var(--font-cinzel)" }}>
                  {data.title}
                </h1>
                {data.dateModified && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/60" />
                    <span>Last updated: {formatDate(data.dateModified)}</span>
                  </div>
                )}
              </div>
              
              <div className="h-px bg-gradient-to-r from-primary/30 via-primary/5 to-transparent w-full" />

              <div
                className="lore-content prose prose-invert max-w-none font-[var(--font-crimson)] text-lg md:text-xl leading-relaxed text-neutral-300"
                dangerouslySetInnerHTML={{ __html: data.contentHtml }}
              />
            </article>

            {/* Infobox Column */}
            <aside className="md:col-span-1">
              <div className="bg-neutral-900/40 backdrop-blur-md border border-primary/20 rounded-lg p-5 shadow-[0_4px_20px_rgba(0,0,0,0.4)] hover:shadow-[0_4px_30px_rgba(212,175,55,0.05)] transition-all duration-500 space-y-5">
                <div className="text-center pb-3 border-b border-primary/10">
                  <h3 className="text-lg font-bold text-primary tracking-wider uppercase" style={{ fontFamily: "var(--font-cinzel)" }}>
                    {data.title}
                  </h3>
                  {data.loreType && (
                    <span className="text-[10px] text-muted-foreground uppercase tracking-[0.2em] font-sans">
                      {data.loreType}
                    </span>
                  )}
                </div>

                {data.portraitImageNoteId && (
                  <div className="relative group max-w-[200px] mx-auto">
                    <div className="border border-primary/45 bg-black/60 p-1.5 rounded-sm shadow-[0_0_15px_rgba(212,175,55,0.15)] transition-all duration-500 group-hover:border-primary group-hover:shadow-[0_0_25px_rgba(212,175,55,0.25)]">
                      <div className="aspect-[3/4] relative overflow-hidden bg-neutral-950 flex items-center justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`/api/public/images/${data.portraitImageNoteId}/portrait.png`}
                          alt={`${data.title} Portrait`}
                          className="object-cover w-full h-full transform transition-transform duration-500 group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {data.attributes && data.attributes.length > 0 && (
                  <div className="space-y-3 font-sans">
                    <div className="text-[10px] text-primary/60 uppercase tracking-[0.18em] font-semibold" style={{ fontFamily: "var(--font-cinzel)" }}>
                      Details
                    </div>
                    <div className="divide-y divide-primary/5">
                      {data.attributes.map((attr, idx) => (
                        <div key={idx} className="py-2 flex justify-between gap-4 text-xs">
                          <span className="text-primary/70 font-medium uppercase tracking-wider w-5/12">
                            {attr.name}
                          </span>
                          <span className="text-neutral-300 text-right w-7/12 truncate" title={attr.value}>
                            {attr.value}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {spotifyEmbedUrl && (
                  <div className="pt-4 border-t border-primary/10 space-y-2.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-primary/60 uppercase tracking-[0.18em] font-semibold" style={{ fontFamily: "var(--font-cinzel)" }}>
                      <Music className="h-3 w-3 text-primary/80" />
                      <span>Theme Song</span>
                    </div>
                    <iframe
                      src={spotifyEmbedUrl}
                      width="100%"
                      height="80"
                      frameBorder="0"
                      allowFullScreen={false}
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded border border-primary/15 bg-black/60 shadow-sm"
                    />
                  </div>
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
