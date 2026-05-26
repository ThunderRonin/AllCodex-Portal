"use client";

import { useState, useCallback, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, ChevronDown, ChevronUp, Loader2, Check, Plus, ArrowRight, Layers } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type Node as RFNode, type Edge as RFEdge, MarkerType } from "@xyflow/react";
import { ReactFlowGraph } from "@/components/portal/ReactFlowGraph";
import { GraphFilterBar } from "@/components/portal/GraphFilterBar";
import { GraphMetrics } from "@/components/portal/GraphMetrics";
import type { GraphResponse } from "@/lib/allknower-schemas";

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
  other: "#94a3b8",
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

// ── Parallel edge offset assignment ──────────────────────────────────────────

function assignParallelOffsets(edges: RFEdge[]): RFEdge[] {
  const groups = new Map<string, number[]>();
  edges.forEach((edge, i) => {
    const pair = edge.source < edge.target
      ? `${edge.source}||${edge.target}`
      : `${edge.target}||${edge.source}`;
    const list = groups.get(pair);
    if (list) list.push(i);
    else groups.set(pair, [i]);
  });

  const result = [...edges];
  for (const indices of groups.values()) {
    if (indices.length <= 1) continue;
    for (let pos = 0; pos < indices.length; pos++) {
      const idx = indices[pos];
      result[idx] = {
        ...edges[idx],
        type: "offsetBezier",
        data: { ...edges[idx].data, parallelIndex: pos, parallelCount: indices.length },
      };
    }
  }
  return result;
}

// ── Graph builders ───────────────────────────────────────────────────────────

function buildGraphData(
  centerTitle: string,
  centerId: string,
  edges: Edge[]
): { nodes: RFNode[]; edges: RFEdge[] } {
  if (edges.length === 0) return { nodes: [], edges: [] };

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
  const radius = Math.min(220, 80 + uniqueNodes.length * 20);
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

  return { nodes: rfNodes, edges: assignParallelOffsets(rfEdges) };
}

