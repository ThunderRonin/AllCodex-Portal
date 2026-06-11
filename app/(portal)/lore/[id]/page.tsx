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
  History,
  GitCompareArrows,
  FileText,
  Code2,
  ChevronDown,
  ChevronRight,
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
import { use, useRef, useState, useMemo } from "react";
import { sanitizeLoreHtml } from "@/lib/sanitize";
import { parseThemeSongUrl } from "@/lib/theme-song";
import { cn } from "@/lib/utils";
import { computeLineDiff, htmlToPlain } from "@/components/portal/diff-helpers";

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
  isInShareTree?: boolean;
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

/**
 * Renders a portrait card for a lore note.
 *
 * Shows the note's portrait image when `note.portraitImageNoteId` is present; otherwise renders a placeholder using up to the first two initials of the note title and guidance about adding a `portraitImage` relation.
 *
 * @param note - The note whose portrait or placeholder should be displayed
 * @returns A card element containing the portrait image or placeholder and its caption
 */
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

/**
 * Render a theme song card for a note when a playable URL is available.
 *
 * Displays a small card showing the note title, provider label, an embedded player iframe sized for the provider, and an "Open on provider" link. If the note has no parseable theme song URL, nothing is rendered.
 *
 * @param note - The note whose `themeSongUrl` will be parsed and embedded
 * @returns The rendered card element when a theme song is available, `null` otherwise.
 */
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

/**
 * Renders a two-column detail row showing a label and its corresponding value.
 *
 * The left column displays `label` and the right column displays `value`. When
 * `emphasize` is true, the value receives accent, bold, and uppercase styling.
 *
 * @param label - The label text shown in the left column
 * @param value - The value text shown in the right column
 * @param emphasize - If true, visually emphasizes the value with accent and uppercase styling
 * @returns A JSX element representing the labeled detail row
 */
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

interface Revision {
  revisionId: string;
  noteId: string;
  type: string;
  title: string;
  dateCreated: string;
  utcDateCreated: string;
  contentLength?: number;
  description: string;
  revisionSource: string;
}

