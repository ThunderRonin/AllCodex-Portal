import {
  createAttribute,
  createNote,
  deleteAttribute,
  getNote,
  getNoteContent,
  patchNote,
  putNoteContent,
  searchBacklinks,
  type EtapiAttribute,
  type EtapiCreds,
  type EtapiNote,
} from "@/lib/etapi-server";
import { queryRag } from "@/lib/allknower-server";
import {
  CopilotProposalSchema,
  type ChatMessage,
  type CopilotApplyResult,
  type CopilotNoteContext,
  type CopilotProposal,
} from "@/lib/allknower-schemas";
import { ServiceError } from "@/lib/route-error";

const IMMUTABLE_LABEL_NAMES = new Set([
  "lore",
  "loreType",
  "template",
  "draft",
  "gmOnly",
  "portraitImage",
]);

const IMMUTABLE_LABEL_PREFIXES = ["share"];
const SYSTEM_RELATION_NAMES = new Set([
  "template",
  "portraitImage",
  "shareRoot",
  "shareAlias",
  "shareCredentials",
]);
const MAX_WRITABLE_LINKED_NOTES = 12;

const RELATION_NAME_MAP: Record<string, string[]> = {
  ally: ["ally", "relAlly"],
  enemy: ["enemy", "relEnemy"],
  rival: ["rival"],
  family: ["family", "relFamily"],
  member_of: ["member_of"],
  leader_of: ["leader_of"],
  serves: ["serves"],
  located_in: ["located_in"],
  originates_from: ["originates_from"],
  participated_in: ["participated_in"],
  caused: ["caused"],
  created: ["created"],
  owns: ["owns"],
  wields: ["wields"],
  worships: ["worships"],
  inhabits: ["inhabits"],
  related_to: ["related_to", "relOther", "other"],
};

/**
 * Determine whether a label name is considered immutable for copilot apply operations.
 *
 * @param name - The label name to check against the configured immutable names and prefixes
 * @returns `true` if the label name is immutable (exactly listed or starts with any immutable prefix), `false` otherwise.
 */
function isImmutableLabel(name: string): boolean {
  return IMMUTABLE_LABEL_NAMES.has(name) || IMMUTABLE_LABEL_PREFIXES.some((prefix) => name.startsWith(prefix));
}

/**
 * Determines whether a relation name is treated as a system/internal relation.
 *
 * @param name - The relation name to check
 * @returns `true` if the relation name is a system relation (listed as a system relation or begins with `share`), `false` otherwise
 */
function isSystemRelationName(name: string): boolean {
  return SYSTEM_RELATION_NAMES.has(name) || name.startsWith("share");
}

/**
 * Determine the lore type for a note.
 *
 * Looks for a label attribute named `loreType` and returns its value; defaults to `"lore"` when missing.
 *
 * @param note - The note to inspect for a `loreType` label
 * @returns The note's lore type string, or `"lore"` if no `loreType` label is present
 */
function getLoreType(note: EtapiNote): string {
  return note.attributes.find((attribute) => attribute.type === "label" && attribute.name === "loreType")?.value ?? "lore";
}

/**
 * Builds a Copilot-friendly context object from an Etapi note and its HTML content.
 *
 * Extracts the note's id, title, lore type, parent ids, provided HTML content, label name/value pairs,
 * and relation entries excluding system relations.
 *
 * @param note - The source EtapiNote to extract metadata, labels, and relations from
 * @param contentHtml - The HTML content to include as the note's body
 * @returns A CopilotNoteContext containing `noteId`, `title`, `loreType`, `contentHtml`, `parentNoteIds`, `labels`, and `relations`
 */
function toCopilotContext(note: EtapiNote, contentHtml: string): CopilotNoteContext {
  return {
    noteId: note.noteId,
    title: note.title,
    loreType: getLoreType(note),
    contentHtml,
    parentNoteIds: note.parentNoteIds ?? [],
    labels: note.attributes
      .filter((attribute) => attribute.type === "label")
      .map((attribute) => ({ name: attribute.name, value: attribute.value })),
    relations: note.attributes
      .filter((attribute) => attribute.type === "relation" && !isSystemRelationName(attribute.name))
      .map((attribute) => ({ name: attribute.name, targetNoteId: attribute.value })),
  };
}