function buildMultiHopGraphData(
  graph: GraphResponse,
  aiEdges: Edge[],
): { nodes: RFNode[]; edges: RFEdge[] } {
  if (graph.nodes.length === 0) return { nodes: [], edges: [] };

  const nodesByDepth = new Map<number, typeof graph.nodes>();
  for (const node of graph.nodes) {
    const list = nodesByDepth.get(node.depth) ?? [];
    list.push(node);
    nodesByDepth.set(node.depth, list);
  }

  const centerX = 0;
  const centerY = 0;
  const rfNodes: RFNode[] = [];

  for (const [depth, depthNodes] of nodesByDepth) {
    const radius = depth === 0 ? 0 : 120 + depth * 100;
    depthNodes.forEach((node, i) => {
      const angle = depth === 0
        ? 0
        : (2 * Math.PI * i) / depthNodes.length - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      const isCenter = depth === 0;

      rfNodes.push({
        id: node.noteId,
        position: { x, y },
        data: { label: node.title || "Unknown" },
        style: {
          background: isCenter ? "#6b4c2a" : "#1a1528",
          color: "#e8dcc8",
          border: isCenter
            ? "2px solid #d4a843"
            : depth === 1
              ? "1px solid #8b6914"
              : "1px solid #444",
          borderRadius: "8px",
          padding: isCenter ? "8px 16px" : "6px 12px",
          fontSize: isCenter ? "13px" : depth === 1 ? "12px" : "11px",
          fontWeight: isCenter ? 600 : 400,
          opacity: depth <= 1 ? 1 : 0.75,
          cursor: "pointer",
        },
      });
    });
  }

  // Add AI suggestion nodes not already in the graph
  const graphNodeIds = new Set(graph.nodes.map((n) => n.noteId));
  const aiOnlyTargets = aiEdges.filter((e) => !graphNodeIds.has(e.targetId));
  const aiRadius = 220;
  aiOnlyTargets.forEach((edge, i) => {
    const angle = (2 * Math.PI * i) / Math.max(aiOnlyTargets.length, 1) - Math.PI / 2;
    rfNodes.push({
      id: edge.targetId,
      position: { x: centerX + aiRadius * Math.cos(angle), y: centerY + aiRadius * Math.sin(angle) },
      data: { label: edge.targetTitle || "Unknown" },
      style: {
        background: "#1a1528",
        color: "#d4c9a8",
        border: "1px dashed #555",
        borderRadius: "8px",
        padding: "6px 12px",
        fontSize: "12px",
        cursor: "pointer",
      },
    });
    graphNodeIds.add(edge.targetId);
  });

  const edgeSeen = new Set<string>();
  const rfEdges: RFEdge[] = [];

  for (const edge of graph.edges) {
    const canonType = edge.relationshipType;
    const edgeKey = `${edge.sourceNoteId}-${edge.targetNoteId}-${canonType}`;
    if (edgeSeen.has(edgeKey)) continue;
    edgeSeen.add(edgeKey);

    const color = EDGE_COLORS[canonType] ?? EDGE_COLORS.related_to;
    rfEdges.push({
      id: `e-${edgeKey}`,
      source: edge.sourceNoteId,
      target: edge.targetNoteId,
      label: formatRelationshipLabel(canonType),
      style: { stroke: color, strokeWidth: 2 },
      labelStyle: { fill: "#94a3b8", fontSize: 10 },
      labelBgStyle: { fill: "#1a1528", fillOpacity: 0.8 },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color },
    });
  }

  for (const edge of aiEdges) {
    const canonType = normalizeRelationshipType(edge.type);
    const edgeKey = `${graph.centerNoteId}-${edge.targetId}-${canonType}`;
    if (edgeSeen.has(edgeKey)) continue;
    edgeSeen.add(edgeKey);

    const color = EDGE_COLORS[canonType] ?? EDGE_COLORS.related_to;
    rfEdges.push({
      id: `e-ai-${edgeKey}`,
      source: graph.centerNoteId,
      target: edge.targetId,
      label: formatRelationshipLabel(edge.type),
      style: { stroke: color, strokeWidth: 2, strokeDasharray: "5 5" },
      labelStyle: { fill: "#94a3b8", fontSize: 10 },
      labelBgStyle: { fill: "#1a1528", fillOpacity: 0.8 },
      labelBgPadding: [4, 2] as [number, number],
      markerEnd: { type: MarkerType.ArrowClosed, color },
    });
  }

  return { nodes: rfNodes, edges: assignParallelOffsets(rfEdges) };
}

// ── Component ─────────────────────────────────────────────────────────────────

interface RelationshipGraphProps {
  noteId: string;
  noteTitle: string;
}

