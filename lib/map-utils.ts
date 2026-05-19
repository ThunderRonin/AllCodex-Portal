/**
 * Server-side utilities for GeoMap note rendering.
 * Parses geolocation labels and map metadata from ETAPI notes,
 * producing sanitized MapPin[] for the client MapViewer component.
 */

import type { EtapiNote } from "./etapi-server";
import type { MapPin } from "@/components/portal/MapViewer";

/**
 * Parse a comma-separated geolocation string into numeric x/y coordinates.
 *
 * @param value - Geolocation string in the form "x,y" (whitespace around parts is allowed)
 * @returns The parsed coordinates as `{ x, y }`, or `null` if the input is not a valid `x,y` pair
 */
export function parseGeolocation(value: string): { x: number; y: number } | null {
    const parts = value.split(",").map((s) => s.trim());
    if (parts.length !== 2) return null;
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (isNaN(x) || isNaN(y)) return null;
    return { x, y };
}

/**
 * Extract integer map width and height from an EtapiNote's attributes.
 *
 * @param note - The EtapiNote to read `mapWidth` and `mapHeight` attributes from.
 * @returns An object with `width` and `height` parsed as base-10 integers if both attributes are present and valid integers, `null` otherwise.
 */
export function getMapDimensions(note: EtapiNote): { width: number; height: number } | null {
    const w = note.attributes?.find((a) => a.name === "mapWidth")?.value;
    const h = note.attributes?.find((a) => a.name === "mapHeight")?.value;
    if (!w || !h) return null;
    const width = parseInt(w, 10);
    const height = parseInt(h, 10);
    if (isNaN(width) || isNaN(height)) return null;
    return { width, height };
}

/**
 * Retrieve the related map image note ID from an EtapiNote's attributes.
 *
 * @param note - The EtapiNote to inspect for a `mapImage` relation attribute
 * @returns The `mapImage` relation's `value` (note ID) if found, `null` otherwise
 */
export function getMapImageNoteId(note: EtapiNote): string | null {
    const rel = note.attributes?.find(
        (a) => a.type === "relation" && a.name === "mapImage",
    );
    return rel?.value ?? null;
}

/**
 * Escape HTML special characters in a string to their corresponding HTML entities.
 *
 * @param str - The input string to escape
 * @returns The input with `&`, `<`, `>`, and `"` replaced by `&amp;`, `&lt;`, `&gt;`, and `&quot;` respectively
 */
function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

/**
 * Converts an array of EtapiNote objects into client-ready MapPin entries.
 *
 * Produces one MapPin for each note that has a valid `geolocation` attribute; notes without geolocation or with unparsable coordinates are omitted. Each MapPin contains the source `noteId`, an HTML-escaped `title`, the `loreType` attribute value or `null`, and numeric `x` and `y` coordinates parsed from the `geolocation`.
 *
 * @returns An array of MapPin objects constructed from notes with valid geolocation data.
 */
export function notesToPins(notes: EtapiNote[]): MapPin[] {
    return notes
        .map((note) => {
            const geoLabel = note.attributes?.find((a) => a.name === "geolocation");
            if (!geoLabel) return null;
            const coords = parseGeolocation(geoLabel.value);
            if (!coords) return null;
            return {
                noteId: note.noteId,
                title: escapeHtml(note.title),
                loreType: note.attributes?.find((a) => a.name === "loreType")?.value ?? null,
                x: coords.x,
                y: coords.y,
            };
        })
        .filter((pin): pin is MapPin => pin !== null);
}
