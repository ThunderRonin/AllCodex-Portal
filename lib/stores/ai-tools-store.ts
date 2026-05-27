import { create } from "zustand";

interface ConsistencyIssue {
  type: "contradiction" | "timeline" | "orphan" | "naming";
  severity: "high" | "medium" | "low";
  description: string;
  affectedNoteIds: string[];
}

interface ConsistencyResult {
  issues: ConsistencyIssue[];
  summary: string;
}

interface Suggestion {
  targetNoteId: string;
  targetTitle: string;
  relationshipType: string;
  description: string;
  confidence?: "high" | "medium" | "low";
}

interface AIToolsState {
  // Consistency
  noteIdInput: string;
  consistencyResult: ConsistencyResult | null;
  setNoteIdInput: (v: string) => void;
  setConsistencyResult: (v: ConsistencyResult | null) => void;

  // Gaps
  gapsEnabled: boolean;
  setGapsEnabled: (v: boolean) => void;

  // Relationships
  relationText: string;
  suggestions: Suggestion[];
  appliedRelations: string[];
  setRelationText: (v: string) => void;
  setSuggestions: (v: Suggestion[]) => void;
  addApplied: (key: string) => void;
  resetApplied: () => void;
}

export const useAIToolsStore = create<AIToolsState>()((set, get) => ({
  // Consistency
  noteIdInput: "",
  consistencyResult: null,
  setNoteIdInput: (noteIdInput) => set({ noteIdInput }),
  setConsistencyResult: (consistencyResult) => set({ consistencyResult }),

  // Gaps
  gapsEnabled: false,
  setGapsEnabled: (gapsEnabled) => set({ gapsEnabled }),

  // Relationships
  relationText: "",
  suggestions: [],
  appliedRelations: [],
  setRelationText: (relationText) => set({ relationText }),
  setSuggestions: (suggestions) => set({ suggestions }),
  addApplied: (key) => set({ appliedRelations: [...get().appliedRelations, key] }),
  resetApplied: () => set({ appliedRelations: [] }),
}));
