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

export function parseStreamingEntities(jsonStr: string): StreamingEntitiesParseResult {
  const completed: StreamingEntity[] = [];
  if (!jsonStr) return { completed, partial: null };

  const entitiesKeyIndex = jsonStr.indexOf('"entities"');
  if (entitiesKeyIndex === -1) return { completed, partial: null };

  const arrayStartIndex = jsonStr.indexOf("[", entitiesKeyIndex);
  if (arrayStartIndex === -1) return { completed, partial: null };

  let braceDepth = 0;
  let inString = false;
  let escapeNext = false;
  let currentObjectStart = -1;
  let partial: PartialEntity | null = null;

  for (let i = arrayStartIndex + 1; i < jsonStr.length; i++) {
    const char = jsonStr[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") {
      if (braceDepth === 0) currentObjectStart = i;
      braceDepth++;
    } else if (char === "}") {
      braceDepth--;
      if (braceDepth === 0 && currentObjectStart !== -1) {
        const rawObj = jsonStr.substring(currentObjectStart, i + 1);
        try {
          const parsed = JSON.parse(rawObj);
          if (parsed && typeof parsed === "object" && parsed.title && parsed.type) {
            completed.push(parsed as StreamingEntity);
          }
        } catch {
          // Ignore malformed completed-looking objects.
        }
        currentObjectStart = -1;
      }
    } else if (char === "]" && braceDepth === 0) {
      break;
    }
  }

  if (braceDepth > 0 && currentObjectStart !== -1) {
    partial = extractPartialEntity(jsonStr.slice(currentObjectStart));
  }

  return { completed, partial };
}
