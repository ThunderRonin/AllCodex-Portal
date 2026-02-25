"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Plus,
  Clock,
  Database,
  Cpu,
  CheckCircle2,
  XCircle,
  Brain,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";

interface Note {
  noteId: string;
  title: string;
  type: string;
  dateModified: string;
  attributes: Array<{ name: string; value: string }>;
}

function getLoreType(note: Note): string {
  return (
    note.attributes?.find((a) => a.name === "loreType")?.value ??
    note.attributes?.find((a) => a.name === "template")?.value ??
    "lore"
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  sub,
  loading,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Icon className="h-4 w-4 text-primary" />
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-20" />
        ) : (
          <div className="text-3xl font-bold text-primary" style={{ fontFamily: "var(--font-cinzel)" }}>
            {value}
          </div>
        )}
        {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const { data: notes, isLoading } = useQuery<Note[]>({
    queryKey: ["lore", "#lore"],
    queryFn: () =>
      fetch("/api/lore?q=%23lore").then((r) => r.json()),
  });

  const { data: ragStatus } = useQuery({
    queryKey: ["rag-status"],
    queryFn: () => fetch("/api/rag").then((r) => r.json()).catch(() => null),
    retry: false,
  });

  const recent = notes?.slice(0, 8) ?? [];
  const totalCount = notes?.length ?? 0;

  const recentlyModified =
    notes
      ?.filter((n) => {
        const d = new Date(n.dateModified);
        const ago = Date.now() - d.getTime();
        return ago < 7 * 24 * 60 * 60 * 1000; // 7 days
      })
      .length ?? 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            className="text-2xl font-bold text-primary"
            style={{ fontFamily: "var(--font-cinzel)" }}
          >
            Chronicle Overview
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            The living record of All Reach
          </p>
        </div>
        <Button asChild size="sm" className="gap-2">
          <Link href="/lore/new">
            <Plus className="h-4 w-4" />
            New Lore Entry
          </Link>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Total Lore Entries"
          value={isLoading ? "—" : totalCount}
          loading={isLoading}
        />
        <StatCard
          icon={Clock}
          label="Updated This Week"
          value={isLoading ? "—" : recentlyModified}
          loading={isLoading}
          sub="last 7 days"
        />
        <StatCard
          icon={Database}
          label="RAG Indexed"
          value={ragStatus?.indexedNotes ?? "—"}
          sub={ragStatus?.model ?? ""}
        />
        <StatCard
          icon={TrendingUp}
          label="Quick Actions"
          value=""
          sub=""
        />
      </div>

      {/* Main grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent Lore */}
        <div className="lg:col-span-2">
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle
                className="text-sm font-semibold text-foreground/80 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-cinzel)" }}
              >
                Recent Entries
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {isLoading ? (
                <div className="space-y-3 pt-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : recent.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <BookOpen className="h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    No lore entries yet.
                    <br />
                    Use the Brain Dump to begin your chronicle.
                  </p>
                  <Button asChild size="sm" className="mt-4 gap-2" variant="outline">
                    <Link href="/brain-dump">
                      <Brain className="h-4 w-4" />
                      Open Brain Dump
                    </Link>
                  </Button>
                </div>
              ) : (
                <ul className="divide-y divide-border/30">
                  {recent.map((note) => (
                    <li key={note.noteId}>
                      <Link
                        href={`/lore/${note.noteId}`}
                        className="flex items-center justify-between gap-3 py-3 px-1 hover:bg-accent/30 rounded-md transition-colors group"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">
                            {note.title}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(note.dateModified).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs capitalize">
                          {getLoreType(note)}
                        </Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              {!isLoading && totalCount > 8 && (
                <div className="border-t border-border/30 pt-3 mt-2">
                  <Button asChild variant="ghost" size="sm" className="w-full text-xs text-muted-foreground">
                    <Link href="/lore">View all {totalCount} entries →</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions + Status */}
        <div className="space-y-4">
          <Card className="border-border/60">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle
                className="text-sm font-semibold text-foreground/80 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-cinzel)" }}
              >
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-2">
              <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
                <Link href="/brain-dump">
                  <Brain className="h-4 w-4 text-primary" />
                  Brain Dump
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
                <Link href="/ai/consistency">
                  <CheckCircle2 className="h-4 w-4 text-primary" />
                  Consistency Check
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
                <Link href="/ai/gaps">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  Gap Detector
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm" className="w-full justify-start gap-2">
                <Link href="/lore/new">
                  <Plus className="h-4 w-4 text-primary" />
                  New Entry
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border/60">
            <CardHeader className="border-b border-border/40 pb-3">
              <CardTitle
                className="text-sm font-semibold text-foreground/80 uppercase tracking-wider"
                style={{ fontFamily: "var(--font-cinzel)" }}
              >
                System Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">AllCodex</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-500">Online</span>
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">AllKnower</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                  <span className="text-green-500">Online</span>
                </div>
              </div>
              {ragStatus && (
                <p className="text-xs text-muted-foreground/60 pt-1 border-t border-border/30">
                  {ragStatus.indexedNotes ?? 0} notes in RAG index
                  {ragStatus.lastIndexed
                    ? ` · last indexed ${new Date(ragStatus.lastIndexed).toLocaleDateString()}`
                    : ""}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
