"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

interface AlertStatus {
  configured: boolean;
  dailySpendUsd: number;
  monthlySpendUsd: number;
  dailyBudgetUsd: number | null;
  monthlyBudgetUsd: number | null;
  dailyOverBudget: boolean;
  monthlyOverBudget: boolean;
}

export function BudgetBanner() {
  const { data } = useQuery<AlertStatus>({
    queryKey: ["budget-alert-status"],
    queryFn: async () => {
      const res = await fetch("/api/usage/alert-status");
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000,
    retry: false,
    staleTime: 4 * 60 * 1000,
  });

  if (!data || !data.configured) return null;
  if (!data.dailyOverBudget && !data.monthlyOverBudget) return null;

  const parts: string[] = [];
  if (data.dailyOverBudget) {
    parts.push(`Daily: $${data.dailySpendUsd.toFixed(2)} / $${data.dailyBudgetUsd!.toFixed(2)}`);
  }
  if (data.monthlyOverBudget) {
    parts.push(`Monthly: $${data.monthlySpendUsd.toFixed(2)} / $${data.monthlyBudgetUsd!.toFixed(2)}`);
  }

  return (
    <div className="bg-amber-950/30 border-b border-amber-500/20 px-4 py-2 flex items-center gap-3 text-xs text-amber-300">
      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
      <span className="flex-1">
        Budget exceeded — {parts.join(" · ")}
      </span>
      <Link href="/usage" className="underline hover:text-amber-200 shrink-0">
        View Usage
      </Link>
      <Link href="/settings" className="underline hover:text-amber-200 shrink-0">
        Settings
      </Link>
    </div>
  );
}
