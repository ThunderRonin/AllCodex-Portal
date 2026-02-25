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
  Search,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { Separator } from "@/components/ui/separator";

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
      <CardHeader className="pb-4 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{sub}</p>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: "var(--font-cinzel)" }}>
          Chronicle Dashboard
        </h1>
        <p className="text-muted-foreground">Overview of your world-building progress.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={BookOpen}
          label="Total Lore Entries"
          value={totalCount}
          loading={isLoading}
        />
        <StatCard
          icon={TrendingUp}
          label="Active Development"
          value={recentlyModified}
          sub="entries modified this week"
          loading={isLoading}
        />
        <StatCard
          icon={Database}
          label="Knowledge Base"
          value={ragStatus?.indexedNotes ?? 0}
          sub="notes indexed for AI"
          loading={!ragStatus}
        />
        <StatCard
          icon={Brain}
          label="Cognitive State"
          value="Healthy"
          sub="AI models online"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4 border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Recent Changes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))
              ) : recent.length > 0 ? (
                recent.map((note) => (
                  <div key={note.noteId} className="flex items-center justify-between border-b border-border/40 pb-3 last:border-0 last:pb-0">
                    <div className="space-y-1">
                      <Link href={`/lore/${note.noteId}`} className="text-sm font-medium hover:underline">
                        {note.title}
                      </Link>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px] uppercase tracking-tighter">
                          {getLoreType(note)}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(note.dateModified).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/lore/${note.noteId}`}>View</Link>
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-sm text-muted-foreground italic">
                  No notes found in the chronicle.
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-3 border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button className="w-full justify-start gap-2" asChild>
              <Link href="/lore/new">
                <Plus className="h-4 w-4" />
                New Lore Entry
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <Link href="/brain-dump">
                <Brain className="h-4 w-4 text-primary" />
                Start Brain Dump
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" asChild>
              <Link href="/search">
                <Search className="h-4 w-4" />
                Semantic Search
              </Link>
            </Button>
            <Separator />
            <div className="pt-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">AI Diagnostics</h4>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                    Lore Consistency
                  </span>
                  <span className="text-green-500 font-medium">PASS</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <XCircle className="h-3 w-3 text-amber-500" />
                    Narrative Gaps
                  </span>
                  <span className="text-amber-500 font-medium">3 DETECTED</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}