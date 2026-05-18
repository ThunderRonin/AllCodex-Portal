"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import {
  ArrowLeft,
  Edit2,
  Eye,
  Tag,
  Link2,
  Calendar,
  Clock,
  Network,
  ArrowLeftRight,
  AlertTriangle,
  Sparkles,
  ScrollText,
  Shield,
  BookOpen,
  Map,
} from "lucide-react";
import { RelationshipGraph } from "@/components/portal/RelationshipGraph";
import { MapSection } from "@/components/portal/MapSection";
import { Breadcrumbs } from "@/components/portal/Breadcrumbs";
import { TableOfContents } from "@/components/portal/TableOfContents";
import { NotePreviewLink } from "@/components/portal/NotePreview";
import { ShareSettings } from "@/components/portal/ShareSettings";
import { CopilotTrigger } from "@/components/portal/CopilotTrigger";
import { PreviewToggle, type PreviewMode } from "@/components/portal/PreviewToggle";
import Link from "next/link";
import Image from "next/image";
import { use, useRef, useState } from "react";
import { sanitizeLoreHtml } from "@/lib/sanitize";
import { parseThemeSongUrl } from "@/lib/theme-song";
import { cn } from "@/lib/utils";

interface Attribute {
  attributeId: string;
  name: string;
  type: "label" | "relation";
  value: string;
}

interface ResolvedRelation {
  name: string;
  targetNoteId: string;
  targetTitle: string;
  loreType: string | null;
}

interface Note {
  noteId: string;
  title: string;
  type: string;
  dateCreated: string;
  dateModified: string;
  attributes: Attribute[];
  portraitImageNoteId: string | null;
  themeSongUrl: string | null;
  resolvedRelations: ResolvedRelation[];
}

const HIDDEN_LABELS = [
  "template", "iconClass", "cssClass", "loreType", "lore", "pageTemplate", "bookTheme",
  "draft", "gmOnly", "shareAlias", "shareCredentials", "shareRoot", "themeSongUrl",
];

const RELATION_LABELS: Record<string, string> = {
  ally: "Allied With",
  relAlly: "Allied With",
  enemy: "Opposes",
  relEnemy: "Opposes",
  family: "Family",
  relFamily: "Family",
  location: "Linked Places",
  relLocation: "Linked Places",
  event: "Linked Events",
  relEvent: "Linked Events",
  faction: "Serves",
  relFaction: "Serves",
  other: "Related Entries",
  relOther: "Related Entries",
  serves: "Serves",
  worships: "Reveres",
  member_of: "Member Of",
  leader_of: "Leads",
  located_in: "Located In",
  originates_from: "Originates From",
  participated_in: "Involved In",
};

function toDisplayName(value: string): string {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^rel/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim();
}

function relationLabel(name: string): string {
  return RELATION_LABELS[name] ?? toDisplayName(name);
}

function relationTone(name: string): string {
  const normalized = name.toLowerCase();
  if (normalized.includes("enemy") || normalized.includes("hate")) return "rose";
  if (normalized.includes("ally") || normalized.includes("family")) return "emerald";
  if (normalized.includes("serv") || normalized.includes("lead")) return "amber";
  if (normalized.includes("location") || normalized.includes("origin")) return "cyan";
  return "violet";
}

function PortraitCard({ note }: { note: Note }) {
  if (note.portraitImageNoteId) {
    return (
      <Card className="wiki-rail-card overflow-hidden">
        <div className="wiki-portrait-frame">
          <Image
            src={`/api/lore/${note.portraitImageNoteId}/image`}
            alt={`${note.title} portrait`}
            fill
            sizes="320px"
            unoptimized
            className="object-cover"
          />
        </div>
        <CardContent className="p-4">
          <p className="wiki-rail-kicker">Portrait</p>
          <p className="font-semibold text-sm text-foreground/90">{note.title}</p>
        </CardContent>
      </Card>
    );
  }

  const initials = note.title
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
      <CardContent className="p-4 space-y-1">
        <p className="wiki-rail-kicker">Portrait Slot</p>
        <p className="text-sm text-muted-foreground">
          Add a `portraitImage` relation to an image note to populate this panel.
        </p>
      </CardContent>
    </Card>
  );
}

