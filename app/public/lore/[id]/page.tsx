"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BookOpen, Lock, Scroll, Music, Calendar } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { fetchJsonOrThrow } from "@/lib/fetch-json";

interface ResolvedRelation {
  name: string;
  targetNoteId: string;
  targetTitle: string;
  loreType: string | null;
}

interface PublicLoreDetail {
  noteId: string;
  title: string;
  loreType: string | null;
  contentHtml: string;
  dateModified: string;
  portraitImageNoteId?: string;
  themeSongUrl?: string;
  attributes: Array<{ name: string; value: string }>;
  resolvedRelations?: ResolvedRelation[];
}

function toDisplayName(value: string | null): string {
  if (!value) return "";
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^rel/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

const HIDDEN_LABELS = [
  "template", "iconClass", "cssClass", "loreType", "lore", "pageTemplate", "bookTheme",
  "draft", "gmOnly", "shareAlias", "shareCredentials", "shareRoot", "themeSongUrl",
];

function relationTone(name: string): "violet" | "emerald" | "rose" | "amber" | "blue" | "default" {
  const n = name.toLowerCase();
  if (n.includes("enemy") || n.includes("rival") || n.includes("threat")) return "rose";
  if (n.includes("ally") || n.includes("friend") || n.includes("member")) return "emerald";
  if (n.includes("leader") || n.includes("ruler") || n.includes("parent")) return "amber";
  if (n.includes("location") || n.includes("region") || n.includes("origin")) return "blue";
  return "violet";
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

function DetailField({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-border/10 last:border-0 text-xs">
      <span className="wiki-detail-label text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</span>
      <span className={cn("text-foreground/90 font-medium text-right max-w-[60%] break-words", emphasize && "text-amber-400 font-bold")}>
        {value}
      </span>
    </div>
  );
}

function PortraitCard({ title, portraitImageNoteId }: { title: string; portraitImageNoteId?: string }) {
  if (portraitImageNoteId) {
    return (
      <Card className="wiki-rail-card overflow-hidden">
        <div className="wiki-portrait-frame relative aspect-[4/5] overflow-hidden border-b border-border/45">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/public/images/${portraitImageNoteId}/portrait.png`}
            alt={`${title} portrait`}
            className="object-cover w-full h-full"
            loading="lazy"
          />
        </div>
        <CardContent className="p-4">
          <p className="wiki-rail-kicker">Portrait</p>
          <p className="font-semibold text-sm text-foreground/90">{title}</p>
        </CardContent>
      </Card>
    );
  }

  const initials = title
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return (
    <Card className="wiki-rail-card overflow-hidden">
      <div className="wiki-portrait-frame wiki-portrait-placeholder">
        <div className="wiki-portrait-rune">{initials || "AC"}</div>
      </div>
      <CardContent className="p-4">
        <p className="wiki-rail-kicker">Portrait Slot</p>
        <p className="text-xs text-muted-foreground">No portrait has been attached to this entry.</p>
      </CardContent>
    </Card>
  );
}

function ThemeSongCard({ spotifyEmbedUrl }: { spotifyEmbedUrl: string | null }) {
  if (!spotifyEmbedUrl) return null;
  return (
    <Card className="wiki-rail-card overflow-hidden">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-1.5">
          <Music className="h-3.5 w-3.5 text-primary/80" />
          <p className="wiki-rail-kicker">Theme Song</p>
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
      </CardContent>
    </Card>
  );
}

function RelationGroup({ label, items }: { label: string; items: ResolvedRelation[] }) {
  return (
    <div className="space-y-2">
      <p className="wiki-rail-kicker">{toDisplayName(label)}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((rel) => (
          <Link
            key={rel.targetNoteId}
            href={`/public/lore/${rel.targetNoteId}`}
            className={cn("wiki-relation-chip", `wiki-relation-chip--${relationTone(rel.name)}`)}
          >
            {rel.targetTitle}
          </Link>
        ))}
      </div>
    </div>
  );
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

  const spotifyEmbedUrl = data?.themeSongUrl ? getSpotifyEmbedUrl(data.themeSongUrl) : null;

  const allLabels = data?.attributes?.filter(
    (a) => 
      !HIDDEN_LABELS.includes(a.name) && 
      !a.name.startsWith("Label:") && 
      !a.name.startsWith("Relation:") &&
      !(a.value && (a.value.includes("promoted") || a.value.includes("alias=")))
  ) ?? [];

  const details = allLabels.filter(a => a.value && a.value.trim() !== "");
  const tags = allLabels.filter(a => !a.value || a.value.trim() === "");

  // Group relations by name
  const groupedRelations: Record<string, ResolvedRelation[]> = {};
  (data?.resolvedRelations ?? []).forEach((rel) => {
    if (!groupedRelations[rel.name]) {
      groupedRelations[rel.name] = [];
    }
    groupedRelations[rel.name].push(rel);
  });

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
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8">
            <div className="space-y-6">
              <Skeleton className="h-[100px] w-full bg-neutral-800" />
              <Skeleton className="h-[400px] w-full bg-neutral-800" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-64 w-full bg-neutral-800" />
              <Skeleton className="h-40 w-full bg-neutral-800" />
            </div>
          </div>
        ) : isError || !data ? (
          <div className="border border-red-900/40 bg-red-950/10 p-6 text-sm text-red-400 max-w-xl mx-auto text-center rounded-none shadow-[0_0_15px_rgba(127,29,29,0.15)]">
            <p className="font-semibold" style={{ fontFamily: "var(--font-cinzel)" }}>Lore entry is not available</p>
            <p className="text-xs text-red-500/70 mt-1">This record might be marked as draft, GM-only, or password protected.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-8 items-start">
            {/* Main Content Column */}
            <div className="space-y-6">
              <header className="wiki-hero">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <Badge variant="outline" className="wiki-lore-badge capitalize flex items-center gap-1.5 border-primary/35 bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[10px]">
                      <BookOpen className="h-3 w-3" />
                      {data.loreType ?? "lore entry"}
                    </Badge>
                  </div>
                  <h1 className="wiki-page-title">{data.title}</h1>
                  <div className="wiki-title-rule" />
                </div>
                {data.dateModified && (
                  <div className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground/80">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground/50" />
                    <span>Last updated: {formatDate(data.dateModified)}</span>
                  </div>
                )}
              </header>

              <Card className="wiki-panel">
                <CardContent className="p-6 sm:p-8">
                  <div
                    className="lore-content wiki-article prose prose-invert max-w-none font-[var(--font-crimson)] text-lg md:text-xl leading-relaxed text-neutral-300"
                    dangerouslySetInnerHTML={{ __html: data.contentHtml }}
                  />
                </CardContent>
              </Card>
            </div>

            {/* Infobox Column */}
            <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
              <PortraitCard title={data.title} portraitImageNoteId={data.portraitImageNoteId} />
              <ThemeSongCard spotifyEmbedUrl={spotifyEmbedUrl} />

              <Card className="wiki-rail-card">
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1">
                    <p className="wiki-rail-kicker">{toDisplayName(data.loreType)} Details</p>
                    <div className="space-y-0.5">
                      <DetailField label="Title" value={data.title} />
                      <DetailField label="Type" value={toDisplayName(data.loreType)} />
                      {details.slice(0, 6).map((attr) => (
                        <DetailField
                          key={`${attr.name}-${attr.value}`}
                          label={toDisplayName(attr.name)}
                          value={attr.value}
                          emphasize={attr.name === "status"}
                        />
                      ))}
                    </div>
                  </div>

                  {tags.length > 0 && (
                    <div className="space-y-2">
                      <p className="wiki-rail-kicker">Tags</p>
                      <div className="flex flex-wrap gap-2">
                        {tags.map((attr) => (
                          <span key={attr.name} className="wiki-relation-chip wiki-relation-chip--violet">
                            {toDisplayName(attr.name)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {Object.entries(groupedRelations).length > 0 && (
                <Card className="wiki-rail-card">
                  <CardContent className="p-5 space-y-4">
                    {Object.entries(groupedRelations).map(([label, items]) => (
                      <RelationGroup key={label} label={label} items={items} />
                    ))}
                  </CardContent>
                </Card>
              )}
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