/**
 * Load an Etapi note together with its HTML content and produce a Copilot-ready context.
 *
 * If the note cannot be fetched, the function returns `null`. If fetching the note content fails, the returned context will have `contentHtml` set to an empty string.
 *
 * @returns The `CopilotNoteContext` for the note, or `null` if the note could not be loaded.
 */
async function getNoteContext(creds: EtapiCreds, noteId: string): Promise<CopilotNoteContext | null> {
  try {
    const [note, contentHtml] = await Promise.all([
      getNote(creds, noteId),
      getNoteContent(creds, noteId).catch(() => ""),
    ]);
    return toCopilotContext(note, contentHtml);
  } catch {
    return null;
  }
}

/**
 * Loads the specified note and computes a bounded set of related note IDs that are considered writable.
 *
 * The returned `writableIds` contains the current note ID plus direct relation targets from the note (excluding system relations)
 * and backlink notes that themselves have a non-system relation pointing back to the current note. The list is deduplicated
 * and trimmed to at most `MAX_WRITABLE_LINKED_NOTES + 1`.
 *
 * @param currentNoteId - The note ID whose writable scope should be computed
 * @returns An object with `currentNote` (the fetched EtapiNote) and `writableIds` (array of note IDs included in the writable scope)
 */
async function loadWritableNoteIds(creds: EtapiCreds, currentNoteId: string): Promise<{ currentNote: EtapiNote; writableIds: string[] }> {
  const currentNote = await getNote(creds, currentNoteId);
  const relationIds = currentNote.attributes
    .filter((attribute) => attribute.type === "relation" && !isSystemRelationName(attribute.name))
    .map((attribute) => attribute.value);
  const backlinks = await searchBacklinks(creds, currentNoteId);
  const backlinkIds: string[] = [];

  for (const backlink of backlinks.slice(0, MAX_WRITABLE_LINKED_NOTES)) {
    const backlinkNote = await getNote(creds, backlink.noteId).catch(() => null);
    const hasSafeBacklink = backlinkNote?.attributes.some(
      (attribute) =>
        attribute.type === "relation" &&
        attribute.value === currentNoteId &&
        !isSystemRelationName(attribute.name),
    );
    if (hasSafeBacklink) backlinkIds.push(backlink.noteId);
  }

  const writableIds = [
    ...new Set([currentNoteId, ...relationIds, ...backlinkIds]),
  ].slice(0, MAX_WRITABLE_LINKED_NOTES + 1);
  return { currentNote, writableIds };
}

/**
 * Produce a trimmed chat transcript that preserves the most recent messages within configured limits.
 *
 * The result contains at most 12 messages and at most 30,000 total characters of message content, keeping messages in chronological order. When capacity is reached, older messages are dropped; if the newest retained message alone exceeds the remaining character budget it is truncated from the start to fit.
 *
 * @param messages - Full chat message history in chronological order (oldest first)
 * @returns The trimmed list of messages in chronological order meeting the limits described above
 */
export function trimCopilotTranscript(messages: ChatMessage[]): ChatMessage[] {
  const maxMessages = 12;
  const maxChars = 30_000;
  const trimmed: ChatMessage[] = [];
  let usedChars = 0;

  for (let index = messages.length - 1; index >= 0 && trimmed.length < maxMessages; index -= 1) {
    const message = messages[index];
    const remaining = maxChars - usedChars;
    if (remaining <= 0) break;

    if (message.content.length <= remaining) {
      trimmed.unshift(message);
      usedChars += message.content.length;
      continue;
    }

    if (trimmed.length === 0) {
      trimmed.unshift({
        ...message,
        content: message.content.slice(message.content.length - remaining),
      });
    }
    break;
  }

  return trimmed;
}

