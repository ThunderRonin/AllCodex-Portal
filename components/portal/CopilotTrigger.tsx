"use client";

import { Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCopilotStore } from "@/lib/stores/copilot-store";

/**
 * Renders a "Lore Copilot" button that opens the copilot for a specific note when clicked.
 *
 * @param noteId - The identifier of the note to open in the copilot
 * @returns A React element representing the copilot trigger button
 */
export function CopilotTrigger({ noteId }: { noteId: string }) {
  const open = useCopilotStore((state) => state.open);

  return (
    <Button
      variant="outline"
      onClick={() => open(noteId)}
      className="min-h-11 gap-2 border-accent/40 text-accent hover:bg-accent/10"
    >
      <Bot className="h-4 w-4" />
      Lore Copilot
    </Button>
  );
}
