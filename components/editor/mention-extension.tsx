import Mention, { type MentionOptions } from "@tiptap/extension-mention";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import tippy, { Instance } from "tippy.js";
import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { createRoot, Root } from "react-dom/client";
import { Badge } from "@/components/ui/badge";

export interface MentionSuggestion {
  noteId: string;
  title: string;
  loreType: string;
}

interface MentionCommand {
  id: string;
  label: string;
}

type MentionRenderProps = SuggestionProps<MentionSuggestion, MentionCommand>;

interface MentionListProps {
  items: MentionSuggestion[];
  command: (payload: MentionCommand) => void;
}

interface MentionListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const MentionList = forwardRef<MentionListHandle, MentionListProps>((props, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item.noteId, label: item.title });
    }
  };

  const upHandler = () => {
    if (props.items.length === 0) return;
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    if (props.items.length === 0) return;
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    if (props.items.length === 0) return;
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }
      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }
      if (event.key === "Enter") {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="z-50 flex w-64 flex-col overflow-hidden rounded-md border border-muted bg-popover p-1 shadow-md">
      {props.items.length ? (
        props.items.map((item: MentionSuggestion, index: number) => (
          <button
            key={item.noteId}
            className={`flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-sm outline-none transition-colors ${
              index === selectedIndex ? "bg-accent text-accent-foreground" : "text-popover-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            onClick={() => selectItem(index)}
          >
            <span className="truncate pr-2 font-medium">{item.title}</span>
            <Badge variant="outline" className="text-[10px] leading-none px-1.5 py-0.5">
              {item.loreType}
            </Badge>
          </button>
        ))
      ) : (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">No matches found</div>
      )}
    </div>
  );
});

MentionList.displayName = "MentionList";

export const mentionExtension = Mention.configure({
  HTMLAttributes: {
    class: "lore-mention",
  },
  renderLabel({ options, node }: { options: MentionOptions; node: ProseMirrorNode }) {
    // When rendered we don't strictly need the @ character if we use CSS to prefix,
    // but default tiptap shows it
    return `${node.attrs.label ?? node.attrs.id}`;
  },
  suggestion: {
    char: "@",
    items: async ({ query }): Promise<MentionSuggestion[]> => {
      if (query.length < 2) return [];
      const res = await fetch(`/api/lore/mention-search?q=${encodeURIComponent(query)}`);
      if (!res.ok) return [];
      return res.json();
    },
    render: () => {
      let popup: Instance[] = [];
      let popupRoot: Root | null = null;
      let popupElement: HTMLDivElement | null = null;
      let mentionListHandle: MentionListHandle | null = null;

      const renderMentionList = (props: MentionRenderProps) => {
        if (!popupElement || !popupRoot) {
          popupElement = document.createElement("div");
          popupRoot = createRoot(popupElement);
        }

        if (!popupRoot) {
          return;
        }

        popupRoot.render(
          <MentionList
            ref={(instance) => {
              mentionListHandle = instance;
            }}
            items={props.items}
            command={props.command}
          />,
        );
      };

      const getReferenceClientRect = (clientRect: MentionRenderProps["clientRect"]) => {
        return () => clientRect?.() ?? new DOMRect();
      };

      return {
        onStart: (props: MentionRenderProps) => {
          if (!props.clientRect) return;

          renderMentionList(props);

          if (!popupElement) return;

          popup = tippy("body", {
            getReferenceClientRect: getReferenceClientRect(props.clientRect),
            appendTo: () => document.body,
            content: popupElement,
            showOnCreate: true,
            interactive: true,
            trigger: "manual",
            placement: "bottom-start",
          });
        },
        onUpdate(props: MentionRenderProps) {
          renderMentionList(props);
          if (!props.clientRect) return;
          popup?.[0]?.setProps({
            getReferenceClientRect: getReferenceClientRect(props.clientRect),
          });
        },
        onKeyDown(props: SuggestionKeyDownProps) {
          if (props.event.key === "Escape") {
            popup?.[0]?.hide();
            return true;
          }
          return mentionListHandle?.onKeyDown(props) ?? false;
        },
        onExit() {
          popup?.[0]?.destroy();
          popupRoot?.unmount();
          popupElement?.remove();
          popupRoot = null;
          popupElement = null;
          mentionListHandle = null;
        },
      };
    },
  },
});