/**
 * Builds Copilot context for an article by loading the current note, its writable linked notes, and RAG excerpts.
 *
 * @param etapiCreds - Credentials for Etapi used to fetch notes and note content
 * @param akCreds - Credentials for the RAG service (contains `url` and `token`)
 * @param noteId - ID of the current note to load context for
 * @param latestUserMessage - Latest user message used to query RAG; if empty, no RAG query is performed
 * @returns An object containing:
 *   - `currentNote`: the loaded `CopilotNoteContext` for `noteId`
 *   - `linkedNotes`: contexts for writable linked notes (excludes the current note)
 *   - `ragContext`: array of RAG excerpts `{ noteId, title, excerpt, score }` excluding notes in the writable scope
 *   - `writableTargetIds`: the list of note IDs considered writable for this operation
 * @throws ServiceError when the current note context cannot be loaded
 */
export async function loadArticleCopilotContext(
  etapiCreds: EtapiCreds,
  akCreds: { url: string; token: string },
  noteId: string,
  latestUserMessage: string,
) {
  const { currentNote, writableIds } = await loadWritableNoteIds(etapiCreds, noteId);
  const currentContext = await getNoteContext(etapiCreds, currentNote.noteId);
  if (!currentContext) {
    throw new ServiceError("SERVICE_ERROR", 502, `Failed to load current note ${noteId}`);
  }

  const linkedIds = writableIds.filter((id) => id !== noteId);
  const linkedContexts = (await Promise.all(linkedIds.map((id) => getNoteContext(etapiCreds, id)))).filter(
    (value): value is CopilotNoteContext => value !== null,
  );

  const ragResults = latestUserMessage.trim().length > 0
    ? await queryRag(akCreds, latestUserMessage, 8).catch(() => [])
    : [];

  const writableSet = new Set(writableIds);
  const ragContext = ragResults
    .filter((chunk) => !writableSet.has(chunk.noteId))
    .map((chunk) => ({
      noteId: chunk.noteId,
      title: chunk.noteTitle,
      excerpt: chunk.content,
      score: chunk.score,
    }));

  return {
    currentNote: currentContext,
    linkedNotes: linkedContexts,
    ragContext,
    writableTargetIds: writableIds,
  };
}

/**
 * Validates that every approved target ID is present among the proposal's targets.
 *
 * @param proposal - The copilot proposal whose `targets` will be checked
 * @param approvedTargetIds - Target IDs that must exist in `proposal.targets`
 * @throws ServiceError 400 if any ID in `approvedTargetIds` is not found in the proposal
 */
function ensureApprovedTargetsExist(proposal: CopilotProposal, approvedTargetIds: string[]) {
  const targetIds = new Set(proposal.targets.map((target) => target.targetId));
  for (const targetId of approvedTargetIds) {
    if (!targetIds.has(targetId)) {
      throw new ServiceError("SERVICE_ERROR", 400, `Approved target ${targetId} is not present in the proposal.`);
    }
  }
}

/**
 * Validate that a proposal target does not attempt to add or delete immutable labels.
 *
 * @param target - A single copilot proposal target containing `labelUpserts` and `labelDeletes`
 * @throws ServiceError with status 400 if any label being added or deleted is immutable
 */
function ensureMutableLabels(target: CopilotProposal["targets"][number]) {
  for (const label of target.labelUpserts) {
    if (isImmutableLabel(label.name)) {
      throw new ServiceError("SERVICE_ERROR", 400, `Label ${label.name} is immutable in copilot apply.`);
    }
  }
  for (const labelName of target.labelDeletes) {
    if (isImmutableLabel(labelName)) {
      throw new ServiceError("SERVICE_ERROR", 400, `Label ${labelName} is immutable in copilot apply.`);
    }
  }
}

/**
 * Validate that all relation targets referenced by a proposal target are permitted.
 *
 * Ensures every relation in `target.relationAdds` and `target.relationDeletes` either references a created target declared in the proposal (when `targetKind === "new"`) or points to a note ID contained in `writableSet`. For targets with `kind === "create"`, enforces that at least one existing relation add links back to `currentNoteId`.
 *
 * @param target - The proposal target whose relations are being validated.
 * @param currentNoteId - The current article's note ID; required to validate backlinks for created targets.
 * @param writableSet - Set of note IDs that are allowed to be referenced by existing relation targets.
 * @param createTargetIds - Set of proposal-local IDs for targets that will be created; used to validate `targetKind === "new"` relations.
 * @throws ServiceError 400 - If a `new` relation target is not declared in `createTargetIds`.
 * @throws ServiceError 400 - If a non-new relation target references an ID outside `writableSet`.
 * @throws ServiceError 400 - If a `kind === "create"` target does not include an `existing` relation pointing back to `currentNoteId`.
 */
