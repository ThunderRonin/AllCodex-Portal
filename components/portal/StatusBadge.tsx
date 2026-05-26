import { CheckCircle2, Loader2, XCircle, Circle } from "lucide-react";

type StatusState = "connected" | "checking" | "error" | "disconnected" | "unknown";

interface StatusBadgeProps {
  state: StatusState;
  version?: string;
}

export function StatusBadge({ state, version }: StatusBadgeProps) {
  if (state === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none text-[11px] px-2.5 py-1 bg-accent/20 text-accent border border-accent/30">
        <CheckCircle2 className="h-3 w-3 shrink-0" />
        Connected{version ? ` · v${version}` : ""}
      </span>
    );
  }
  if (state === "checking") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none text-[11px] px-2.5 py-1 bg-primary/20 text-primary border border-primary/30">
        <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
        Checking…
      </span>
    );
  }
  if (state === "error") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-none text-[11px] px-2.5 py-1 bg-destructive/20 text-destructive border border-destructive/30">
        <XCircle className="h-3 w-3 shrink-0" />
        Error
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-none text-[11px] px-2.5 py-1 border border-border/50 text-muted-foreground">
      <Circle className="h-3 w-3 shrink-0" />
      Disconnected
    </span>
  );
}