function RevisionDiffView({ noteId, revA, revB }: { noteId: string; revA: Revision; revB: Revision }) {
  const [diffMode, setDiffMode] = useState<"visual" | "raw">("visual");

  const { data: contentA, isError: isErrorA } = useQuery<string>({
    queryKey: ["revision-content", revA.revisionId],
    queryFn: () => fetch(`/api/lore/${noteId}/revisions/${revA.revisionId}/content`).then((r) => {
      if (!r.ok) throw new Error("fetch failed");
      return r.text();
    }),
  });

  const { data: contentB, isError: isErrorB } = useQuery<string>({
    queryKey: ["revision-content", revB.revisionId],
    queryFn: () => fetch(`/api/lore/${noteId}/revisions/${revB.revisionId}/content`).then((r) => {
      if (!r.ok) throw new Error("fetch failed");
      return r.text();
    }),
  });

  const diffLines = useMemo(() => {
    if (contentA === undefined || contentB === undefined) return [];
    const before = diffMode === "visual" ? htmlToPlain(contentA) : contentA;
    const after = diffMode === "visual" ? htmlToPlain(contentB) : contentB;
    return computeLineDiff(before, after);
  }, [contentA, contentB, diffMode]);

  let leftNo = 0;
  let rightNo = 0;

  if (isErrorA || isErrorB) {
    return (
      <div className="p-4 text-xs text-destructive">Failed to load revision content.</div>
    );
  }

  if (contentA === undefined || contentB === undefined) {
    return (
      <div className="p-4 text-xs text-muted-foreground">Loading revision content...</div>
    );
  }

  return (
    <div className="rounded-none border border-border/30 bg-card/40 overflow-hidden">
      <div className="px-4 py-2 border-b border-border/20 flex items-center justify-between bg-muted/5">
        <span className="text-xs text-muted-foreground">
          {revA.title} → {revB.title}
        </span>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant={diffMode === "visual" ? "secondary" : "ghost"}
            className="h-6 text-[10px] rounded-none gap-1"
            onClick={() => setDiffMode("visual")}
          >
            <FileText className="h-3 w-3" />
            Text
          </Button>
          <Button
            size="sm"
            variant={diffMode === "raw" ? "secondary" : "ghost"}
            className="h-6 text-[10px] rounded-none gap-1"
            onClick={() => setDiffMode("raw")}
          >
            <Code2 className="h-3 w-3" />
            HTML
          </Button>
        </div>
      </div>
      <div className="overflow-x-auto max-h-[300px] overflow-y-auto font-mono text-xs bg-muted/10 select-text">
        {diffLines.length === 0 ? (
          <div className="p-4 text-muted-foreground italic text-center">No changes.</div>
        ) : (
          <div className="min-w-[500px] divide-y divide-border/5">
            {diffLines.map((line, idx) => {
              let leftVal = "";
              let rightVal = "";
              let prefix = " ";
              let rowClass = "text-muted-foreground/80 hover:bg-muted/5";

              if (line.type === "added") {
                rightNo++;
                rightVal = rightNo.toString();
                prefix = "+";
                rowClass = "bg-emerald-950/20 text-emerald-400 hover:bg-emerald-950/30 border-l-2 border-l-emerald-500/80";
              } else if (line.type === "removed") {
                leftNo++;
                leftVal = leftNo.toString();
                prefix = "-";
                rowClass = "bg-rose-950/20 text-rose-400 hover:bg-rose-950/30 border-l-2 border-l-rose-500/80";
              } else {
                leftNo++;
                rightNo++;
                leftVal = leftNo.toString();
                rightVal = rightNo.toString();
              }

              return (
                <div key={idx} className={`flex items-start ${rowClass} py-0.5 leading-5`}>
                  <div className="text-muted-foreground/30 border-r border-border/15 select-none text-right pr-2 w-8 shrink-0 font-sans text-[10px]">{leftVal}</div>
                  <div className="text-muted-foreground/30 border-r border-border/15 select-none text-right pr-2 w-8 shrink-0 font-sans text-[10px]">{rightVal}</div>
                  <div className="w-5 select-none text-center font-bold text-[11px] font-mono shrink-0">{prefix}</div>
                  <div className="flex-1 whitespace-pre-wrap pl-2 break-all pr-4">{line.text || " "}</div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function RevisionHistory({ noteId }: { noteId: string }) {
  const [expanded, setExpanded] = useState(false);
  const [comparePair, setComparePair] = useState<[number, number] | null>(null);

  const { data: revisions = [], isLoading, isError } = useQuery<Revision[]>({
    queryKey: ["revisions", noteId],
    queryFn: async () => {
      const r = await fetch(`/api/lore/${noteId}/revisions`);
      if (!r.ok) throw new Error(`Failed to load revisions (${r.status})`);
      return r.json();
    },
    enabled: expanded,
    staleTime: 30_000,
  });

  if (!expanded) {
    return (
      <Card className="wiki-rail-card">
        <CardContent className="p-0">
          <button
            onClick={() => setExpanded(true)}
            className="w-full px-5 py-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <History className="h-4 w-4" />
            <span>Revision History</span>
            <ChevronRight className="h-3.5 w-3.5 ml-auto" />
          </button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="wiki-rail-card">
      <CardContent className="p-5 space-y-3">
        <button
          onClick={() => setExpanded(false)}
          className="w-full flex items-center gap-2 text-sm font-medium"
        >
          <History className="h-4 w-4" />
          <span className="wiki-rail-kicker">Revision History</span>
          <ChevronDown className="h-3.5 w-3.5 ml-auto text-muted-foreground" />
        </button>

        {isError ? (
          <p className="text-xs text-destructive">Failed to load revision history.</p>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </div>
        ) : revisions.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">No revisions recorded.</p>
        ) : (
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {revisions.map((rev, idx) => {
              const canCompare = idx < revisions.length - 1;
              const isComparing = comparePair?.[0] === idx;

              return (
                <div key={rev.revisionId}>
                  <div className="flex items-center gap-2 py-1.5 text-xs">
                    <span className="text-muted-foreground shrink-0 w-28">
                      {new Date(rev.dateCreated).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="truncate flex-1 text-foreground/80">{rev.title}</span>
                    {rev.revisionSource && rev.revisionSource !== "manual" && (
                      <Badge variant="outline" className="text-[9px] rounded-none shrink-0">
                        {rev.revisionSource.startsWith("brainDump") ? "brain dump" : rev.revisionSource}
                      </Badge>
                    )}
                    {canCompare && (
                      <Button
                        size="sm"
                        variant={isComparing ? "secondary" : "ghost"}
                        className="h-6 text-[10px] rounded-none gap-1 shrink-0"
                        onClick={() => setComparePair(isComparing ? null : [idx, idx + 1])}
                      >
                        <GitCompareArrows className="h-3 w-3" />
                        Diff
                      </Button>
                    )}
                  </div>
                  {isComparing && comparePair && (
                    <div className="mt-1 mb-3">
                      <RevisionDiffView
                        noteId={noteId}
                        revA={revisions[comparePair[1]]}
                        revB={revisions[comparePair[0]]}
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Render the lore detail page for a single note.
 *
 * Displays the note's metadata, main content (with GM/player preview modes), portrait, theme song embed (when present),
 * optional geo map view, grouped relations, related entries and backlinks, and a right-hand lore rail with detail fields and actions.
 *
 * @param params - A promise resolving to route parameters containing the `id` of the note to display.
 * @returns The React element tree for the lore detail view for the specified note id.
 */
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

              <RevisionHistory noteId={id} />

              <ShareSettings
                noteId={id}
                attributes={(note.attributes ?? []).filter((a) => a.type === "label")}
                isInShareTree={note.isInShareTree}
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
