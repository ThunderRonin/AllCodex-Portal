import { z } from "zod";

export const CanonicalRelationshipTypeSchema = z.enum([
  "ally",
  "enemy",
  "rival",
  "family",
  "member_of",
  "leader_of",
  "serves",
  "located_in",
  "originates_from",
  "participated_in",
  "caused",
  "created",
  "owns",
  "wields",
  "worships",
  "inhabits",
  "related_to",
]);

export const ChatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1),
});

export const ConsistencyIssueSchema = z.object({
  type: z.enum(["contradiction", "timeline", "orphan", "naming", "logic", "power"]),
  severity: z.enum(["high", "medium", "low"]),
  description: z.string(),
  affectedNoteIds: z.array(z.string()),
});

export const ConsistencyResultSchema = z.object({
  issues: z.array(ConsistencyIssueSchema),
  summary: z.string(),
});

export const GapAreaSchema = z.object({
  area: z.string(),
  severity: z.enum(["high", "medium", "low"]),
  description: z.string(),
  suggestion: z.string(),
});

export const GapResultSchema = z.object({
  gaps: z.array(GapAreaSchema),
  summary: z.string(),
  typeCounts: z.record(z.string(), z.number()).optional(),
  totalNotes: z.number().optional(),
});

export const RelationshipSuggestionSchema = z.object({
  targetNoteId: z.string(),
  targetTitle: z.string().optional(),
  relationshipType: z.enum(["ally", "enemy", "rival", "family", "member_of", "leader_of", "serves", "located_in", "originates_from", "participated_in", "caused", "created", "owns", "wields", "worships", "inhabits", "related_to"]),
  description: z.string(),
  confidence: z.enum(["high", "medium", "low"]).optional(),
});

export const RelationshipsResultSchema = z.object({
  suggestions: z.array(RelationshipSuggestionSchema),
});

export const AppliedRelationshipSchema = z.object({
  sourceNoteId: z.string(),
  targetNoteId: z.string(),
  relationshipType: CanonicalRelationshipTypeSchema,
  relationName: z.string(),
});

export const SkippedRelationshipSchema = z.object({
  sourceNoteId: z.string(),
  targetNoteId: z.string(),
  relationshipType: CanonicalRelationshipTypeSchema,
  reason: z.string(),
});

export const FailedRelationshipSchema = z.object({
  sourceNoteId: z.string(),
  targetNoteId: z.string(),
  relationshipType: CanonicalRelationshipTypeSchema,
  error: z.string(),
});

export const ApplyRelationshipsResultSchema = z.object({
  applied: z.array(AppliedRelationshipSchema),
  skipped: z.array(SkippedRelationshipSchema),
  failed: z.array(FailedRelationshipSchema),
});

export const CopilotLabelOpSchema = z.object({
  name: z.string().min(1),
  value: z.string(),
});

export const CopilotRelationAddSchema = z.object({
  relationshipType: CanonicalRelationshipTypeSchema,
  targetId: z.string().min(1),
  targetKind: z.enum(["existing", "new"]),
  description: z.string().optional(),
  bidirectional: z.boolean().optional(),
});

export const CopilotRelationDeleteSchema = z.object({
  relationshipType: CanonicalRelationshipTypeSchema,
  targetId: z.string().min(1),
});

export const CopilotProposalTargetSchema = z.object({
  kind: z.enum(["update", "create"]),
  targetId: z.string().min(1),
  title: z.string().min(1).optional(),
  loreType: z.string().min(1).optional(),
  contentHtml: z.string().optional(),
  labelUpserts: z.array(CopilotLabelOpSchema).default([]),
  labelDeletes: z.array(z.string().min(1)).default([]),
  relationAdds: z.array(CopilotRelationAddSchema).default([]),
  relationDeletes: z.array(CopilotRelationDeleteSchema).default([]),
  rationale: z.string().min(1),
}).superRefine((target, ctx) => {
  if (target.kind === "create" && !target.loreType) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["loreType"],
      message: "Create targets must include loreType.",
    });
  }
});

export const CopilotProposalSchema = z.object({
  targets: z.array(CopilotProposalTargetSchema),
});

export const CopilotCitationSchema = z.object({
  noteId: z.string(),
  title: z.string(),
  source: z.enum(["current", "linked", "rag"]),
});

export const CopilotChatResponseSchema = z.object({
  sessionId: z.string().optional(),
  assistantMessage: z.string(),
  citations: z.array(CopilotCitationSchema),
  proposal: CopilotProposalSchema.nullable(),
});

export const CopilotApplyResultSchema = z.object({
  updatedNoteIds: z.array(z.string()),
  createdNoteIds: z.array(z.string()),
  skipped: z.array(z.string()),
  failed: z.array(z.string()).optional(),
});

export const CopilotNoteLabelSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const CopilotNoteRelationSchema = z.object({
  name: z.string(),
  targetNoteId: z.string(),
  description: z.string().optional(),
});

export const CopilotNoteContextSchema = z.object({
  noteId: z.string(),
  title: z.string(),
  loreType: z.string(),
  contentHtml: z.string(),
  parentNoteIds: z.array(z.string()),
  labels: z.array(CopilotNoteLabelSchema),
  relations: z.array(CopilotNoteRelationSchema),
});

