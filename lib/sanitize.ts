/**
 * Server-safe HTML sanitizer using isomorphic-dompurify.
 * Use before any dangerouslySetInnerHTML to strip scripts and dangerous attributes
 * while preserving standard formatting tags, classes and styles from Trilium HTML.
 */

import DOMPurify from "isomorphic-dompurify";
import { parseStreamingEntities } from "./parse-streaming-entities";

const ALLOWED_TAGS = [
  "a", "abbr", "b", "blockquote", "br", "caption", "cite", "code", "col",
  "colgroup", "dd", "del", "details", "dfn", "div", "dl", "dt", "em",
  "figure", "figcaption", "h1", "h2", "h3", "h4", "h5", "h6", "hr",
  "i", "img", "ins", "kbd", "li", "mark", "ol", "p", "pre", "q", "s",
  "samp", "section", "small", "span", "strong", "sub", "summary", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul", "var",
];

const ALLOWED_ATTR = [
  "href", "src", "alt", "title", "class", "id", "style",
  "width", "height", "colspan", "rowspan", "target", "rel",
  "data-note-id", // Trilium internal link attribute
];

const PORTAL_SAFE_URI_REGEXP = /^(?:https?:|mailto:|#|\/api\/images\/|api\/images\/)/i;

export function normalizeLoreHtmlForPortal(html: string): string {
  return html
    .replace(/src=["'][^"']*\/api\/lore\/([a-zA-Z0-9_]+)\/image["']/gi, 'src="/api/images/$1/image"')
    .replace(/src=["']api\/images\//gi, 'src="/api/images/')
    .replace(/src=["'][^"']*\/api\/images\//gi, 'src="/api/images/');
}

export function sanitizeLoreHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: PORTAL_SAFE_URI_REGEXP,
    FORCE_BODY: true,
  });
}

/**
 * Sanitize HTML for player-safe preview: same as sanitizeLoreHtml but also
 * removes any element that carries the .gm-only CSS class (GM-only content).
 * Runs server-side via DOMPurify + RETURN_DOM to perform real DOM removal.
 */
export function sanitizePlayerView(html: string): string {
  // Sanitize first, get back a live DOM body element
  const body = DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: PORTAL_SAFE_URI_REGEXP,
    FORCE_BODY: true,
    RETURN_DOM: true,
  }) as unknown as Element;

  // Strip every .gm-only element from the sanitized tree
  body.querySelectorAll(".gm-only").forEach((el) => el.remove());

  return body.innerHTML;
}

export type { StreamingEntity as ProposedEntity } from "./parse-streaming-entities";

export function parsePartialEntities(jsonStr: string) {
  return parseStreamingEntities(jsonStr).completed;
}

export { parseStreamingEntities } from "./parse-streaming-entities";