function ThemeSongCard({ note }: { note: Note }) {
  const themeSong = parseThemeSongUrl(note.themeSongUrl);

  if (!themeSong) {
    return null;
  }

  const providerLabel = themeSong.provider === "appleMusic" ? "Apple Music" : themeSong.provider;

  return (
    <Card className="wiki-rail-card overflow-hidden">
      <CardContent className="p-5 space-y-3">
        <div className="space-y-1">
          <p className="wiki-rail-kicker">Theme Song</p>
          <p className="text-sm font-semibold text-foreground/90">{note.title}</p>
          <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{providerLabel}</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-border/60 bg-muted/20">
          <iframe
            title={`${note.title} theme song`}
            src={themeSong.embedUrl}
            width="100%"
            height={themeSong.height}
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            className="block w-full border-0"
          />
        </div>

        <a
          href={themeSong.externalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex text-xs uppercase tracking-[0.25em] text-accent transition-colors hover:text-accent/80"
        >
          Open on provider
        </a>
      </CardContent>
    </Card>
  );
}

function DetailField({ label, value, emphasize = false }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-3 border-b border-border/25 py-2 last:border-0">
      <span className="wiki-detail-label">{label}</span>
      <span className={cn("text-sm break-words", emphasize && "text-accent font-semibold uppercase tracking-wide")}>{value}</span>
    </div>
  );
}

function RelationGroup({ label, items }: { label: string; items: ResolvedRelation[] }) {
  return (
    <div className="space-y-2">
      <p className="wiki-rail-kicker">{label}</p>
      <div className="flex flex-wrap gap-2">
        {items.map((relation) => (
          <NotePreviewLink key={`${relation.name}-${relation.targetNoteId}`} noteId={relation.targetNoteId}>
            <span className={cn("wiki-relation-chip", `wiki-relation-chip--${relationTone(relation.name)}`)}>
              {relation.targetTitle}
            </span>
          </NotePreviewLink>
        ))}
      </div>
    </div>
  );
}

function RelatedEntryCard({ entry }: { entry: { noteId: string; title: string; loreType: string | null } }) {
  return (
    <NotePreviewLink noteId={entry.noteId}>
      <div className="wiki-related-card">
        <span className="wiki-related-kicker">{entry.loreType ?? "entry"}</span>
        <p className="wiki-related-title">{entry.title}</p>
        <div className="wiki-related-underline" />
      </div>
    </NotePreviewLink>
  );
}

