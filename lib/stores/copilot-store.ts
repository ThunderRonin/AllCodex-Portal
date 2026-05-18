import { create } from "zustand";
import type { ChatMessage, CopilotProposal } from "@/lib/allknower-schemas";

export type CopilotConversation = {
  messages: ChatMessage[];
  pendingProposal: CopilotProposal | null;
  selectedTargetIds: string[];
  sessionId: string | null;
};

export interface CopilotState {
  isOpen: boolean;
  activeNoteId: string | null;
  conversations: Record<string, CopilotConversation>;
  lastError: { message: string } | null;
  
  open: (noteId: string) => void;
  close: () => void;
  setLastError: (error: { message: string } | null) => void;
  
  sendMessage: (noteId: string, content: string) => void;
  setAssistantResponse: (noteId: string, assistantMessage: string, proposal: CopilotProposal | null) => void;
  addMessage: (noteId: string, message: ChatMessage) => void;
  updateLastMessage: (noteId: string, content: string) => void;
  setPendingProposal: (noteId: string, proposal: CopilotProposal | null) => void;

  setSessionId: (noteId: string, sessionId: string) => void;
  dismissProposal: (noteId: string) => void;
  redirectWithInstructions: (noteId: string, instructions: string) => void;
  
  toggleTargetSelection: (noteId: string, targetId: string) => void;
  clearConversation: (noteId: string) => void;
}

export const useCopilotStore = create<CopilotState>()((set, get) => ({
  isOpen: false,
  activeNoteId: null,
  conversations: {},
  lastError: null,

  open: (noteId) => set((state) => {
    const existing = state.conversations[noteId];
    return {
      isOpen: true,
      activeNoteId: noteId,
      conversations: {
        ...state.conversations,
        [noteId]: existing || { messages: [], pendingProposal: null, selectedTargetIds: [], sessionId: null },
      },
    };
  }),

  close: () => set({ isOpen: false }),

  setLastError: (error) => set({ lastError: error }),

  sendMessage: (noteId, content) => set((state) => {
    const conv = state.conversations[noteId] || { messages: [], pendingProposal: null, selectedTargetIds: [], sessionId: null };
    return {
      conversations: {
        ...state.conversations,
        [noteId]: {
          ...conv,
          messages: [...conv.messages, { role: "user", content }],
        },
      },
      lastError: null,
    };
  }),

  setAssistantResponse: (noteId, assistantMessage, proposal) => set((state) => {
    const conv = state.conversations[noteId];
    if (!conv) return state;

    return {
      conversations: {
        ...state.conversations,
        [noteId]: {
          ...conv,
          messages: [...conv.messages, { role: "assistant", content: assistantMessage }],
          pendingProposal: proposal,
          selectedTargetIds: proposal ? proposal.targets.map(t => t.targetId) : [],
        },
      },
    };
  }),

  addMessage: (noteId, message) => set((state) => {
    const conv = state.conversations[noteId] || { messages: [], pendingProposal: null, selectedTargetIds: [], sessionId: null };
    return {
      conversations: {
        ...state.conversations,
        [noteId]: { ...conv, messages: [...conv.messages, message] },
      },
    };
  }),

  updateLastMessage: (noteId, content) => set((state) => {
    const conv = state.conversations[noteId];
    if (!conv?.messages.length) return state;
    const messages = [...conv.messages];
    messages[messages.length - 1] = { ...messages[messages.length - 1], content };
    return {
      conversations: {
        ...state.conversations,
        [noteId]: { ...conv, messages },
      },
    };
  }),

  setPendingProposal: (noteId, proposal) => set((state) => {
    const conv = state.conversations[noteId];
    if (!conv) return state;
    return {
      conversations: {
        ...state.conversations,
        [noteId]: {
          ...conv,
          pendingProposal: proposal,
          selectedTargetIds: proposal ? proposal.targets.map(t => t.targetId) : [],
        },
      },
    };
  }),

  setSessionId: (noteId, sessionId) => set((state) => {
    const conv = state.conversations[noteId];
    if (!conv) return state;
    return {
      conversations: {
        ...state.conversations,
        [noteId]: { ...conv, sessionId },
      },
    };
  }),

  dismissProposal: (noteId) => set((state) => {
    const conv = state.conversations[noteId];
    if (!conv) return state;

    return {
      conversations: {
        ...state.conversations,
        [noteId]: {
          ...conv,
          messages: [...conv.messages, { role: "assistant", content: "User dismissed the proposal without applying." }],
          pendingProposal: null,
          selectedTargetIds: [],
        },
      },
    };
  }),

  redirectWithInstructions: (noteId, instructions) => set((state) => {
    const conv = state.conversations[noteId];
    if (!conv) return state;

    return {
      conversations: {
        ...state.conversations,
        [noteId]: {
          ...conv,
          pendingProposal: null,
          selectedTargetIds: [],
          messages: [
            ...conv.messages,
            { role: "user", content: `I'm rejecting the previous proposal. Instead: ${instructions}` }
          ],
        },
      },
      lastError: null,
    };
  }),

  toggleTargetSelection: (noteId, targetId) => set((state) => {
    const conv = state.conversations[noteId];
    if (!conv) return state;

    const isSelected = conv.selectedTargetIds.includes(targetId);
    return {
      conversations: {
        ...state.conversations,
        [noteId]: {
          ...conv,
          selectedTargetIds: isSelected
            ? conv.selectedTargetIds.filter((id) => id !== targetId)
            : [...conv.selectedTargetIds, targetId],
        },
      },
    };
  }),

  clearConversation: (noteId) => set((state) => {
    const newConversations = { ...state.conversations };
    delete newConversations[noteId];
    return { conversations: newConversations };
  }),
}));
