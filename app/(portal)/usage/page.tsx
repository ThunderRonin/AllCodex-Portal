"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ServiceBanner } from "@/components/portal/ServiceBanner";
import { BurnChart } from "@/components/portal/BurnChart";
import { Activity, Coins, Hourglass, BarChart3, Cpu } from "lucide-react";

interface UsageSummary {
  summary: {
    totalTokens: number;
    totalRequests: number;
    avgLatency: number;
    totalCostUsd: number;
  };
  dailyBurn: Array<{ date: string; tokens: number; cost: number; count: number }>;
  taskCosts: Array<{ task: string; tokens: number; cost: number; count: number; avgLatency: number }>;
  modelDistribution: Array<{ model: string; tokens: number; cost: number; count: number }>;
  latencyStats: Array<{ task: string; model: string; count: number; avg: number; p50: number; p90: number; p95: number; p99: number }>;
}

function StatCard({ icon: Icon, label, value, sub }: { icon: typeof Activity; label: string; value: string; sub?: string }) {
  return (
    <Card className="wiki-rail-card">
      <CardContent className="p-4 flex items-start gap-3">
        <div className="p-2 rounded-none bg-accent/10 text-accent">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wider">{label}</p>
          <p className="text-lg font-bold text-foreground" style={{ fontFamily: "var(--font-cinzel)" }}>{value}</p>
          {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toString();
}

export default function UsagePage() {
  const { data, isLoading, error } = useQuery<UsageSummary>({
    queryKey: ["usage-summary"],
    queryFn: async () => {
      const res = await fetch("/api/usage/summary");
      if (!res.ok) throw new Error("Failed to fetch usage data");
      return res.json();
    },
    staleTime: 60_000,
  });

  return (
    <div className="mx-auto max-w-5xl space-y-8 px-4 pb-10 pt-4 sm:px-6 lg:px-8">
      <header>
        <h1
          className="text-2xl font-bold text-primary"
          style={{ fontFamily: "var(--font-cinzel)" }}
        >
          Token Usage
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Last 30 days of LLM usage across all tasks</p>
      </header>

      {error && <ServiceBanner service="AllKnower" error={error} />}

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20" />)
        ) : data ? (
          <>
            <StatCard icon={Activity} label="Total Tokens" value={formatTokens(data.summary.totalTokens)} sub={`${data.summary.totalRequests} requests`} />
            <StatCard icon={Coins} label="Total Cost" value={`$${data.summary.totalCostUsd.toFixed(4)}`} />
            <StatCard icon={Hourglass} label="Avg Latency" value={`${data.summary.avgLatency}ms`} />
            <StatCard icon={Cpu} label="Models Used" value={data.modelDistribution.length.toString()} />
          </>
        ) : null}
      </div>

      {/* Burn chart */}
      <Card className="wiki-panel">
        <CardContent className="p-6">
          {isLoading ? (
            <Skeleton className="h-36 w-full" />
          ) : data ? (
            <BurnChart data={data.dailyBurn} />
          ) : null}
        </CardContent>
      </Card>

      {/* Tables */}
      {!isLoading && data && (
        <div className="grid gap-8 lg:grid-cols-2">
          {/* By Task */}
          <Card className="wiki-panel">
            <CardContent className="p-6 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-cinzel)" }}>
                <BarChart3 className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
                By Task
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 font-medium">Task</th>
                      <th className="text-right py-2 font-medium">Calls</th>
                      <th className="text-right py-2 font-medium">Tokens</th>
                      <th className="text-right py-2 font-medium">Cost</th>
                      <th className="text-right py-2 font-medium">Avg ms</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.taskCosts.map((t) => (
                      <tr key={t.task} className="border-b border-border/10 hover:bg-muted/5">
                        <td className="py-1.5 font-medium text-foreground/90">{t.task}</td>
                        <td className="text-right text-muted-foreground">{t.count}</td>
                        <td className="text-right text-muted-foreground">{formatTokens(t.tokens)}</td>
                        <td className="text-right text-accent font-medium">${t.cost.toFixed(4)}</td>
                        <td className="text-right text-muted-foreground">{t.avgLatency}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* By Model */}
          <Card className="wiki-panel">
            <CardContent className="p-6 space-y-3">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-cinzel)" }}>
                <Cpu className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
                By Model
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left py-2 font-medium">Model</th>
                      <th className="text-right py-2 font-medium">Calls</th>
                      <th className="text-right py-2 font-medium">Tokens</th>
                      <th className="text-right py-2 font-medium">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.modelDistribution.map((m) => (
                      <tr key={m.model} className="border-b border-border/10 hover:bg-muted/5">
                        <td className="py-1.5 font-mono text-foreground/90">{m.model}</td>
                        <td className="text-right text-muted-foreground">{m.count}</td>
                        <td className="text-right text-muted-foreground">{formatTokens(m.tokens)}</td>
                        <td className="text-right text-accent font-medium">${m.cost.toFixed(4)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Latency Percentiles */}
      {!isLoading && data && data.latencyStats.length > 0 && (
        <Card className="wiki-panel">
          <CardContent className="p-6 space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider" style={{ fontFamily: "var(--font-cinzel)" }}>
              <Hourglass className="h-3.5 w-3.5 inline-block mr-1.5 -mt-0.5" />
              Latency Percentiles
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30 text-muted-foreground">
                    <th className="text-left py-2 font-medium">Task</th>
                    <th className="text-left py-2 font-medium">Model</th>
                    <th className="text-right py-2 font-medium">Count</th>
                    <th className="text-right py-2 font-medium">p50</th>
                    <th className="text-right py-2 font-medium">p90</th>
                    <th className="text-right py-2 font-medium">p95</th>
                    <th className="text-right py-2 font-medium">p99</th>
                  </tr>
                </thead>
                <tbody>
                  {data.latencyStats.map((s) => (
                    <tr key={`${s.task}-${s.model}`} className="border-b border-border/10 hover:bg-muted/5">
                      <td className="py-1.5 font-medium text-foreground/90">{s.task}</td>
                      <td className="py-1.5 font-mono text-muted-foreground">{s.model}</td>
                      <td className="text-right text-muted-foreground">{s.count}</td>
                      <td className="text-right text-muted-foreground">{s.p50}ms</td>
                      <td className="text-right text-muted-foreground">{s.p90}ms</td>
                      <td className="text-right text-amber-500">{s.p95}ms</td>
                      <td className="text-right text-rose-400">{s.p99}ms</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
