"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Save, Check } from "lucide-react";

interface BudgetData {
  dailyBudgetUsd: number | null;
  monthlyBudgetUsd: number | null;
  alertEmail: string | null;
}

export function TokenBudgetCard() {
  const queryClient = useQueryClient();
  const [dailyBudget, setDailyBudget] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");
  const [alertEmail, setAlertEmail] = useState("");
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery<BudgetData>({
    queryKey: ["user-budget"],
    queryFn: async () => {
      const res = await fetch("/api/usage/budgets");
      if (!res.ok) throw new Error("Failed to fetch budget");
      return res.json();
    },
  });

  useEffect(() => {
    if (data) {
      setDailyBudget(data.dailyBudgetUsd?.toString() ?? "");
      setMonthlyBudget(data.monthlyBudgetUsd?.toString() ?? "");
      setAlertEmail(data.alertEmail ?? "");
    }
  }, [data]);

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/usage/budgets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dailyBudgetUsd: dailyBudget ? parseFloat(dailyBudget) : null,
          monthlyBudgetUsd: monthlyBudget ? parseFloat(monthlyBudget) : null,
          alertEmail: alertEmail || null,
        }),
      });
      if (!res.ok) throw new Error("Failed to save budget");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-budget"] });
      queryClient.invalidateQueries({ queryKey: ["budget-alert-status"] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    },
  });

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-accent" />
          <h3 className="font-semibold">Token Budget</h3>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Daily Budget (USD)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="No limit"
              value={dailyBudget}
              onChange={(e) => setDailyBudget(e.target.value)}
              disabled={isLoading}
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Monthly Budget (USD)</label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder="No limit"
              value={monthlyBudget}
              onChange={(e) => setMonthlyBudget(e.target.value)}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-muted-foreground">Alert Email</label>
          <Input
            type="email"
            placeholder="you@example.com"
            value={alertEmail}
            onChange={(e) => setAlertEmail(e.target.value)}
            disabled={isLoading}
          />
          <p className="text-[10px] text-muted-foreground">
            Requires RESEND_API_KEY configured on AllKnower
          </p>
        </div>

        <Button
          onClick={() => mutation.mutate()}
          disabled={mutation.isPending || isLoading}
          className="gap-2"
          size="sm"
        >
          {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Saved" : "Save Budget"}
        </Button>
      </CardContent>
    </Card>
  );
}
