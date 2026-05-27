"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

interface BurnEntry {
  date: string;
  tokens: number;
  cost: number;
  count: number;
}

type BurnMode = "tokens" | "cost";

export function BurnChart({ data }: { data: BurnEntry[] }) {
  const [mode, setMode] = useState<BurnMode>("cost");

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-36 text-sm text-muted-foreground italic">
        No usage data for this period.
      </div>
    );
  }

  const values = data.map((d) => (mode === "cost" ? d.cost : d.tokens));
  const max = Math.max(...values, 0.001);

  const W = 700;
  const H = 140;
  const PAD_L = 60;
  const PAD_R = 16;
  const PAD_T = 12;
  const PAD_B = 28;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const points = values.map((v, i) => {
    const x = PAD_L + (i / Math.max(values.length - 1, 1)) * chartW;
    const y = PAD_T + chartH - (v / max) * chartH;
    return { x, y, value: v, date: data[i].date };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const areaPath = [
    `M ${points[0].x},${PAD_T + chartH}`,
    ...points.map((p) => `L ${p.x},${p.y}`),
    `L ${points[points.length - 1].x},${PAD_T + chartH}`,
    "Z",
  ].join(" ");

  const yLabels = [0, max / 2, max];
  const formatVal = (v: number) =>
    mode === "cost" ? `$${v.toFixed(v < 1 ? 4 : 2)}` : v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
          Daily {mode === "cost" ? "Cost (USD)" : "Tokens"}
        </p>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={mode === "cost" ? "secondary" : "ghost"}
            className="h-6 text-[10px] rounded-none"
            onClick={() => setMode("cost")}
          >
            Cost
          </Button>
          <Button
            size="sm"
            variant={mode === "tokens" ? "secondary" : "ghost"}
            className="h-6 text-[10px] rounded-none"
            onClick={() => setMode("tokens")}
          >
            Tokens
          </Button>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Daily ${mode} burn chart`}>
        {/* Y-axis labels */}
        {yLabels.map((v, i) => {
          const y = PAD_T + chartH - (v / max) * chartH;
          return (
            <g key={i}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="currentColor" strokeOpacity={0.08} />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fill="currentColor" fillOpacity={0.4} fontSize={9}>
                {formatVal(v)}
              </text>
            </g>
          );
        })}

        {/* X-axis labels every ~7 days */}
        {points.filter((_, i) => i % 7 === 0 || i === points.length - 1).map((p) => (
          <text key={p.date} x={p.x} y={H - 4} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontSize={8}>
            {new Date(p.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
          </text>
        ))}

        {/* Area fill */}
        <path d={areaPath} fill="url(#burnGrad)" />

        {/* Line */}
        <polyline points={polyline} fill="none" stroke="var(--accent)" strokeWidth={1.5} strokeLinejoin="round" />

        {/* Data points with tooltips */}
        {points.map((p) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={2.5} fill="var(--accent)" stroke="var(--background)" strokeWidth={1}>
            <title>{`${p.date}: ${formatVal(p.value)}`}</title>
          </circle>
        ))}

        <defs>
          <linearGradient id="burnGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.2} />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
          </linearGradient>
        </defs>
      </svg>
    </div>
  );
}
