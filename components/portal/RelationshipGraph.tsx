"use client";

import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Network, ChevronDown, ChevronUp, Loader2, Check, Plus, ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Node as RFNode, type Edge as RFEdge, MarkerType } from "@xyflow/react";
import { ReactFlowGraph } from "./ReactFlowGraph";

// ── Relationship type → edge color mapping ────────────────────────────────────

const EDGE_COLORS: Record<string, string> = {
  ally: "#4ade80",
  enemy: "#ef4444",
  rival: "#f97316",
  family: "#ec4899",
  member_of: "#a78bfa",
  leader_of: "#c084fc",
  serves: "#818cf8",
  located_in: "#38bdf8",
  originates_from: "#22d3ee",
  participated_in: "#fbbf24",
  caused: "#f59e0b",
  created: "#34d399",
  owns: "#fb923c",
  wields: "#e879f9",
  worships: "#c4b5fd",
  inhabits: "#67e8f9",
  related_to: "#94a3b8",
};

// ── Types ─────────────────────────────────────────────────────────────────────

interface ExistingRelation {
  name: string;
  targetNoteId: string;
  targetTitle: string;
}

interface Suggestion {
  targetNoteId: string;
  targetTitle: string;
  relationshipType: string;
  description: string;
  confidence?: "high" | "medium" | "low";
}

interface RelationshipsResponse {
  existing: ExistingRelation[];
  suggestions: Suggestion[];
}

interface ApplyRelationshipsResult {
  applied: Array<{
    sourceNoteId: string;
    targetNoteId: string;
    relationshipType: string;
    relationName: string;
  }>;
  skipped: Array<{
    sourceNoteId: string;
    targetNoteId: string;
    relationshipType: string;
    reason: string;
  }>;
  failed: Array<{
    sourceNoteId: string;
    targetNoteId: string;
    relationshipType: string;
    error: string;
  }>;
}

interface Edge {
  targetId: string;
  targetTitle: string;
  type: string;
  source: "existing" | "ai";
}

const RELATION_NAME_TO_CANONICAL: Record<string, string> = {
  relAlly: "ally",
  relEnemy: "enemy",
  relRival: "rival",
  relFamily: "family",
  relMemberOf: "member_of",
  relLeaderOf: "leader_of",
  relServes: "serves",
  relLocatedIn: "located_in",
  relOriginatesFrom: "originates_from",
  relParticipatedIn: "participated_in",
  relCaused: "caused",
  relCreated: "created",
  relOwns: "owns",
  relWields: "wields",
  relWorships: "worships",
  relInhabits: "inhabits",
  relRelatedTo: "related_to",
  relOther: "related_to",
};

function normalizeRelationshipType(type: string): string {
  return RELATION_NAME_TO_CANONICAL[type] ?? type;
}

function formatRelationshipLabel(type: string): string {
  return normalizeRelationshipType(type).replace(/_/g, " ");
}

function suggestionKey(suggestion: Pick<Suggestion, "targetNoteId" | "relationshipType">): string {
  return `${suggestion.targetNoteId}::${normalizeRelationshipType(suggestion.relationshipType)}`;
}

