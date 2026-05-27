import { ReactNode } from "react";
import Link from "next/link";
import { Plus, RefreshCw, SkipForward, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type EntityAction = "create" | "update" | "skip" | "error";

interface EntityResultCardProps {
  title: string;
  type: string;
  action: EntityAction;
  noteId?: string;
  metadata?: string;
  children?: ReactNode;
}

const ACTION_CONFIG: Record<EntityAction, {
  borderClass: string;
  bgClass: string;
  hoverClass: string;
  icon: typeof Plus;
  iconClass: string;
}> = {
  create: {
    borderClass: "border-l-accent",
    bgClass: "bg-accent/5",
    hoverClass: "hover:bg-accent/10",
    icon: Plus,
    iconClass: "text-accent",
  },
  update: {
    borderClass: "border-l-primary/60",
    bgClass: "bg-primary/5",
    hoverClass: "hover:bg-primary/10",
    icon: RefreshCw,
    iconClass: "text-primary",
  },
  skip: {
    borderClass: "border-l-border/50",
    bgClass: "bg-muted/5",
    hoverClass: "",
    icon: SkipForward,
    iconClass: "text-muted-foreground",
  },
  error: {
    borderClass: "border-l-destructive/60",
    bgClass: "bg-destructive/5",
    hoverClass: "",
    icon: AlertCircle,
    iconClass: "text-destructive",
  },
};

function EntityResultCardInner({ title, type, action, metadata }: EntityResultCardProps) {
  const cfg = ACTION_CONFIG[action];
  const Icon = cfg.icon;

  return (
    <div
      className={`rounded-none p-3 flex items-start gap-3 border-l-2 transition-colors ${cfg.borderClass} ${cfg.bgClass} ${cfg.hoverClass} ${action === "skip" ? "opacity-70" : ""}`}
    >
      <div className={`mt-0.5 shrink-0 ${cfg.iconClass}`}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight truncate">{title}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <Badge variant="secondary" className="text-[10px] capitalize rounded-none border border-border/40 px-1.5">
            {type}
          </Badge>
          {metadata && (
            <span className="text-xs text-muted-foreground truncate">{metadata}</span>
          )}
        </div>
      </div>
    </div>
  );
}

export function EntityResultCard(props: EntityResultCardProps) {
  if (props.noteId) {
    return (
      <Link href={`/lore/${props.noteId}`} className="block">
        <EntityResultCardInner {...props} />
        {props.children}
      </Link>
    );
  }
  return (
    <div>
      <EntityResultCardInner {...props} />
      {props.children}
    </div>
  );
}
