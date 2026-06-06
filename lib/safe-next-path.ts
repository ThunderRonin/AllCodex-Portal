const DEFAULT_NEXT_PATH = "/dashboard";

export function safeNextPath(rawNext: string | null | undefined): string {
  if (!rawNext) return DEFAULT_NEXT_PATH;

  let next: string;
  try {
    next = decodeURIComponent(rawNext);
  } catch {
    return DEFAULT_NEXT_PATH;
  }

  const lowerNext = next.toLowerCase();
  if (
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("://") ||
    lowerNext.includes("javascript:") ||
    next.includes("\n") ||
    next.includes("\r")
  ) {
    return DEFAULT_NEXT_PATH;
  }

  return next;
}