function buildGraphData(
  centerTitle: string,
  centerId: string,
  edges: Edge[]
): { nodes: RFNode[]; edges: RFEdge[] } {
  if (edges.length === 0) return { nodes: [], edges: [] };

  // Separate node dedup (by targetId) from edge dedup (by targetId::canonType).
  // Same target with multiple relationship types → one node, multiple edges.
  const nodeMap = new Map<string, Edge>();
  const edgeSeen = new Set<string>();
  const uniqueEdges: Edge[] = [];

  for (const edge of edges) {
    const canonType = normalizeRelationshipType(edge.type);
    const edgeKey = `${edge.targetId}::${canonType}`;

    const prevNode = nodeMap.get(edge.targetId);
    if (!prevNode || (edge.source === "existing" && prevNode.source === "ai")) {
      nodeMap.set(edge.targetId, edge);
    }

    if (!edgeSeen.has(edgeKey)) {
      edgeSeen.add(edgeKey);
      uniqueEdges.push(edge);
    }
  }

  const uniqueNodes = Array.from(nodeMap.values());
  const radius = 220;
  const centerX = 0;
  const centerY = 0;

  const centerNode: RFNode = {
    id: centerId,
    position: { x: centerX, y: centerY },
    data: { label: centerTitle || "Unknown" },
    style: {
      background: "#6b4c2a",
      color: "#e8dcc8",
      border: "2px solid #d4a843",
      borderRadius: "8px",
      padding: "8px 16px",
      fontSize: "13px",
      fontWeight: 600,
      cursor: "pointer",
    },
  };

  const rfNodes: RFNode[] = [centerNode];

  uniqueNodes.forEach((edge, i) => {
    const angle = (2 * Math.PI * i) / uniqueNodes.length - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle);
    const y = centerY + radius * Math.sin(angle);
    const isAI = edge.source === "ai";

    rfNodes.push({
      id: edge.targetId,
      position: { x, y },
      data: { label: edge.targetTitle || "Unknown" },
      style: {
        background: "#1a1528",
        color: isAI ? "#d4c9a8" : "#e8dcc8",
        border: isAI ? "1px dashed #555" : "1px solid #8b6914",
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "12px",
        cursor: "pointer",
      },
    });
  });

  const rfEdges: RFEdge[] = uniqueEdges.map((edge) => {
    const canonType = normalizeRelationshipType(edge.type);
    const color = EDGE_COLORS[canonType] ?? EDGE_COLORS.related_to;
    const isAI = edge.source === "ai";

    return {
      id: `e-${centerId}-${edge.targetId}-${canonType}`,
      source: centerId,
      target: edge.targetId,
      label: formatRelationshipLabel(edge.type),
      style: {
        stroke: color,
        strokeWidth: 2,
        strokeDasharray: isAI ? "5 5" : undefined,
      },
      labelStyle: { fill: "#94a3b8", fontSize: 10 },
      labelBgStyle: { fill: "#1a1528", fillOpacity: 0.8 },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color },
    };
  });

  return { nodes: rfNodes, edges: rfEdges };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RelationshipGraphProps {
  /** The note ID to fetch relationships for */
  noteId: string;
  /** The note title (used as center node label) */
  noteTitle: string;
}

