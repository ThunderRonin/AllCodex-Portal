"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Filter } from "lucide-react";

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

interface GraphFilterBarProps {
  availableTypes: string[];
  enabledTypes: Set<string>;
  onToggleType: (type: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  showConfidence: boolean;
  enabledConfidences: Set<string>;
  onToggleConfidence: (level: string) => void;
}

function formatLabel(type: string): string {
  return type.replace(/_/g, " ");
}

export function GraphFilterBar({
  availableTypes,
  enabledTypes,
  onToggleType,
  onSelectAll,
  onDeselectAll,
  showConfidence,
  enabledConfidences,
  onToggleConfidence,
}: GraphFilterBarProps) {
  const allSelected = availableTypes.every((t) => enabledTypes.has(t));

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Filter className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Filter
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-5 px-1.5 text-[10px] text-muted-foreground"
          onClick={allSelected ? onDeselectAll : onSelectAll}
        >
          {allSelected ? "Clear" : "All"}
        </Button>
      </div>
      <div className="flex flex-wrap gap-1">
        {availableTypes.map((type) => {
          const active = enabledTypes.has(type);
          const color = EDGE_COLORS[type] ?? EDGE_COLORS.related_to;
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] capitalize border transition-opacity cursor-pointer ${
                active ? "opacity-100" : "opacity-40"
              }`}
              style={{
                borderColor: color,
                color: active ? color : undefined,
              }}
            >
              <span
                className="inline-block h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {formatLabel(type)}
            </button>
          );
        })}
      </div>
      {showConfidence && (
        <div className="flex items-center gap-2 pt-1">
          <span className="text-[10px] text-muted-foreground">Confidence:</span>
          {(["high", "medium", "low"] as const).map((level) => {
            let levelColor;
            if (level === "high") levelColor = "text-green-400";
            else if (level === "medium") levelColor = "text-yellow-400";
            else levelColor = "text-muted-foreground";

            return (
              <Badge
                key={level}
                variant={enabledConfidences.has(level) ? "default" : "outline"}
                className={`text-[9px] cursor-pointer px-1.5 py-0 ${levelColor}`}
                onClick={() => onToggleConfidence(level)}
              >
                {level}
              </Badge>
            );
          })}
        </div>
      )}
    </div>
  );
}