export default function LoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const contentRef = useRef<HTMLDivElement>(null);
  const [previewMode, setPreviewMode] = useState<PreviewMode>("gm");

  const { data: note, isLoading: noteLoading } = useQuery<Note>({
    queryKey: ["note", id],
    queryFn: async () => {
      const response = await fetch(`/api/lore/${id}`);
      if (!response.ok) {
        throw new Error(`Failed to load note ${id}`);
      }
      return response.json();
    },
  });

  const { data: content, isLoading: contentLoading } = useQuery<string>({
    queryKey: ["note-content", id, previewMode],
    queryFn: () =>
      previewMode === "player"
        ? fetch(`/api/lore/${id}/preview?mode=player`).then((r) => r.text())
        : fetch(`/api/lore/${id}/content`).then((r) => r.text()),
    enabled: !!note,
  });

  const allLabels = note?.attributes?.filter(
    (a) => 
      a.type === "label" && 
      !HIDDEN_LABELS.includes(a.name) && 
      !a.name.startsWith("Label:") && 
      !a.name.startsWith("Relation:") &&
      !(a.value && (a.value.includes("promoted") || a.value.includes("alias=")))
  ) ?? [];

  const details = allLabels.filter(a => a.value && a.value.trim() !== "");
  const tags = allLabels.filter(a => !a.value || a.value.trim() === "");

  const loreType = note?.attributes?.find((a) => a.name === "loreType")?.value ?? "lore";
  const isGmOnly = note?.attributes?.some((a) => a.type === "label" && a.name === "gmOnly") ?? false;
  const isDraft = note?.attributes?.some((a) => a.type === "label" && a.name === "draft") ?? false;
  const isGeoMap = note?.attributes?.some((a) => a.name === "viewType" && a.value === "geoMap") ?? false;
  const groupedRelations = (note?.resolvedRelations ?? []).reduce<Record<string, ResolvedRelation[]>>((groups, relation) => {
    const label = relationLabel(relation.name);
    if (!groups[label]) groups[label] = [];
    groups[label].push(relation);
    return groups;
  }, {});

  const { data: backlinks = [] } = useQuery<
    Array<{ noteId: string; title: string; loreType: string | null }>
  >({
    queryKey: ["backlinks", id],
    queryFn: async () => {
      const r = await fetch(`/api/lore/${id}/backlinks`);
      if (!r.ok) return [];
      return r.json();
    },
    staleTime: 60_000,
  });

  const relatedEntries = [
    ...(note?.resolvedRelations ?? []).map((relation) => ({
      noteId: relation.targetNoteId,
      title: relation.targetTitle,
      loreType: relation.loreType,
    })),
    ...backlinks,
  ].filter((entry, index, array) => array.findIndex((candidate) => candidate.noteId === entry.noteId) === index).slice(0, 6);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <Breadcrumbs noteId={id} />

      <div className="flex flex-wrap items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground hover:text-foreground">
          <Link href="/lore">
            <ArrowLeft className="h-4 w-4" />
            Lore
          </Link>
        </Button>
        <span className="text-muted-foreground/30">/</span>
        <div className="ml-auto flex items-center gap-2">
          <PreviewToggle mode={previewMode} onChange={setPreviewMode} />
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/lore/${id}/edit`}>
              <Edit2 className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {noteLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-20 w-80" />
        </div>
      ) : (
        <header className="wiki-hero">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="outline" className="wiki-lore-badge capitalize">
                <BookOpen className="h-3 w-3" />
                {loreType}
              </Badge>
              {isDraft && (
                <Badge variant="outline" className="wiki-state-badge wiki-state-badge--draft">
                  Draft
                </Badge>
              )}
            </div>
            <h1 className="wiki-page-title">{note?.title}</h1>
            <div className="wiki-title-rule" />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground/90">
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Created {new Date(note?.dateCreated ?? "").toLocaleDateString()}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Modified {new Date(note?.dateModified ?? "").toLocaleDateString()}
            </span>
            {previewMode === "player" && (
              <span className="inline-flex items-center gap-1.5 text-accent">
                <Eye className="h-3.5 w-3.5" />
                Player-safe preview
              </span>
            )}
          </div>
        </header>
      )}

      {isGmOnly && previewMode === "gm" && (
        <div className="wiki-warning-banner">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>This entry contains GM-only content. Spoilers ahead.</span>
        </div>
      )}

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-8">
          {isGeoMap && (
            <section className="space-y-3">
              <div className="wiki-section-header">
                <Map className="h-4 w-4" />
                <h2 className="wiki-section-title">Map</h2>
              </div>
              <MapSection noteId={id} />
            </section>
          )}

          <Card className="wiki-panel">
            <CardContent className="p-6 sm:p-8 space-y-8">
              <TableOfContents contentRef={contentRef} />

              {contentLoading ? (
                <div className="space-y-3">
                  {Array.from({ length: 7 }).map((_, index) => (
                    <Skeleton key={index} className={cn("h-4", index % 3 === 0 ? "w-4/5" : "w-full")} />
                  ))}
                </div>
              ) : content ? (
                <div
                  ref={contentRef}
                  className="lore-content wiki-article"
                  dangerouslySetInnerHTML={{ __html: sanitizeLoreHtml(content) }}
                />
              ) : previewMode === "player" ? (
                <p className="text-sm text-muted-foreground italic">
                  This note has no player-visible content.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground italic">
                  This entry has no body text yet.
                </p>
              )}
            </CardContent>
          </Card>

          {relatedEntries.length > 0 && (
            <section className="space-y-5">
              <div className="wiki-section-header">
                <ScrollText className="h-4 w-4" />
                <h2 className="wiki-section-title">Related Entries</h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {relatedEntries.map((entry) => (
                  <RelatedEntryCard key={entry.noteId} entry={entry} />
                ))}
              </div>
            </section>
          )}
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          {noteLoading || !note ? (
            <div className="space-y-4">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <PortraitCard note={note} />
              <ThemeSongCard note={note} />

              <Card className="wiki-rail-card">
                <CardContent className="p-5 space-y-4">
                  <div className="space-y-1">
                    <p className="wiki-rail-kicker">{toDisplayName(loreType)} Details</p>
                    <div className="space-y-0.5">
                      <DetailField label="Title" value={note.title} />
                      <DetailField label="Type" value={toDisplayName(loreType)} />
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

              <div className="grid gap-3">
                <CopilotTrigger noteId={id} />
                <Button asChild className="w-full gap-2">
                  <Link href={`/lore/${id}/edit`}>
                    <Edit2 className="h-4 w-4" />
                    Edit Entry
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full gap-2 border-accent/40 text-accent hover:bg-accent/10">
                  <Link href={`/ai/relationships?noteId=${id}`}>
                    <Sparkles className="h-4 w-4" />
                    View AI Suggestions
                  </Link>
                </Button>
              </div>

              {backlinks.length > 0 && (
                <Card className="wiki-rail-card">
                  <CardContent className="p-5 space-y-3">
                    <p className="wiki-rail-kicker">Referenced By</p>
                    <div className="space-y-2">
                      {backlinks.slice(0, 5).map((entry) => (
                        <RelatedEntryCard key={entry.noteId} entry={entry} />
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <RelationshipGraph noteId={id} noteTitle={note.title} />

              <ShareSettings
                noteId={id}
                attributes={(note.attributes ?? []).filter((a) => a.type === "label")}
              />

              <div className="wiki-side-note">
                <Shield className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                <p>
                  The redesigned lore rail is driven by existing ETAPI labels and relations. Use a `portraitImage` relation to attach a dedicated portrait.
                </p>
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
