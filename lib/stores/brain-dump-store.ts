import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProposedEntity } from "@/lib/allknower-server";

export type DumpMode = "auto" | "review" | "inbox";

export interface BrainDumpResultNormalized {
  mode: "auto";
  summary: string;
  created: Array<{ noteId: string; title: string; type: string }>;
  updated: Array<{ noteId: string; title: string; type: string }>;
  skipped: Array<{ title: string; reason: string }>;
  duplicates?: Array<{
    proposedTitle: string;
    proposedType: string;
    matches: Array<{ noteId: string; title: string; score: number }>;
  }>;
}

export interface BrainDumpReviewState {
  summary: string;
  proposedEntities: ProposedEntity[];
  approvedIds: Set<number>;
}

interface BrainDumpState {
  text: string;
  dumpMode: DumpMode;
  selectedModel: string | null;
  result: BrainDumpResultNormalized | null;
  reviewState: BrainDumpReviewState | null;
  inboxItems: string[];
  expandedIds: string[];
  setText: (text: string) => void;
  setDumpMode: (mode: DumpMode) => void;
  setSelectedModel: (model: string | null) => void;
  setResult: (result: BrainDumpResultNormalized | null) => void;
  setReviewState: (state: BrainDumpReviewState | null) => void;
  toggleReviewApproval: (idx: number) => void;
  addToInbox: (text: string) => void;
  removeFromInbox: (idx: number) => void;
  toggleExpanded: (id: string) => void;
  streamStatus: { stage: string; message: string } | null;
  streamTokens: string;
  setStreamStatus: (status: { stage: string; message: string } | null) => void;
  appendStreamToken: (token: string) => void;
  resetStream: () => void;
}

export const useBrainDumpStore = create<BrainDumpState>()(
  persist(
    (set, get) => ({
      text: "",
      dumpMode: "auto",
      selectedModel: null,
      result: null,
      reviewState: null,
      inboxItems: [],
      expandedIds: [],
      setText: (text) => set({ text }),
      setDumpMode: (dumpMode) => set({ dumpMode }),
      setSelectedModel: (selectedModel) => set({ selectedModel }),
      setResult: (result) => set({ result }),
      setReviewState: (reviewState) => set({ reviewState }),
      toggleReviewApproval: (idx) => {
        const { reviewState } = get();
        if (!reviewState) return;
        const next = new Set(reviewState.approvedIds);
        if (next.has(idx)) next.delete(idx);
        else next.add(idx);
        set({ reviewState: { ...reviewState, approvedIds: next } });
      },
      addToInbox: (text) => {
        set({ inboxItems: [...get().inboxItems, text], text: "" });
      },
      removeFromInbox: (idx) => {
        const items = [...get().inboxItems];
        items.splice(idx, 1);
        set({ inboxItems: items });
      },
      toggleExpanded: (id) => {
        const { expandedIds } = get();
        set({
          expandedIds: expandedIds.includes(id)
            ? expandedIds.filter((i) => i !== id)
            : [...expandedIds, id],
        });
      },
      streamStatus: null,
      streamTokens: "",
      setStreamStatus: (streamStatus) => set({ streamStatus }),
      appendStreamToken: (token) => set((s) => ({ streamTokens: s.streamTokens + token })),
      resetStream: () => set({ streamStatus: null, streamTokens: "" }),
    }),
    {
      name: "brain-dump-ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        text: state.text,
        dumpMode: state.dumpMode,
        selectedModel: state.selectedModel,
        inboxItems: state.inboxItems,
      }),
    }
  )
);

