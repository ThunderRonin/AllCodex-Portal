import type { EtapiNote } from "./etapi-server";

export function isPublicLoreNote(note: EtapiNote): boolean {
  const labels = note.attributes ?? [];
  const isLore = labels.some(
    (attr) => attr.type === "label" && (attr.name === "lore" || attr.name === "loreType"),
  );
  const isDraft = labels.some((attr) => attr.type === "label" && attr.name === "draft");
  const isGmOnly = labels.some((attr) => attr.type === "label" && attr.name === "gmOnly");
  return isLore && !isDraft && !isGmOnly;
}

export function publicLoreSummary(note: EtapiNote) {
  return {
    noteId: note.noteId,
    title: note.title,
    type: note.type,
    loreType: note.attributes?.find((attr) => attr.name === "loreType")?.value ?? null,
    dateModified: note.dateModified,
  };
}