export function RelationshipGraph({ noteId, noteTitle }: RelationshipGraphProps) {
  const [expanded, setExpanded] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<Record<string, string>>({});
  const router = useRouter();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery<RelationshipsResponse>({
    queryKey: ["relationships", noteId],
    queryFn: () =>
      fetch(`/api/lore/${noteId}/relationships`, { method: "POST" }).then(
        (r) => {
          if (!r.ok) throw new Error(`Failed to load relationships`);
          return r.json();
        }
      ),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const { mutate: applyRelation, variables: applyingKey } = useMutation({
    mutationFn: async ({ suggestion }: { suggestion: Suggestion; key: string }) => {
      const r = await fetch("/api/ai/relationships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceNoteId: noteId,
          relations: [{
            targetNoteId: suggestion.targetNoteId,
            relationshipType: suggestion.relationshipType,
            description: suggestion.description,
          }],
          bidirectional: true,
        }),
      });
      if (!r.ok) throw new Error("Failed to apply relation");
      return r.json() as Promise<ApplyRelationshipsResult>;
    },
    onSuccess: (result, { key }) => {
      const appliedKeys = new Set(result.applied.map((rel) => `${rel.targetNoteId}::${rel.relationshipType}`));
      const skippedKeys = new Set(result.skipped.map((rel) => `${rel.targetNoteId}::${rel.relationshipType}`));
      const failedByKey = Object.fromEntries(
        result.failed.map((rel) => [`${rel.targetNoteId}::${rel.relationshipType}`, rel.error]),
      );

      setApplied((prev) => {
        const next = new Set(prev);
        if (appliedKeys.has(key) || skippedKeys.has(key)) next.add(key);
        return next;
      });
      setFailures((prev) => {
        const next = { ...prev };
        delete next[key];
        for (const [failedKey, error] of Object.entries(failedByKey)) {
          next[failedKey] = error;
        }
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["note", noteId] });
      queryClient.invalidateQueries({ queryKey: ["relationships", noteId] });
    },
    onError: (error, { key }) => {
      setFailures((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Failed to apply relation.",
      }));
    },
  });

  // Build edges from the response
  const edges: Edge[] = [];
  if (data) {
    for (const rel of data.existing) {
      edges.push({
        targetId: rel.targetNoteId,
        targetTitle: rel.targetTitle,
        type: normalizeRelationshipType(rel.name),
        source: "existing",
      });
    }
    for (const sug of data.suggestions) {
      edges.push({
        targetId: sug.targetNoteId,
        targetTitle: sug.targetTitle,
        type: sug.relationshipType,
        source: "ai",
      });
    }
  }

  const graphData = buildGraphData(noteTitle, noteId, edges);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: RFNode) => {
      router.push(`/lore/${node.id}`);
    },
    [router]
  );

  const existingKeys = new Set((data?.existing ?? []).map((rel) => `${rel.targetNoteId}::${normalizeRelationshipType(rel.name)}`));
  const aiSuggestions = (data?.suggestions ?? []).filter(
    (suggestion) => !applied.has(suggestionKey(suggestion)) && !existingKeys.has(suggestionKey(suggestion))
  );

  return (
    <Card className="border-primary/20 bg-card/60">
      <CardHeader className="pb-2 border-b border-border/30">
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center justify-between w-full text-left cursor-pointer"
        >
          <CardTitle
            className="text-xs font-semibold uppercase tracking-wider text-primary flex items-center gap-1.5"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            <Network className="h-3.5 w-3.5" />
            Relationship Map
          </CardTitle>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </button>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-3 space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Analyzing relationships...
            </div>
          )}

          {error && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-destructive/80">
                Failed to load relationships.
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          )}

          {data && edges.length === 0 && (
            <p className="text-sm text-muted-foreground italic py-2">
              No relationships found for this entry.
            </p>
          )}

          {/* Diagram */}
          {graphData.nodes.length > 0 && (
            <div className="space-y-2">
              <ReactFlowGraph
                nodes={graphData.nodes}
                edges={graphData.edges}
                onNodeClick={handleNodeClick}
                className="rounded-md border border-border/30 bg-background/50"
              />
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5 bg-primary" />
                  Existing
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block w-4 h-0.5 border-t border-dashed border-muted-foreground" />
                  AI Suggested
                </span>
              </div>
            </div>
          )}

          {/* AI suggestions list with Apply buttons */}
          {aiSuggestions.length > 0 && (
            <div className="space-y-2">
              <p
                className="text-[10px] uppercase tracking-wider text-muted-foreground"
                style={{ fontFamily: "var(--font-cinzel)" }}
              >
                AI Suggestions
              </p>
              {aiSuggestions.map((s) => {
                const key = suggestionKey(s);
                const isApplied = applied.has(key);
                const isApplying = applyingKey?.key === key;
                const failure = failures[key];
                return (
                  <div
                    key={key}
                    className="flex items-start gap-2 rounded-md border border-border/40 bg-background/40 p-2.5"
                  >
                    <div className="flex-1 min-w-0 space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge
                          variant="outline"
                          className="text-[10px] capitalize px-1.5 py-0"
                        >
                          {formatRelationshipLabel(s.relationshipType)}
                        </Badge>
                        {s.confidence && (
                          <span className={`text-[9px] font-medium uppercase tracking-wide ${
                            s.confidence === "high" ? "text-green-400" :
                            s.confidence === "medium" ? "text-yellow-400" :
                            "text-muted-foreground"
                          }`}>
                            {s.confidence}
                          </span>
                        )}
                        <Link
                          href={`/lore/${s.targetNoteId}`}
                          className="text-xs font-medium text-primary hover:underline flex items-center gap-0.5"
                        >
                          {s.targetTitle}
                          <ArrowRight className="h-2.5 w-2.5" />
                        </Link>
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed">
                        {s.description}
                      </p>
                      {failure && (
                        <p className="text-[11px] text-destructive leading-relaxed">
                          Failed: {failure}
                        </p>
                      )}
                    </div>
                    <Button
                      size="sm"
                      variant={isApplied ? "secondary" : "outline"}
                      className="shrink-0 h-7 px-2 gap-1 text-xs"
                      disabled={isApplied || isApplying}
                      onClick={() => applyRelation({ suggestion: s, key })}
                    >
                      {isApplied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Applied
                        </>
                      ) : isApplying ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Plus className="h-3 w-3" />
                          Apply
                        </>
                      )}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
