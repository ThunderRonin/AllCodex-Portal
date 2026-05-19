"use client";

import { ReactNode, useEffect } from "react";
import { usePathname } from "next/navigation";
import { ArticleCopilot } from "@/components/portal/ArticleCopilot";
import { useCopilotStore } from "@/lib/stores/copilot-store";

/**
 * Wraps application children and installs a keyboard shortcut to toggle the ArticleCopilot on `/lore` pages.
 *
 * When the user presses Ctrl/Cmd + Shift + K while on a path that starts with `/lore`, the component toggles the copilot:
 * if the copilot is open it closes it; otherwise it opens the copilot for a note. When opening, it uses the current
 * store's `activeNoteId` or extracts an id from URLs matching `/lore/[id]` or `/lore/[id]/edit` (ignoring an id of `"new"`).
 *
 * The component always renders its `children` and the `ArticleCopilot` component.
 */
export function CopilotProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === "k") {
        const isNotePage = pathname.startsWith("/lore");
        if (!isNotePage) return;

        e.preventDefault();
        const store = useCopilotStore.getState();
        if (store.isOpen) {
          store.close();
        } else {
          // Find noteId from URL if we are on a detail or edit page
          let noteId = store.activeNoteId;
          const match = pathname.match(/^\/lore\/([^\/]+)(?:\/edit)?$/);
          if (match && match[1] !== "new") {
            noteId = match[1];
          }
          if (noteId) {
            store.open(noteId);
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [pathname]);

  return (
    <>
      {children}
      <ArticleCopilot />
    </>
  );
}
