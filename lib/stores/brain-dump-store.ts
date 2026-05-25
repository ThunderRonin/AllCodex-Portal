import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { ProposedEntity } from "@/lib/allknower-schemas";
import { useNotificationStore } from "@/lib/stores/notification-store";

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
  
  // SSE Streaming State
  isStreaming: boolean;
  streamStatus: { stage: string; message: string } | null;
  streamTokens: string;
  streamError: string | null;
  streamStartedAt: number | null;
  streamTokenCount: number;
  
  // Actions
  setText: (text: string) => void;
  setDumpMode: (mode: DumpMode) => void;
  setSelectedModel: (model: string | null) => void;
  setResult: (result: BrainDumpResultNormalized | null) => void;
  setReviewState: (state: BrainDumpReviewState | null) => void;
  toggleReviewApproval: (idx: number) => void;
  addToInbox: (text: string) => void;
  removeFromInbox: (idx: number) => void;
  toggleExpanded: (id: string) => void;
  setStreamStatus: (status: { stage: string; message: string } | null) => void;
  appendStreamToken: (token: string) => void;
  resetStream: () => void;
  
  // Streaming Actions
  runStreamingIngestion: (rawText: string, model: string | null, queryClient?: any, runConsistencyCheck?: any) => Promise<void>;
  cancelStreamingIngestion: () => void;
}

let activeAbortController: AbortController | null = null;

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
      
      isStreaming: false,
      streamStatus: null,
      streamTokens: "",
      streamError: null,
      streamStartedAt: null,
      streamTokenCount: 0,

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
      
      setStreamStatus: (streamStatus) => set({ streamStatus }),
      appendStreamToken: (token) => set((s) => ({
        streamTokens: s.streamTokens + token,
        streamTokenCount: s.streamTokenCount + 1,
      })),
      resetStream: () => set({
        streamStatus: null,
        streamTokens: "",
        streamError: null,
        streamStartedAt: null,
        streamTokenCount: 0,
      }),

      cancelStreamingIngestion: () => {
        if (activeAbortController) {
          activeAbortController.abort();
          activeAbortController = null;
        }
        set({ isStreaming: false, streamStatus: null, streamStartedAt: null });
        useNotificationStore.getState().addToast({
          type: "info",
          title: "Ingestion Cancelled",
          message: "The brain dump ingestion was cancelled.",
        });
      },

      runStreamingIngestion: async (rawText, model, queryClient, runConsistencyCheck) => {
        const { resetStream, setStreamStatus, appendStreamToken, setResult, setText } = get();
        resetStream();
        set({ isStreaming: true, streamError: null, streamStartedAt: Date.now(), streamTokenCount: 0 });

        const watchId = "brain-dump-" + Date.now();
        useNotificationStore.getState().watch({
          id: watchId,
          kind: "brain-dump",
          title: "Brain Dump",
          href: "/brain-dump",
        });

        if (activeAbortController) {
          activeAbortController.abort();
        }
        const controller = new AbortController();
        activeAbortController = controller;

        try {
          const res = await fetch("/api/brain-dump/stream", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rawText, ...(model && { model }) }),
            signal: controller.signal,
          });

          if (!res.ok || !res.body) {
            throw new Error(`Stream failed: ${res.status}`);
          }

          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";
          let currentEvent = "message";

          const processLine = (rawLine: string) => {
            const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
            if (line.startsWith("event: ")) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith("data: ")) {
              let parsedData: any;
              try {
                parsedData = JSON.parse(line.slice(6));
              } catch {
                parsedData = line.slice(6);
              }

              if (currentEvent === "status") {
                setStreamStatus(parsedData);
              } else if (currentEvent === "token") {
                appendStreamToken(parsedData.content);
              } else if (currentEvent === "done") {
                try {
                  const parsed = JSON.parse(parsedData.raw);
                  const normalized = {
                    mode: "auto" as const,
                    summary: parsed.summary,
                    created: parsed.created ?? [],
                    updated: parsed.updated ?? [],
                    skipped: parsed.skipped ?? [],
                    duplicates: parsed.duplicates,
                  };
                  setResult(normalized);
                  setText("");

                  if (queryClient) {
                    void queryClient.invalidateQueries({ queryKey: ["brain-dump-history"] });
                    void queryClient.invalidateQueries({ queryKey: ["lore"] });
                  }

                  const newNoteIds = [
                    ...normalized.created.map((e: any) => e.noteId),
                    ...normalized.updated.map((e: any) => e.noteId),
                  ];
                  if (runConsistencyCheck && newNoteIds.length > 0) {
                    void runConsistencyCheck(newNoteIds);
                  }

                  useNotificationStore.getState().complete(watchId, {
                    summary: "Created " + normalized.created.length + ", updated " + normalized.updated.length + " lore entries.",
                    href: "/brain-dump",
                  });
                } catch (err) {
                  console.error("[brain-dump-store] failed to parse done payload", err);
                }
              } else if (currentEvent === "error") {
                const errMsg = parsedData.error || "Ingestion failed";
                setStreamStatus({ stage: "error", message: errMsg });
                set({ streamError: errMsg });
                useNotificationStore.getState().fail(watchId, { error: errMsg });
              }

              currentEvent = "message";
            } else if (line === "") {
              currentEvent = "message";
            }
          };

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              buffer += decoder.decode();
              if (buffer.length > 0) {
                for (const line of buffer.split("\n")) {
                  processLine(line);
                }
              }
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              processLine(line);
            }
          }
        } catch (err: any) {
          if (err.name === "AbortError") {
            useNotificationStore.getState().dismiss(watchId);
          } else {
            const errMsg = err instanceof Error ? err.message : "Stream failed";
            setStreamStatus({ stage: "error", message: errMsg });
            set({ streamError: errMsg });
            useNotificationStore.getState().fail(watchId, { error: errMsg });
          }
        } finally {
          set({ isStreaming: false });
          activeAbortController = null;
        }
      },
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
