"use client";

/**
 * PreviewToggle — switches the lore detail view between GM mode (full content)
 * and Player mode (content with .gm-only elements hidden).
 */

import { Button } from "@/components/ui/button";
import { Eye, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type PreviewMode = "gm" | "player";

interface PreviewToggleProps {
  mode: PreviewMode;
  onChange: (mode: PreviewMode) => void;
}

/**
 * Render a two-button toggle for switching between "gm" and "player" preview modes.
 *
 * @param mode - Currently selected preview mode, either `"gm"` or `"player"`
 * @param onChange - Callback invoked with the newly selected `PreviewMode` when a button is clicked
 * @returns The rendered toggle element containing the GM and Player buttons
 */
export function PreviewToggle({ mode, onChange }: PreviewToggleProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/40 bg-muted/20 p-1">
      <Button
        size="sm"
        variant={mode === "gm" ? "default" : "ghost"}
        className={cn("min-h-11 gap-1.5 px-3 text-xs", mode === "gm" && "shadow-sm")}
        onClick={() => onChange("gm")}
      >
        <Shield className="h-3.5 w-3.5" />
        GM
      </Button>
      <Button
        size="sm"
        variant={mode === "player" ? "default" : "ghost"}
        className={cn("min-h-11 gap-1.5 px-3 text-xs", mode === "player" && "shadow-sm")}
        onClick={() => onChange("player")}
      >
        <Eye className="h-3.5 w-3.5" />
        Player
      </Button>
    </div>
  );
}
