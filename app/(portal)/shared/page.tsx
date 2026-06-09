"use client";

/**
 * /shared — Shared Content Browser
 * Lists all #lore notes with share status badges and quick controls.
 * Step 37 of Phase G.
 */

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Eye,
  EyeOff,
  FileText,
  Globe,
  Lock,
  Search,
  ExternalLink,
  Loader2,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ShareItem {
  noteId: string;
  title: string;
  loreType: string | null;
  isDraft: boolean;
  isGmOnly: boolean;
  shareAlias: string | null;
  isProtected: boolean;
  isInShareTree: boolean;
  isPublished: boolean;
  shareUrl: string | null;
  dateModified: string;
}

type FilterMode = "all" | "published" | "draft" | "gmOnly";

// ── Quick toggle helpers ──────────────────────────────────────────────────────

function QuickToggle({
  noteId,
  label,
  active,
  activeClass,
  icon: Icon,
  iconActive: IconActive,
  labelText,
  labelActiveText,
}: {
  noteId: string;
  label: "draft" | "gmOnly";
  active: boolean;
  activeClass: string;
  icon: React.ElementType;
  iconActive?: React.ElementType;
  labelText: string;
  labelActiveText: string;
}) {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  async function handleToggle() {
    setSaving(true);
    try {
      // Fetch fresh attributes to get attributeId
      const note = await fetch(`/api/lore/${noteId}`).then((r) => r.json());
      const existing = (note.attributes as Array<{ attributeId: string; name: string; type: string }>) 
        .find((a) => a.name === label && a.type === "label");

      if (existing) {
        await fetch(`/api/lore/${noteId}/attributes?attrId=${existing.attributeId}`, {
          method: "DELETE",
        });
      } else {
        await fetch(`/api/lore/${noteId}/attributes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "label", name: label, value: "" }),
        });
      }
      await qc.invalidateQueries({ queryKey: ["share-tree"] });
    } finally {
      setSaving(false);
    }
  }

  const DisplayIcon = active && IconActive ? IconActive : Icon;

  return (
    <Badge
      className={cn(
        "cursor-pointer gap-1 text-[10px] select-none transition-colors border",
        active ? activeClass : "bg-muted/20 text-muted-foreground border-border/30 hover:bg-muted/40"
      )}
      onClick={handleToggle}
    >
      {saving ? (
        <Loader2 className="h-2.5 w-2.5 animate-spin" />
      ) : (
        <DisplayIcon className="h-2.5 w-2.5" />
      )}
      {active ? labelActiveText : labelText}
    </Badge>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SharedPage() {
  const [filter, setFilter] = useState<FilterMode>("all");
  const [search, setSearch] = useState("");

  const { data: rawItems, isLoading } = useQuery<ShareItem[]>({
    queryKey: ["share-tree"],
    queryFn: () => fetch("/api/share/tree").then((r) => r.json()),
    staleTime: 30_000,
  });

  const portalUrl =
    process.env.NEXT_PUBLIC_PORTAL_URL ||
    (typeof window !== "undefined" ? window.location.origin : "");

  const items = rawItems?.map((item) => ({
    ...item,
    shareUrl: item.isInShareTree
      ? `${portalUrl}/public/lore/${item.shareAlias || item.noteId}`
      : null,
  }));

  const { data: shareRootData } = useQuery<{ url: string | null; configured: boolean }>({
    queryKey: ["share-root"],
    queryFn: () => fetch("/api/share").then((r) => r.json()),
    staleTime: 60_000,
  });

  const filtered = (items ?? []).filter((item) => {
    if (search && !item.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "published") return item.isPublished;
    if (filter === "draft") return item.isDraft;
    if (filter === "gmOnly") return item.isGmOnly;
    return true;
  });

  const publishedCount = (items ?? []).filter((i) => i.isPublished).length;
  const draftCount = (items ?? []).filter((i) => i.isDraft).length;
  const gmOnlyCount = (items ?? []).filter((i) => i.isGmOnly).length;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1
            className="text-3xl font-bold tracking-tight text-primary"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            Shared Content
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage share visibility for all lore entries.
          </p>
        </div>
        {shareRootData?.url && (
          <a
            href={shareRootData.url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0"
          >
            <Button variant="outline" size="sm" className="gap-2">
              <Globe className="h-4 w-4" />
              View Share Site
            </Button>
          </a>
        )}
      </div>

      <div className="grimoire-divider" />

      {/* Stats row */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Total", count: items?.length ?? 0, filter: "all" as FilterMode, active: filter === "all" },
          { label: "Published", count: publishedCount, filter: "published" as FilterMode, active: filter === "published" },
          { label: "Draft", count: draftCount, filter: "draft" as FilterMode, active: filter === "draft" },
          { label: "GM Only", count: gmOnlyCount, filter: "gmOnly" as FilterMode, active: filter === "gmOnly" },
        ].map(({ label, count, filter: f, active }) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-lg border p-3 text-left transition-all",
              active
                ? "border-primary/50 bg-primary/10"
                : "border-border/40 bg-card/60 hover:border-border/60 hover:bg-card/80"
            )}
          >
            <div className="text-xl font-bold text-primary">{count}</div>
            <div className="text-xs text-muted-foreground">{label}</div>
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search entries…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-8 text-sm"
          />
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <Card>
          <CardContent className="space-y-2 pt-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-border/40">
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {search || filter !== "all"
              ? "No entries match this filter."
              : "No lore entries found. Create some to get started."}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/40">
          <CardHeader className="pb-2 border-b border-border/30">
            <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {filtered.length} {filtered.length === 1 ? "entry" : "entries"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {filtered.map((item) => (
              <div
                key={item.noteId}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-border/20 last:border-0 hover:bg-muted/10 transition-colors group"
              >
                {/* Title + type */}
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/lore/${item.noteId}`}
                    className="text-sm font-medium hover:text-primary transition-colors truncate block"
                  >
                    {item.title}
                  </Link>
                  {item.loreType && (
                    <span className="text-[10px] text-muted-foreground capitalize">
                      {item.loreType}
                    </span>
                  )}
                </div>

                {/* Status badges — clickable quick-toggles */}
                <div className="flex items-center gap-1.5 shrink-0">
                  <QuickToggle
                    noteId={item.noteId}
                    label="draft"
                    active={item.isDraft}
                    activeClass="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30"
                    icon={FileText}
                    labelText="Published"
                    labelActiveText="Draft"
                  />
                  <QuickToggle
                    noteId={item.noteId}
                    label="gmOnly"
                    active={item.isGmOnly}
                    activeClass="bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30"
                    icon={Eye}
                    iconActive={EyeOff}
                    labelText="Visible"
                    labelActiveText="GM Only"
                  />
                  {item.isProtected && (
                    <Badge className="gap-1 text-[10px] bg-blue-500/20 text-blue-400 border-blue-500/30 border">
                      <Lock className="h-2.5 w-2.5" />
                      Protected
                    </Badge>
                  )}
                  {!item.isInShareTree && (
                    <Badge className="gap-1 text-[10px] bg-muted/20 text-muted-foreground border-border/30 border">
                      Not Shared
                    </Badge>
                  )}
                  {item.shareAlias && (
                    <Badge variant="outline" className="text-[10px] font-mono text-muted-foreground">
                      {item.shareAlias}
                    </Badge>
                  )}
                </div>

                {/* External link */}
                {item.shareUrl && (
                  <a
                    href={item.shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-primary"
                    title="Open share URL"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}

                {/* Edit link */}
                <Link
                  href={`/lore/${item.noteId}`}
                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                    View
                  </Button>
                </Link>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