export const CopilotRagChunkSchema = z.object({
  noteId: z.string(),
  title: z.string(),
  excerpt: z.string(),
  score: z.number(),
});

export const CopilotRequestSchema = z.object({
  noteId: z.string(),
  sessionId: z.string().optional(),
  transcript: z.array(ChatMessageSchema),
  currentNote: CopilotNoteContextSchema,
  linkedNotes: z.array(CopilotNoteContextSchema),
  ragContext: z.array(CopilotRagChunkSchema),
  writableTargetIds: z.array(z.string()),
});

export const BrainDumpEntitySchema = z.object({
  noteId: z.string(),
  title: z.string(),
  type: z.string(),
});

export const BrainDumpDuplicateSchema = z.object({
  proposedTitle: z.string(),
  proposedType: z.string(),
  matches: z.array(z.object({ noteId: z.string(), title: z.string(), score: z.number() })),
});

export const BrainDumpResultSchema = z
  .object({
    mode: z.literal("auto").optional(),
    summary: z.string(),
    created: z.array(BrainDumpEntitySchema),
    updated: z.array(BrainDumpEntitySchema),
    skipped: z.array(z.object({ title: z.string(), reason: z.string() })),
    duplicates: z.array(BrainDumpDuplicateSchema).optional(),
  })
  .passthrough();

export const ProposedEntitySchema = z.object({
  title: z.string(),
  type: z.string(),
  action: z.enum(["create", "update"]),
  content: z.string().optional(),
  existingNoteId: z.string().optional(),
});

export const BrainDumpReviewResultSchema = z.object({
  mode: z.literal("review"),
  summary: z.string(),
  proposedEntities: z.array(ProposedEntitySchema),
  duplicates: z.array(BrainDumpDuplicateSchema).optional(),
}).passthrough();

export const BrainDumpInboxResultSchema = z.object({
  mode: z.literal("inbox"),
  queued: z.literal(true),
}).passthrough();

export const BrainDumpAnyResultSchema = z.union([
  BrainDumpReviewResultSchema,
  BrainDumpInboxResultSchema,
  BrainDumpResultSchema,
]);

export const GraphNodeSchema = z.object({
  noteId: z.string(),
  title: z.string(),
  loreType: z.string(),
  depth: z.number(),
});

export const GraphEdgeSchema = z.object({
  sourceNoteId: z.string(),
  targetNoteId: z.string(),
  relationshipType: CanonicalRelationshipTypeSchema,
});

export const GraphResponseSchema = z.object({
  nodes: z.array(GraphNodeSchema),
  edges: z.array(GraphEdgeSchema),
  centerNoteId: z.string(),
  maxDepthReached: z.number(),
  truncated: z.boolean(),
});

export const RelationHistoryEntrySchema = z.object({
  id: z.string(),
  sourceNoteId: z.string(),
  targetNoteId: z.string(),
  type: z.string(),
  relationName: z.string().nullable(),
  description: z.string().nullable(),
  createdAt: z.string(),
});

export const RelationHistoryResponseSchema = z.object({
  entries: z.array(RelationHistoryEntrySchema),
});

// Derived TypeScript types — replace manual interfaces in allknower-server.ts
export type ConsistencyResult = z.infer<typeof ConsistencyResultSchema>;
export type GapResult = z.infer<typeof GapResultSchema>;
export type RelationshipSuggestion = z.infer<typeof RelationshipSuggestionSchema>;
export type RelationshipsResult = z.infer<typeof RelationshipsResultSchema>;
export type ApplyRelationshipsResult = z.infer<typeof ApplyRelationshipsResultSchema>;
export type CanonicalRelationshipType = z.infer<typeof CanonicalRelationshipTypeSchema>;
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type CopilotLabelOp = z.infer<typeof CopilotLabelOpSchema>;
export type CopilotRelationAdd = z.infer<typeof CopilotRelationAddSchema>;
export type CopilotRelationDelete = z.infer<typeof CopilotRelationDeleteSchema>;
export type CopilotProposalTarget = z.infer<typeof CopilotProposalTargetSchema>;
export type CopilotProposal = z.infer<typeof CopilotProposalSchema>;
export type CopilotCitation = z.infer<typeof CopilotCitationSchema>;
export type CopilotChatResponse = z.infer<typeof CopilotChatResponseSchema>;
export type CopilotApplyResult = z.infer<typeof CopilotApplyResultSchema>;
export type CopilotNoteContext = z.infer<typeof CopilotNoteContextSchema>;
export type CopilotRagChunk = z.infer<typeof CopilotRagChunkSchema>;
export type CopilotRequest = z.infer<typeof CopilotRequestSchema>;
export type BrainDumpResult = z.infer<typeof BrainDumpResultSchema>;
export type BrainDumpReviewResult = z.infer<typeof BrainDumpReviewResultSchema>;
export type BrainDumpInboxResult = z.infer<typeof BrainDumpInboxResultSchema>;
export type BrainDumpAnyResult = z.infer<typeof BrainDumpAnyResultSchema>;
export type ProposedEntity = z.infer<typeof ProposedEntitySchema>;
export type GraphNode = z.infer<typeof GraphNodeSchema>;
export type GraphEdge = z.infer<typeof GraphEdgeSchema>;
export type GraphResponse = z.infer<typeof GraphResponseSchema>;
export type RelationHistoryEntry = z.infer<typeof RelationHistoryEntrySchema>;
