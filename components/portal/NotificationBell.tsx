"use client";

import { useState, useEffect } from "react";
import { Bell, CheckCircle, XCircle, Clock, X, Trash2, ExternalLink } from "lucide-react";
import Link from "next/link";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useNotificationStore, type Notification, type NotificationStatus } from "@/lib/stores/notification-store";

const KIND_LABELS: Record<Notification["kind"], string> = {
  "brain-dump": "Brain Dump",
  "bulk-dump": "Bulk Dump",
  "review-commit": "Review Commit",
  "copilot-turn": "Copilot",
};

function StatusIcon({ status }: { status: NotificationStatus }) {
  if (status === "complete") {
    return <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />;
  }
  if (status === "error") {
    return <XCircle className="h-4 w-4 text-rose-400 shrink-0" />;
  }
  return (
    <span className="flex gap-0.5 shrink-0 mt-1">
      {[0, 1, 2].map((d) => (
        <span
          key={d}
          className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce"
          style={{ animationDelay: `${d * 150}ms` }}
        />
      ))}
    </span>
  );
}

function elapsed(ts: number) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  return `${Math.floor(m / 60)}h ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const notifications = useNotificationStore((s) => s.notifications);
  const dismiss = useNotificationStore((s) => s.dismiss);
  const dismissAll = useNotificationStore((s) => s.dismissAll);

  const pendingCount = notifications.filter((n) => n.status === "pending").length;
  const sorted = [...notifications].sort((a, b) => b.createdAt - a.createdAt);

  const showBadge = mounted && pendingCount > 0;
  const displayNotifications = mounted ? sorted : [];

  const badgeSuffix = showBadge ? ` (${pendingCount} pending)` : "";

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`Notifications${badgeSuffix}`}
        className="relative p-1.5 rounded-sm hover:bg-muted/20 transition-colors cursor-pointer"
      >
        <Bell className="h-4 w-4 text-muted-foreground" />
        {showBadge && (
          <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
            {pendingCount > 9 ? "9+" : pendingCount}
          </span>
        )}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="w-80 rounded-none border-l border-border/45 bg-card/90 backdrop-blur-md p-0 shadow-2xl">
          <SheetHeader className="px-4 py-3 border-b border-border/30 flex-row items-center justify-between space-y-0">
            <SheetTitle 
              className="text-xs font-semibold uppercase tracking-wider text-primary"
              style={{ fontFamily: "var(--font-cinzel)" }}
            >
              Operations
            </SheetTitle>
            {mounted && notifications.length > 0 && (
              <Button variant="ghost" size="sm" onClick={dismissAll} className="h-6 text-[10px] gap-1 cursor-pointer">
                <Trash2 className="h-3 w-3" /> Clear all
              </Button>
            )}
          </SheetHeader>
          <div className="flex flex-col overflow-y-auto max-h-[calc(100vh-60px)]">
            {!mounted || displayNotifications.length === 0 ? (
              <p className="text-xs text-muted-foreground/60 italic p-4 text-center">No operations in progress.</p>
            ) : (
              displayNotifications.map((n) => (
                <div key={n.id} className="flex items-start gap-3 p-3 border-b border-border/20 hover:bg-muted/10 group">
                  <StatusIcon status={n.status} />
                  <div className="flex-1 min-w-0">
                    <span 
                      className="text-[10px] uppercase tracking-wider text-muted-foreground/50"
                      style={{ fontFamily: "var(--font-cinzel)" }}
                    >
                      {KIND_LABELS[n.kind]}
                    </span>
                    <p className="text-xs font-medium truncate">{n.title}</p>
                    {n.summary && <p className="text-[11px] text-muted-foreground/70 mt-0.5">{n.summary}</p>}
                    {n.error && <p className="text-[11px] text-rose-400/80 mt-0.5">{n.error}</p>}
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground/40 flex items-center gap-0.5">
                        <Clock className="h-2.5 w-2.5" /> {elapsed(n.createdAt)}
                      </span>
                      {n.href && n.status !== "pending" && (
                        <Link
                          href={n.href}
                          onClick={() => setOpen(false)}
                          className="text-[10px] text-primary/70 hover:text-primary flex items-center gap-0.5"
                        >
                          <ExternalLink className="h-2.5 w-2.5" /> View
                        </Link>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => dismiss(n.id)}
                    aria-label="Dismiss notification"
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-destructive shrink-0 cursor-pointer"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground/40" />
                  </button>
                </div>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