function ensureRelationTargetsInScope(
  target: CopilotProposal["targets"][number],
  currentNoteId: string,
  writableSet: Set<string>,
  createTargetIds: Set<string>,
) {
  for (const relation of [...target.relationAdds, ...target.relationDeletes]) {
    if ("targetKind" in relation && relation.targetKind === "new") {
      if (!createTargetIds.has(relation.targetId)) {
        throw new ServiceError("SERVICE_ERROR", 400, `Relation target ${relation.targetId} does not exist in the approved proposal.`);
      }
      continue;
    }

    if (!writableSet.has(relation.targetId)) {
      throw new ServiceError("SERVICE_ERROR", 400, `Relation target ${relation.targetId} is outside the writable scope.`);
    }
  }

  if (target.kind === "create") {
    const linksBack = target.relationAdds.some(
      (relation) => relation.targetKind === "existing" && relation.targetId === currentNoteId,
    );
    if (!linksBack) {
      throw new ServiceError("SERVICE_ERROR", 400, `New note ${target.targetId} must link back to the current article.`);
    }
  }
}

/**
 * Finds relation attributes whose name corresponds to a relationship type (including its configured aliases) and whose value equals the given target ID.
 *
 * @param attributes - The list of attributes to search
 * @param relationshipType - The semantic relationship type to match; aliases from the relation-name map are also considered
 * @param targetId - The target note ID to match against attribute values
 * @returns An array of relation attributes whose name matches the relationship type or its aliases and whose value is `targetId`
 */
function findMatchingRelationAttributes(
  attributes: EtapiAttribute[],
  relationshipType: string,
  targetId: string,
) {
  const names = RELATION_NAME_MAP[relationshipType] ?? [relationshipType];
  return attributes.filter(
    (attribute) => attribute.type === "relation" && names.includes(attribute.name) && attribute.value === targetId,
  );
}

/**
 * Applies label changes from a proposal target to a note's attributes.
 *
 * For each entry in `target.labelUpserts`, creates a label attribute on `note` if an attribute
 * with the same `name` and `value` does not already exist. For each name in `target.labelDeletes`,
 * deletes all label attributes on `note` whose `name` matches.
 *
 * @param note - The note whose attributes will be modified
 * @param target - The proposal target containing `labelUpserts` and `labelDeletes`
 */
async function upsertLabels(
  creds: EtapiCreds,
  note: EtapiNote,
  target: CopilotProposal["targets"][number],
) {
  const existing = new Set(
    note.attributes
      .filter((attribute) => attribute.type === "label")
      .map((attribute) => `${attribute.name}::${attribute.value}`),
  );

  for (const label of target.labelUpserts) {
    const key = `${label.name}::${label.value}`;
    if (existing.has(key)) continue;
    await createAttribute(creds, {
      noteId: note.noteId,
      type: "label",
      name: label.name,
      value: label.value,
    });
    existing.add(key);
  }

  for (const labelName of target.labelDeletes) {
    const matches = note.attributes.filter(
      (attribute) => attribute.type === "label" && attribute.name === labelName,
    );
    for (const attribute of matches) {
      await deleteAttribute(creds, attribute.attributeId);
    }
  }
}

/**
 * Synchronizes relation attributes on a note according to a proposal target.
 *
 * Deletes relation attributes listed in `target.relationDeletes`, adds relation attributes from
 * `target.relationAdds` unless an equivalent relation already exists, and — when `bidirectional`
 * is set — ensures a reverse relation is present on the target note.
 *
 * @param creds - Etapi credentials/client used to call attribute and note APIs
 * @param note - The note whose relation attributes will be modified
 * @param target - A single proposal target describing relation adds and deletes
 * @param createdIdMap - Map from proposal-local new target IDs to their created note IDs
 * @throws ServiceError when a `relation.targetKind === "new"` cannot be resolved via `createdIdMap`
 */