export function RelationshipGraph({ noteId, noteTitle }: RelationshipGraphProps) {
  const [expanded, setExpanded] = useState(false);
  const [depth, setDepth] = useState(1);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [failures, setFailures] = useState<Record<string, string>>({});
  const [enabledTypes, setEnabledTypes] = useState<Set<string> | null>(null);
  const [enabledConfidences, setEnabledConfidences] = useState<Set<string>>(
    new Set(["high", "medium", "low"]),
  );
  const router = useRouter();
  const queryClient = useQueryClient();

  // ── 1-hop relationship query (always runs when expanded) ──────────────
  const {
    data: relData,
    isLoading: relLoading,
    error: relError,
    refetch: relRefetch,
  } = useQuery<RelationshipsResponse>({
    queryKey: ["relationships", noteId],
    queryFn: () =>
      fetch(`/api/lore/${noteId}/relationships`, { method: "POST" }).then((r) => {
        if (!r.ok) throw new Error("Failed to load relationships");
        return r.json();
      }),
    enabled: expanded,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Multi-hop graph query (only when depth > 1) ──────────────────────
  const {
    data: graphData,
    isLoading: graphLoading,
  } = useQuery<GraphResponse>({
    queryKey: ["graph", noteId, depth],
    queryFn: () =>
      fetch(`/api/lore/${noteId}/graph?depth=${depth}`).then((r) => {
        if (!r.ok) throw new Error("Failed to load graph");
        return r.json();
      }),
    enabled: expanded && depth > 1,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  // ── Apply single suggestion ──────────────────────────────────────────
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
      handleApplyResult(result, key);
    },
    onError: (error, { key }) => {
      setFailures((prev) => ({
        ...prev,
        [key]: error instanceof Error ? error.message : "Failed to apply relation.",
      }));
    },
  });

  // ── Batch apply all pending suggestions ──────────────────────────────
  const { mutate: batchApply, isPending: isBatchApplying } = useMutation({
    mutationFn: async (suggestions: Suggestion[]) => {
      const r = await fetch("/api/ai/relationships", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceNoteId: noteId,
          relations: suggestions.map((s) => ({
            targetNoteId: s.targetNoteId,
            relationshipType: s.relationshipType,
            description: s.description,
          })),
          bidirectional: true,
        }),
      });
      if (!r.ok) throw new Error("Failed to apply relations");
      return r.json() as Promise<ApplyRelationshipsResult>;
    },
    onSuccess: (result) => {
      for (const rel of result.applied) {
        const key = `${rel.targetNoteId}::${rel.relationshipType}`;
        handleApplyResult(result, key);
      }
      queryClient.invalidateQueries({ queryKey: ["relationships", noteId] });
      queryClient.invalidateQueries({ queryKey: ["graph", noteId] });
    },
  });

  function handleApplyResult(result: ApplyRelationshipsResult, key: string) {
    const appliedKeys = new Set(
      result.applied.map((rel) => `${rel.targetNoteId}::${rel.relationshipType}`),
    );
    const skippedKeys = new Set(
      result.skipped.map((rel) => `${rel.targetNoteId}::${rel.relationshipType}`),
    );
    const failedByKey = Object.fromEntries(
      result.failed.map((rel) => [`${rel.targetNoteId}::${rel.relationshipType}`, rel.error]),
    );

    setApplied((prev) => {
      const next = new Set(prev);
      if (appliedKeys.has(key) || skippedKeys.has(key)) next.add(key);
      for (const k of appliedKeys) next.add(k);
      for (const k of skippedKeys) next.add(k);
      return next;
    });
    setFailures((prev) => {
      const next = { ...prev };
      delete next[key];
      for (const [fk, error] of Object.entries(failedByKey)) next[fk] = error;
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ["note", noteId] });
    queryClient.invalidateQueries({ queryKey: ["relationships", noteId] });
    queryClient.invalidateQueries({ queryKey: ["graph", noteId] });
  }

  // ── Build edge/node data ─────────────────────────────────────────────
  const allEdges: Edge[] = useMemo(() => {
    if (!relData) return [];
    const edges: Edge[] = [];
    for (const rel of relData.existing) {
      edges.push({
        targetId: rel.targetNoteId,
        targetTitle: rel.targetTitle,
        type: normalizeRelationshipType(rel.name),
        source: "existing",
      });
    }
    for (const sug of relData.suggestions) {
      edges.push({
        targetId: sug.targetNoteId,
        targetTitle: sug.targetTitle,
        type: sug.relationshipType,
        source: "ai",
      });
    }
    return edges;
  }, [relData]);

  const availableTypes = useMemo(() => {
    const types = new Set<string>();
    for (const e of allEdges) types.add(normalizeRelationshipType(e.type));
    if (graphData) {
      for (const e of graphData.edges) types.add(e.relationshipType);
    }
    return Array.from(types).sort((a, b) => a.localeCompare(b));
  }, [allEdges, graphData]);

  const activeTypes = useMemo(
    () => enabledTypes ?? new Set(availableTypes),
    [enabledTypes, availableTypes],
  );

  const filteredEdges = useMemo(() => {
    return allEdges.filter((e) => {
      const canon = normalizeRelationshipType(e.type);
      if (!activeTypes.has(canon)) return false;
      if (e.source === "ai") {
        const sug = relData?.suggestions.find(
          (s) => s.targetNoteId === e.targetId && s.relationshipType === e.type,
        );
        if (sug?.confidence && !enabledConfidences.has(sug.confidence)) return false;
      }
      return true;
    });
  }, [allEdges, activeTypes, enabledConfidences, relData]);

  const filteredGraphData = useMemo(() => {
    if (!graphData) return null;
    return {
      ...graphData,
      edges: graphData.edges.filter((e) => activeTypes.has(e.relationshipType)),
    };
  }, [graphData, activeTypes]);

  const rfData = useMemo(() => {
    if (depth > 1 && filteredGraphData) {
      const aiEdges = filteredEdges.filter((e) => e.source === "ai");
      return buildMultiHopGraphData(filteredGraphData, aiEdges);
    }
    return buildGraphData(noteTitle, noteId, filteredEdges);
  }, [depth, filteredGraphData, filteredEdges, noteTitle, noteId]);

  const metrics = useMemo(() => {
    const typeDistribution: Record<string, number> = {};
    const countedEdges = depth > 1 && filteredGraphData
      ? filteredGraphData.edges
      : filteredEdges.map((e) => ({ relationshipType: normalizeRelationshipType(e.type) }));
    for (const e of countedEdges) {
      typeDistribution[e.relationshipType] = (typeDistribution[e.relationshipType] ?? 0) + 1;
    }
    return {
      nodeCount: rfData.nodes.length,
      edgeCount: rfData.edges.length,
      typeDistribution,
      truncated: depth > 1 && filteredGraphData?.truncated,
    };
  }, [rfData, filteredEdges, filteredGraphData, depth]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: RFNode) => {
      router.push(`/lore/${node.id}`);
    },
    [router],
  );

  const existingKeys = new Set(
    (relData?.existing ?? []).map(
      (rel) => `${rel.targetNoteId}::${normalizeRelationshipType(rel.name)}`,
    ),
  );
  const aiSuggestions = (relData?.suggestions ?? []).filter(
    (suggestion) =>
      !applied.has(suggestionKey(suggestion)) &&
      !existingKeys.has(suggestionKey(suggestion)) &&
      activeTypes.has(normalizeRelationshipType(suggestion.relationshipType)) &&
      (!suggestion.confidence || enabledConfidences.has(suggestion.confidence)),
  );

  const isLoading = relLoading || (depth > 1 && graphLoading);

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
              {depth > 1 ? "Building multi-hop graph..." : "Analyzing relationships..."}
            </div>
          )}

          {relError && (
            <div className="space-y-2 py-2">
              <p className="text-sm text-destructive/80">
                Failed to load relationships.
              </p>
              <Button variant="outline" size="sm" onClick={() => relRefetch()}>
                Retry
              </Button>
            </div>
          )}

          {relData && !isLoading && (
            <>
              {/* Depth toggle + filter bar */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Layers className="h-3 w-3 text-muted-foreground" />
                  <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Depth
                  </span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((d) => (
                      <Button
                        key={d}
                        variant={depth === d ? "default" : "outline"}
                        size="sm"
                        className="h-6 w-6 p-0 text-[10px]"
                        onClick={() => setDepth(d)}
                      >
                        {d}
                      </Button>
                    ))}
                  </div>
                </div>

                {availableTypes.length > 0 && (
                  <GraphFilterBar
                    availableTypes={availableTypes}
                    enabledTypes={activeTypes}
                    onToggleType={(type) => {
                      setEnabledTypes((prev) => {
                        const next = new Set(prev ?? availableTypes);
                        if (next.has(type)) next.delete(type);
                        else next.add(type);
                        return next;
                      });
                    }}
                    onSelectAll={() => setEnabledTypes(null)}
                    onDeselectAll={() => setEnabledTypes(new Set())}
                    showConfidence={aiSuggestions.some((s) => s.confidence)}
                    enabledConfidences={enabledConfidences}
                    onToggleConfidence={(level) => {
                      setEnabledConfidences((prev) => {
                        const next = new Set(prev);
                        if (next.has(level)) next.delete(level);
                        else next.add(level);
                        return next;
                      });
                    }}
                  />
                )}
              </div>

              {/* Graph */}
              {rfData.nodes.length > 0 && (
                <div className="space-y-2">
                  <ReactFlowGraph
                    nodes={rfData.nodes}
                    edges={rfData.edges}
                    onNodeClick={handleNodeClick}
                    className="rounded-md border border-border/30 bg-background/50"
                  />
                  <GraphMetrics {...metrics} />
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

              {rfData.nodes.length === 0 && (
                <p className="text-sm text-muted-foreground italic py-2">
                  No relationships found for this entry.
                </p>
              )}

              {/* AI suggestions with batch apply */}
              {aiSuggestions.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p
                      className="text-[10px] uppercase tracking-wider text-muted-foreground"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      AI Suggestions ({aiSuggestions.length})
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 gap-1 text-[10px]"
                      disabled={isBatchApplying}
                      onClick={() => batchApply(aiSuggestions)}
                    >
                      {isBatchApplying ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <>
                          <Check className="h-3 w-3" />
                          Apply All
                        </>
                      )}
                    </Button>
                  </div>
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
                              <span
                                className={`text-[9px] font-medium uppercase tracking-wide ${
                                  s.confidence === "high"
                                    ? "text-green-400"
                                    : s.confidence === "medium"
                                      ? "text-yellow-400"
                                      : "text-muted-foreground"
                                }`}
                              >
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
                          disabled={isApplied || isApplying || isBatchApplying}
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
              <RelationTimeline noteId={noteId} expanded={expanded} />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function RelationTimeline({ noteId, expanded }: { noteId: string; expanded: boolean }) {
  const [showHistory, setShowHistory] = useState(false);
  const { data: historyData } = useQuery<{ entries: Array<{
    id: string;
    sourceNoteId: string;
    targetNoteId: string;
    type: string;
    description: string | null;
    createdAt: string;
  }> }>({
    queryKey: ["relationship-history", noteId],
    queryFn: () =>
      fetch(`/api/lore/${noteId}/relationship-history`).then((r) => {
        if (!r.ok) throw new Error("Failed to load history");
        return r.json();
      }),
    enabled: expanded && showHistory,
    staleTime: 60 * 1000,
  });

  return (
    <div className="space-y-2">
      <button
        onClick={() => setShowHistory(!showHistory)}
        className="text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground flex items-center gap-1 cursor-pointer"
        style={{ fontFamily: "var(--font-cinzel)" }}
      >
        {showHistory ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        History
      </button>
      {showHistory && historyData?.entries && (
        <div className="space-y-1 border-l border-border/40 pl-3 ml-1">
          {historyData.entries.map((entry) => (
            <div key={entry.id} className="text-[11px] text-muted-foreground">
              <span className="text-foreground/70 capitalize">
                {entry.type.replace(/_/g, " ")}
              </span>
              {" → "}
              <Link
                href={`/lore/${entry.sourceNoteId === noteId ? entry.targetNoteId : entry.sourceNoteId}`}
                className="text-primary hover:underline"
              >
                {entry.sourceNoteId === noteId ? entry.targetNoteId : entry.sourceNoteId}
              </Link>
              {entry.description && (
                <span className="italic"> — {entry.description}</span>
              )}
              <span className="text-muted-foreground/50 ml-1">
                {new Date(entry.createdAt).toLocaleDateString()}
              </span>
            </div>
          ))}
          {historyData.entries.length === 0 && (
            <p className="text-[11px] text-muted-foreground italic">No history yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
