"use client";

interface GraphMetricsProps {
  nodeCount: number;
  edgeCount: number;
  typeDistribution: Record<string, number>;
  truncated?: boolean;
}

export function GraphMetrics({
  nodeCount,
  edgeCount,
  typeDistribution,
  truncated,
}: GraphMetricsProps) {
  const maxPossibleEdges = nodeCount > 1 ? (nodeCount * (nodeCount - 1)) / 2 : 0;
  const density = maxPossibleEdges > 0 ? edgeCount / maxPossibleEdges : 0;
  const topTypes = Object.entries(typeDistribution)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
      <span>
        <strong className="text-foreground/80">{nodeCount}</strong> nodes
      </span>
      <span>
        <strong className="text-foreground/80">{edgeCount}</strong> edges
      </span>
      <span>
        density{" "}
        <strong className="text-foreground/80">{(density * 100).toFixed(1)}%</strong>
      </span>
      {topTypes.length > 0 && (
        <span>
          top:{" "}
          {topTypes.map(([type, count], i) => (
            <span key={type}>
              {i > 0 && ", "}
              <span className="capitalize">{type.replace(/_/g, " ")}</span>
              {" "}({count})
            </span>
          ))}
        </span>
      )}
      {truncated && (
        <span className="text-yellow-400">(graph truncated)</span>
      )}
    </div>
  );
}
