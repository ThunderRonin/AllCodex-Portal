"use client";

import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  Edit2,
  ExternalLink,
  Tag,
  Link2,
  Calendar,
  Clock,
  Network,
} from "lucide-react";
import Link from "next/link";
import { use } from "react";

interface Attribute {
  name: string;
  type: "label" | "relation";
  value: string;
}

interface Note {
  noteId: string;
  title: string;
  type: string;
  dateCreated: string;
  dateModified: string;
  attributes: Attribute[];
}

function AttributeRow({ attr }: { attr: Attribute }) {
  const isRelation = attr.type === "relation";
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground/70 w-28 shrink-0 capitalize pt-0.5">
        {attr.name.replace(/_/g, " ")}
      </span>
      <div className="flex-1 min-w-0">
        {isRelation ? (
          <Link
            href={`/lore/${attr.value}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Link2 className="h-3 w-3" />
            {attr.value}
          </Link>
        ) : (
          <span className="text-xs font-medium break-words">{attr.value}</span>
        )}
      </div>
      <Tooltip>
        <TooltipTrigger>
          {isRelation ? (
            <Link2 className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          ) : (
            <Tag className="h-3 w-3 text-muted-foreground/40 shrink-0" />
          )}
        </TooltipTrigger>
        <TooltipContent>
          {isRelation ? "Relation" : "Label"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

export default function LoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: note, isLoading: noteLoading } = useQuery<Note>({
    queryKey: ["note", id],
    queryFn: () => fetch(`/api/lore/${id}`).then((r) => r.json()),
  });

  const { data: content, isLoading: contentLoading } = useQuery<string>({
    queryKey: ["note-content", id],
    queryFn: () =>
      fetch(`/api/lore/${id}/content`).then((r) => r.text()),
    enabled: !!note,
  });

  const labels = note?.attributes?.filter((a) => a.type === "label" && !["template"].includes(a.name)) ?? [];
  const relations = note?.attributes?.filter((a) => a.type === "relation" && a.name !== "template") ?? [];
  const loreType = note?.attributes?.find((a) => a.name === "loreType")?.value ?? "lore";

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
          <Link href="/lore">
            <ArrowLeft className="h-4 w-4" />
            Lore
          </Link>
        </Button>
        <span className="text-muted-foreground/30">/</span>
        {noteLoading ? (
          <Skeleton className="h-5 w-40" />
        ) : (
          <span className="text-sm truncate">{note?.title}</span>
        )}
        <div className="ml-auto flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button asChild variant="ghost" size="icon" className="h-8 w-8">
                <a
                  href={`${process.env.NEXT_PUBLIC_ALLCODEX_URL ?? "http://localhost:8080"}/#${id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            </TooltipTrigger>
            <TooltipContent>Open in AllCodex</TooltipContent>
          </Tooltip>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/lore/${id}/edit`}>
              <Edit2 className="h-4 w-4" />
              Edit
            </Link>
          </Button>
        </div>
      </div>

      {/* Title */}
      {noteLoading ? (
        <Skeleton className="h-10 w-72" />
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1
              className="text-3xl font-bold text-primary"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              {note?.title}
            </h1>
            <Badge variant="outline" className="capitalize">
              {loreType}
            </Badge>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              Created {new Date(note?.dateCreated ?? "").toLocaleDateString()}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Modified {new Date(note?.dateModified ?? "").toLocaleDateString()}
            </span>
          </div>
        </div>
      )}

      <div className="grimoire-divider" />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2">
          {contentLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className={`h-4 ${i % 3 === 2 ? "w-2/3" : "w-full"}`} />
              ))}
            </div>
          ) : content ? (
            <div
              className="lore-content"
              dangerouslySetInnerHTML={{ __html: content }}
            />
          ) : (
            <p className="text-sm text-muted-foreground italic">
              This entry has no body text yet.
            </p>
          )}
        </div>

        {/* Info box sidebar — World Anvil style */}
        <div className="space-y-4">
          {/* Labels / Promoted Attributes */}
          {labels.length > 0 && (
            <Card className="border-primary/20 bg-card/60">
              <CardHeader className="pb-2 border-b border-border/30">
                <CardTitle
                  className="text-xs font-semibold uppercase tracking-wider text-primary"
                  style={{ fontFamily: "var(--font-cinzel)" }}
                >
                  Details
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {labels.map((attr) => (
                  <AttributeRow key={`${attr.name}-${attr.value}`} attr={attr} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Relations */}
          {relations.length > 0 && (
            <Card className="border-accent/30 bg-card/60">
              <CardHeader className="pb-2 border-b border-border/30">
                <CardTitle
                  className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5"
                  style={{ fontFamily: "var(--font-cinzel)" }}
                >
                  <Network className="h-3.5 w-3.5" />
                  Connections
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                {relations.map((attr) => (
                  <AttributeRow key={`${attr.name}-${attr.value}`} attr={attr} />
                ))}
              </CardContent>
            </Card>
          )}

          {/* Find Related */}
          <Button asChild variant="outline" size="sm" className="w-full gap-2">
            <Link href={`/ai/relationships?noteId=${id}`}>
              <Network className="h-4 w-4" />
              AI: Suggest Connections
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
