"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useQuery } from "@tanstack/react-query";
import { Book, LayoutDashboard, BrainCircuit, Search, Wand2, Network, Swords } from "lucide-react";

/**
 * Render a command palette dialog that provides keyboard-accessible navigation and AI tool commands.
 *
 * The palette toggles with the Cmd/Ctrl+K shortcut, allows searching, and runs navigation commands that close the dialog and navigate to the selected route.
 *
 * @returns A JSX element rendering the command palette dialog
 */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const runCommand = React.useCallback((command: () => unknown) => {
    setOpen(false);
    command();
  }, []);

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Type a command or search..." />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Navigation">
          <CommandItem onSelect={() => runCommand(() => router.push("/"))}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/lore"))}>
            <Book className="mr-2 h-4 w-4" />
            <span>Lore Browser</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/brain-dump"))}>
            <BrainCircuit className="mr-2 h-4 w-4" />
            <span>Brain Dump</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/quests"))}>
            <Swords className="mr-2 h-4 w-4" />
            <span>Quests</span>
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Automated Tools">
          <CommandItem onSelect={() => runCommand(() => router.push("/ai/consistency"))}>
            <Search className="mr-2 h-4 w-4" />
            <span>Consistency Checker</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/ai/gaps"))}>
            <Wand2 className="mr-2 h-4 w-4" />
            <span>Gap Detector</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => router.push("/ai/relationships"))}>
            <Network className="mr-2 h-4 w-4" />
            <span>Relationship Map</span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
