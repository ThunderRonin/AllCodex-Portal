export interface StreamingEntity {
  title: string;
  type: string;
  action: "create" | "update";
  content?: string;
  existingNoteId?: string;
  attributes?: Record<string, string>;
  tags?: string[];
}

export interface PartialEntity {
  title?: string;
  type?: string;
  action?: string;
}

export interface StreamingEntitiesParseResult {
  completed: StreamingEntity[];
  partial: PartialEntity | null;
}

function extractPartialEntity(raw: string): PartialEntity | null {
  const partial: PartialEntity = {};
  const titleMatch = raw.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)$/)
    ?? raw.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const typeMatch = raw.match(/"type"\s*:\s*"((?:\\.|[^"\\])*)$/)
    ?? raw.match(/"type"\s*:\s*"((?:\\.|[^"\\])*)"/);
  const actionMatch = raw.match(/"action"\s*:\s*"((?:\\.|[^"\\])*)$/)
    ?? raw.match(/"action"\s*:\s*"((?:\\.|[^"\\])*)"/);

  if (titleMatch) partial.title = titleMatch[1];
  if (typeMatch) partial.type = typeMatch[1];
  if (actionMatch) partial.action = actionMatch[1];

  return Object.keys(partial).length > 0 || raw.trim() === "{" ? partial : null;
}

/**
 * Locates the start of the "entities" JSON array in the streamed string.
 * Returns the index of the opening `[`, or -1 if not found.
 */
function findEntitiesArrayStart(jsonStr: string): number {
  const entitiesKeyIndex = jsonStr.indexOf('"entities"');
  if (entitiesKeyIndex === -1) return -1;
  const arrayStartIndex = jsonStr.indexOf("[", entitiesKeyIndex);
  return arrayStartIndex;
}

/**
 * Attempts to parse a raw JSON substring as a StreamingEntity.
 * Returns the entity if valid, or null on parse failure or missing required fields.
 */
function tryParseEntity(raw: string): StreamingEntity | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && parsed.title && parsed.type) {
      return parsed as StreamingEntity;
    }
  } catch {
    // Ignore malformed objects.
  }
  return null;
}

interface ExtractResult {
  entities: StreamingEntity[];
  currentObjectStart: number;
  braceDepth: number;
}

/**
 * Walks the JSON string character-by-character starting after the array
 * opening bracket, extracting fully-formed entity objects and tracking
 * parser state for partial detection.
 */
function extractCompletedEntities(jsonStr: string, arrayStartIndex: number): ExtractResult {
  const entities: StreamingEntity[] = [];
  let braceDepth = 0;
  let inString = false;
  let escapeNext = false;
  let currentObjectStart = -1;

  for (let i = arrayStartIndex + 1; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) { escapeNext = false; continue; }
    if (char === "\\") { escapeNext = true; continue; }
    if (char === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (char === "{") {
      if (braceDepth === 0) currentObjectStart = i;
      braceDepth++;
      continue;
    }

    if (char === "}") {
      braceDepth--;
      if (braceDepth === 0 && currentObjectStart !== -1) {
        const entity = tryParseEntity(jsonStr.substring(currentObjectStart, i + 1));
        if (entity) entities.push(entity);
        currentObjectStart = -1;
      }
      continue;
    }

    if (char === "]" && braceDepth === 0) break;
  }

  return { entities, currentObjectStart, braceDepth };
}

export function parseStreamingEntities(jsonStr: string): StreamingEntitiesParseResult {
  if (!jsonStr) return { completed: [], partial: null };

  const arrayStartIndex = findEntitiesArrayStart(jsonStr);
  if (arrayStartIndex === -1) return { completed: [], partial: null };

  const { entities, currentObjectStart, braceDepth } = extractCompletedEntities(jsonStr, arrayStartIndex);

  let partial: PartialEntity | null = null;
  if (braceDepth > 0 && currentObjectStart !== -1) {
    partial = extractPartialEntity(jsonStr.slice(currentObjectStart));
  }

  return { completed: entities, partial };
}
