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

interface ScannerState {
  braceDepth: number;
  inString: boolean;
  escapeNext: boolean;
  currentObjectStart: number;
}

interface ExtractResult {
  entities: StreamingEntity[];
  currentObjectStart: number;
  braceDepth: number;
}

function collectEntity(jsonStr: string, start: number, end: number, entities: StreamingEntity[]) {
  const entity = tryParseEntity(jsonStr.substring(start, end + 1));
  if (entity) entities.push(entity);
}

function processChar(
  char: string,
  i: number,
  state: ScannerState,
  jsonStr: string,
  entities: StreamingEntity[],
): "continue" | "break" | undefined {
  if (state.escapeNext) { state.escapeNext = false; return "continue"; }
  if (char === "\\") { state.escapeNext = true; return "continue"; }
  if (char === '"') { state.inString = !state.inString; return "continue"; }
  if (state.inString) return "continue";

  if (char === "{") {
    if (state.braceDepth === 0) state.currentObjectStart = i;
    state.braceDepth++;
    return "continue";
  }
  if (char === "}") {
    state.braceDepth--;
    if (state.braceDepth === 0 && state.currentObjectStart !== -1) {
      collectEntity(jsonStr, state.currentObjectStart, i, entities);
      state.currentObjectStart = -1;
    }
    return "continue";
  }
  if (char === "]" && state.braceDepth === 0) return "break";
  return undefined;
}

function extractCompletedEntities(jsonStr: string, arrayStartIndex: number): ExtractResult {
  const entities: StreamingEntity[] = [];
  const state: ScannerState = { braceDepth: 0, inString: false, escapeNext: false, currentObjectStart: -1 };

  for (let i = arrayStartIndex + 1; i < jsonStr.length; i++) {
    const action = processChar(jsonStr[i], i, state, jsonStr, entities);
    if (action === "break") break;
  }

  return { entities, currentObjectStart: state.currentObjectStart, braceDepth: state.braceDepth };
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
