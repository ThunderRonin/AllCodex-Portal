import type { EtapiNote } from "./etapi-server";

export const THEME_SONG_LABEL_NAME = "themeSongUrl";

export interface ThemeSongEmbed {
  provider: "spotify" | "youtube" | "soundcloud" | "appleMusic";
  sourceUrl: string;
  embedUrl: string;
  title: string;
  height: number;
  externalUrl: string;
}

const SPOTIFY_ENTITY_TYPES = new Set(["track", "album", "playlist", "artist", "episode", "show"]);
const YOUTUBE_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "music.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);
const SOUNDCLOUD_HOSTS = new Set(["soundcloud.com", "www.soundcloud.com"]);
const APPLE_MUSIC_HOSTS = new Set(["music.apple.com", "embed.music.apple.com"]);

/**
 * Extracts the trimmed theme-song label value from a note's attributes.
 *
 * @param note - An object with an `attributes` array to search for the theme song label
 * @returns The trimmed value of the `themeSongUrl` label if present and non-empty, `null` otherwise.
 */
export function getThemeSongUrl(note: Pick<EtapiNote, "attributes">): string | null {
  const themeSongAttr = note.attributes?.find(
    (attribute) => attribute.type === "label" && attribute.name === THEME_SONG_LABEL_NAME && attribute.value.trim(),
  );

  return themeSongAttr?.value?.trim() ?? null;
}

/**
 * Parse a raw theme-song label value into a normalized ThemeSongEmbed for supported providers.
 *
 * Accepts a plain URL or an HTML iframe snippet and recognizes Spotify, YouTube, SoundCloud, and Apple Music links.
 *
 * @param rawValue - The raw label value which may be a URL string or an `<iframe>` HTML snippet; may be `null` or `undefined`.
 * @returns A `ThemeSongEmbed` describing the provider-specific embed and source URLs, or `null` if the input is empty, cannot be normalized/parsed, uses a non-HTTPS scheme, or is from an unsupported host.
 */
export function parseThemeSongUrl(rawValue: string | null | undefined): ThemeSongEmbed | null {
  const candidate = normalizeThemeSongCandidate(rawValue);
  if (!candidate) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }

  if (url.protocol !== "https:") {
    return null;
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname === "open.spotify.com") {
    return parseSpotifyUrl(url);
  }

  if (YOUTUBE_HOSTS.has(hostname)) {
    return parseYouTubeUrl(url);
  }

  if (SOUNDCLOUD_HOSTS.has(hostname)) {
    return parseSoundCloudUrl(url);
  }

  if (APPLE_MUSIC_HOSTS.has(hostname)) {
    return parseAppleMusicUrl(url);
  }

  return null;
}

/**
 * Chooses the canonical storage URL for a theme-song label value.
 *
 * Normalizes and parses `rawValue` (which may be a plain URL or an iframe HTML snippet). If the original input was a Spotify embed URL (hostname `open.spotify.com` with a pathname starting with `/embed/`), returns the provider's `embedUrl`; otherwise returns the provider's `sourceUrl`. Returns `null` when normalization or parsing fails.
 *
 * @param rawValue - The raw label value to normalize and parse (may be `null`/`undefined`, a URL string, or iframe HTML).
 * @returns The chosen storage URL (`embedUrl` for Spotify embed inputs, otherwise `sourceUrl`), or `null` if the input could not be normalized or parsed.
 */
export function getThemeSongStorageUrl(rawValue: string | null | undefined): string | null {
  const candidate = normalizeThemeSongCandidate(rawValue);
  const parsed = parseThemeSongUrl(candidate);
  if (!candidate || !parsed) {
    return null;
  }

  const isEmbedInput = (() => {
    try {
      const url = new URL(candidate);
      return url.hostname.toLowerCase() === "open.spotify.com" && url.pathname.startsWith("/embed/");
    } catch {
      return false;
    }
  })();

  return isEmbedInput ? parsed.embedUrl : parsed.sourceUrl;
}

/**
 * Normalize a candidate theme-song value into a usable URL string.
 *
 * Trims whitespace from `rawValue`; if the trimmed value contains `<` or `>` it is treated as HTML and an `iframe` `src` is extracted, otherwise the trimmed string is returned. Empty or missing input returns `null`.
 *
 * @param rawValue - A raw label value which may be a URL, an iframe HTML snippet, or `null`/`undefined`
 * @returns The normalized URL string extracted from `rawValue`, or `null` if the input is empty or no URL can be obtained
 */
function normalizeThemeSongCandidate(rawValue: string | null | undefined): string | null {
  const trimmed = rawValue?.trim();
  if (!trimmed) {
    return null;
  }

  if (!trimmed.includes("<") && !trimmed.includes(">")) {
    return trimmed;
  }

  return extractIframeSrc(trimmed);
}

/**
 * Extracts the `src` attribute value from an HTML iframe string, if present.
 *
 * @param rawValue - A string that may contain an `<iframe>` element.
 * @returns The trimmed `src` attribute value if an iframe with a non-empty `src` is found, `null` otherwise.
 */