async function syncRelations(
  creds: EtapiCreds,
  note: EtapiNote,
  target: CopilotProposal["targets"][number],
  createdIdMap: Map<string, string>,
) {
  for (const relation of target.relationDeletes) {
    const matches = findMatchingRelationAttributes(note.attributes, relation.relationshipType, relation.targetId);
    for (const attribute of matches) {
      await deleteAttribute(creds, attribute.attributeId);
    }
  }

  const existingKeys = new Set(
    note.attributes
      .filter((attribute) => attribute.type === "relation")
      .flatMap((attribute) =>
        Object.entries(RELATION_NAME_MAP)
          .filter(([, aliases]) => aliases.includes(attribute.name))
          .map(([relationshipType]) => `${relationshipType}::${attribute.value}`),
      ),
  );

  for (const relation of target.relationAdds) {
    const resolvedTargetId = relation.targetKind === "new"
      ? createdIdMap.get(relation.targetId)
      : relation.targetId;

    if (!resolvedTargetId) {
      throw new ServiceError("SERVICE_ERROR", 400, `Unknown created note target ${relation.targetId}.`);
    }

    const key = `${relation.relationshipType}::${resolvedTargetId}`;
    if (existingKeys.has(key)) continue;

    await createAttribute(creds, {
      noteId: note.noteId,
      type: "relation",
      name: relation.relationshipType,
      value: resolvedTargetId,
    });
    existingKeys.add(key);

    if (relation.bidirectional) {
      const reverseNote = await getNote(creds, resolvedTargetId);
      const reverseExisting = findMatchingRelationAttributes(reverseNote.attributes, relation.relationshipType, note.noteId);
      if (reverseExisting.length === 0) {
        await createAttribute(creds, {
          noteId: resolvedTargetId,
          type: "relation",
          name: relation.relationshipType,
          value: note.noteId,
        });
      }
    }
  }
}

/**
 * Applies a parsed copilot proposal to the writable note graph: creates new notes, patches titles and content, upserts labels, and synchronizes relations across approved targets.
 *
 * Processes approved proposal targets in phases (create -> title -> content -> labels -> relations), records per-target failures, and returns lists of created and updated note IDs plus failed proposal target IDs.
 *
 * @param creds - Etapi credentials used for API operations
 * @param currentNoteId - The note ID serving as the current article / editing context
 * @param rawProposal - Raw proposal payload; will be parsed and validated against the copilot proposal schema
 * @param approvedTargetIds - Subset of proposal target IDs that are authorized to be applied
 * @returns The apply result containing `updatedNoteIds`, `createdNoteIds`, `skipped` (currently always an empty array), and `failed` proposal target IDs
 * @throws ServiceError if validation fails (e.g., an approved update is outside writable scope, immutable labels are modified, relation targets are invalid), or if the current note has no primary parent required for creating sibling notes
 */
