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

function isImmutableLabel(name: string): boolean {
  return IMMUTABLE_LABEL_NAMES.has(name) || IMMUTABLE_LABEL_PREFIXES.some((prefix) => name.startsWith(prefix));
}

function isSystemRelationName(name: string): boolean {
  return SYSTEM_RELATION_NAMES.has(name) || name.startsWith("share");
}

function getLoreType(note: EtapiNote): string {
  return note.attributes.find((attribute) => attribute.type === "label" && attribute.name === "loreType")?.value ?? "lore";
}

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

function ensureApprovedTargetsExist(proposal: CopilotProposal, approvedTargetIds: string[]) {
  const targetIds = new Set(proposal.targets.map((target) => target.targetId));
  for (const targetId of approvedTargetIds) {
    if (!targetIds.has(targetId)) {
      throw new ServiceError("SERVICE_ERROR", 400, `Approved target ${targetId} is not present in the proposal.`);
    }
  }
}

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

      createdIdMap.set(target.targetId, created.note.noteId);
      createdNoteIds.push(created.note.noteId);
      existingTargets.set(created.note.noteId, created.note);
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