function extractIframeSrc(rawValue: string): string | null {
  if (!/^\s*<iframe\b[\s\S]*<\/iframe>\s*$/i.test(rawValue)) {
    return null;
  }

  const srcMatch = rawValue.match(/\bsrc\s*=\s*(["'])(.*?)\1/i);
  const src = srcMatch?.[2]?.trim();
  return src || null;
}

/**
 * Parse a Spotify URL into a ThemeSongEmbed object.
 *
 * @param url - The URL to parse; supports both regular and `/embed/` forms from open.spotify.com
 * @returns A `ThemeSongEmbed` for the referenced Spotify entity when the URL contains a valid entity type and id, `null` otherwise.
 */
function parseSpotifyUrl(url: URL): ThemeSongEmbed | null {
  const pathParts = url.pathname.split("/").filter(Boolean);
  if (pathParts[0] === "embed") {
    pathParts.shift();
  }

  const [entityType, entityId] = pathParts;
  if (!entityType || !entityId || !SPOTIFY_ENTITY_TYPES.has(entityType)) {
    return null;
  }

  const sourceUrl = `https://open.spotify.com/${entityType}/${entityId}`;
  const compactHeight = entityType === "track" || entityType === "episode";

  return {
    provider: "spotify",
    sourceUrl,
    embedUrl: `https://open.spotify.com/embed/${entityType}/${entityId}`,
    title: "Theme song",
    height: compactHeight ? 152 : 352,
    externalUrl: sourceUrl,
  };
}

/**
 * Parses a YouTube URL and returns a normalized theme-song embed descriptor.
 *
 * Supports short `youtu.be` links, `/embed/{id}` paths, and standard watch URLs with a `v` query parameter; returns `null` if no video id can be determined.
 *
 * @returns A `ThemeSongEmbed` for the referenced YouTube video, or `null` if the URL does not contain a valid video identifier.
 */
function parseYouTubeUrl(url: URL): ThemeSongEmbed | null {
  let videoId: string | null = null;

  if (url.hostname.toLowerCase() === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (url.pathname.startsWith("/embed/")) {
    videoId = url.pathname.split("/").filter(Boolean)[1] ?? null;
  } else {
    videoId = url.searchParams.get("v");
  }

  if (!videoId) {
    return null;
  }

  const sourceHost = url.hostname.toLowerCase() === "youtu.be" ? "www.youtube.com" : url.hostname.toLowerCase();
  const sourceUrl = new URL(`https://${sourceHost}/watch`);
  sourceUrl.searchParams.set("v", videoId);

  return {
    provider: "youtube",
    sourceUrl: sourceUrl.toString(),
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
    title: "Theme song",
    height: 315,
    externalUrl: sourceUrl.toString(),
  };
}

/**
 * Parses a SoundCloud page URL and returns a normalized ThemeSongEmbed.
 *
 * @param url - The URL object pointing to a SoundCloud resource (hostname and pathname used)
 * @returns A `ThemeSongEmbed` with `provider: "soundcloud"`, `sourceUrl`, `embedUrl`, `title`, `height`, and `externalUrl` when the URL contains at least two non-empty path segments; `null` otherwise.
 */
function parseSoundCloudUrl(url: URL): ThemeSongEmbed | null {
  if (url.pathname.split("/").filter(Boolean).length < 2) {
    return null;
  }

  const sourceUrl = new URL(`https://${url.hostname.toLowerCase()}${url.pathname}`);

  return {
    provider: "soundcloud",
    sourceUrl: sourceUrl.toString(),
    embedUrl: `https://w.soundcloud.com/player/?url=${encodeURIComponent(sourceUrl.toString())}`,
    title: "Theme song",
    height: 166,
    externalUrl: sourceUrl.toString(),
  };
}

/**
 * Create a normalized ThemeSongEmbed for an Apple Music URL.
 *
 * @param url - A parsed Apple Music `URL` object whose pathname and optional `i` query parameter will be used to build source and embed links.
 * @returns A `ThemeSongEmbed` containing `provider: "appleMusic"`, `sourceUrl`, `embedUrl`, `externalUrl`, `title`, and `height`; `null` if the URL's path is empty or only "/".
 */
function parseAppleMusicUrl(url: URL): ThemeSongEmbed | null {
  const pathname = url.pathname.replace(/\/+$/, "");
  if (!pathname || pathname === "/") {
    return null;
  }

  const sourceUrl = new URL(`https://music.apple.com${pathname}`);
  const trackId = url.searchParams.get("i");
  if (trackId) {
    sourceUrl.searchParams.set("i", trackId);
  }

  const embedUrl = new URL(`https://embed.music.apple.com${pathname}`);
  if (trackId) {
    embedUrl.searchParams.set("i", trackId);
  }

  return {
    provider: "appleMusic",
    sourceUrl: sourceUrl.toString(),
    embedUrl: embedUrl.toString(),
    title: "Theme song",
    height: 175,
    externalUrl: sourceUrl.toString(),
  };
}