export async function applyArticleCopilotProposal(
  creds: EtapiCreds,
  currentNoteId: string,
  rawProposal: unknown,
  approvedTargetIds: string[],
): Promise<CopilotApplyResult> {
  const proposal = CopilotProposalSchema.parse(rawProposal);
  ensureApprovedTargetsExist(proposal, approvedTargetIds);

  const approvedSet = new Set(approvedTargetIds);
  const approvedTargets = proposal.targets.filter((target) => approvedSet.has(target.targetId));
  if (approvedTargets.length === 0) {
    return { updatedNoteIds: [], createdNoteIds: [], skipped: [] };
  }

  const { currentNote, writableIds } = await loadWritableNoteIds(creds, currentNoteId);
  const writableSet = new Set(writableIds);
  const currentParentNoteId = currentNote.parentNoteIds?.[0];

  if (!currentParentNoteId) {
    throw new ServiceError("SERVICE_ERROR", 400, "Current note has no primary parent for sibling note creation.");
  }

  const existingTargets = new Map<string, EtapiNote>();
  for (const noteId of writableIds) {
    const note = noteId === currentNoteId ? currentNote : await getNote(creds, noteId);
    existingTargets.set(noteId, note);
  }

  const createTargetIds = new Set(
    approvedTargets
      .filter((target) => target.kind === "create")
      .map((target) => target.targetId),
  );

  for (const target of approvedTargets) {
    ensureMutableLabels(target);
    if (target.kind === "update" && !writableSet.has(target.targetId)) {
      throw new ServiceError("SERVICE_ERROR", 400, `Target ${target.targetId} is outside the writable scope.`);
    }
    ensureRelationTargetsInScope(target, currentNoteId, writableSet, createTargetIds);
  }

  const createdIdMap = new Map<string, string>();
  const createdNoteIds: string[] = [];
  const updatedNoteIds = new Set<string>();
  const failedTargetIds = new Set<string>();

  for (const target of approvedTargets.filter((item) => item.kind === "create")) {
    try {
      const created = await createNote(creds, {
        parentNoteId: currentParentNoteId,
        title: target.title ?? "Untitled Lore Entry",
        content: "",
      });
      createdIdMap.set(target.targetId, created.note.noteId);
      createdNoteIds.push(created.note.noteId);
      existingTargets.set(created.note.noteId, created.note);

      await createAttribute(creds, {
        noteId: created.note.noteId,
        type: "label",
        name: "lore",
        value: "",
      });
      await createAttribute(creds, {
        noteId: created.note.noteId,
        type: "label",
        name: "loreType",
        value: target.loreType ?? "lore",
      });
    } catch (e) {
      console.error("Failed to create target", target.targetId, e);
      failedTargetIds.add(target.targetId);
    }
  }

  for (const target of approvedTargets) {
    if (failedTargetIds.has(target.targetId)) continue;
    try {
      const resolvedTargetId = target.kind === "create" ? createdIdMap.get(target.targetId)! : target.targetId;
      const note = existingTargets.get(resolvedTargetId);
      if (!note) continue;

      if (target.title && target.title !== note.title) {
        const patched = await patchNote(creds, resolvedTargetId, { title: target.title });
        existingTargets.set(resolvedTargetId, patched);
        updatedNoteIds.add(resolvedTargetId);
      }
    } catch (e) {
      console.error("Failed to update title for target", target.targetId, e);
      failedTargetIds.add(target.targetId);
    }
  }

  for (const target of approvedTargets) {
    if (failedTargetIds.has(target.targetId)) continue;
    try {
      const resolvedTargetId = target.kind === "create" ? createdIdMap.get(target.targetId)! : target.targetId;
      if (typeof target.contentHtml === "string") {
        await putNoteContent(creds, resolvedTargetId, target.contentHtml);
        updatedNoteIds.add(resolvedTargetId);
      }
    } catch (e) {
      console.error("Failed to update content for target", target.targetId, e);
      failedTargetIds.add(target.targetId);
    }
  }

  for (const target of approvedTargets) {
    if (failedTargetIds.has(target.targetId)) continue;
    try {
      const resolvedTargetId = target.kind === "create" ? createdIdMap.get(target.targetId)! : target.targetId;
      const refreshed = await getNote(creds, resolvedTargetId);
      await upsertLabels(creds, refreshed, target);
      if (target.labelUpserts.length > 0 || target.labelDeletes.length > 0) updatedNoteIds.add(resolvedTargetId);
    } catch (e) {
      console.error("Failed to update labels for target", target.targetId, e);
      failedTargetIds.add(target.targetId);
    }
  }

  for (const target of approvedTargets) {
    if (failedTargetIds.has(target.targetId)) continue;
    try {
      const resolvedTargetId = target.kind === "create" ? createdIdMap.get(target.targetId)! : target.targetId;
      const refreshed = await getNote(creds, resolvedTargetId);
      await syncRelations(creds, refreshed, target, createdIdMap);
      if (target.relationAdds.length > 0 || target.relationDeletes.length > 0) updatedNoteIds.add(resolvedTargetId);
    } catch (e) {
      console.error("Failed to update relations for target", target.targetId, e);
      failedTargetIds.add(target.targetId);
    }
  }

  return {
    updatedNoteIds: [...updatedNoteIds],
    createdNoteIds,
    skipped: [],
    failed: [...failedTargetIds],
  };
}
