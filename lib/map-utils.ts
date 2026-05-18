/**
 * Server-side utilities for GeoMap note rendering.
 * Parses geolocation labels and map metadata from ETAPI notes,
 * producing sanitized MapPin[] for the client MapViewer component.
 */

import type { EtapiNote } from "./etapi-server";
import type { MapPin } from "@/components/portal/MapViewer";

export function parseGeolocation(value: string): { x: number; y: number } | null {
    const parts = value.split(",").map((s) => s.trim());
    if (parts.length !== 2) return null;
    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    if (isNaN(x) || isNaN(y)) return null;
    return { x, y };
}

export function getMapDimensions(note: EtapiNote): { width: number; height: number } | null {
    const w = note.attributes?.find((a) => a.name === "mapWidth")?.value;
    const h = note.attributes?.find((a) => a.name === "mapHeight")?.value;
    if (!w || !h) return null;
    const width = parseInt(w, 10);
    const height = parseInt(h, 10);
    if (isNaN(width) || isNaN(height)) return null;
    return { width, height };
}

export function getMapImageNoteId(note: EtapiNote): string | null {
    const rel = note.attributes?.find(
        (a) => a.type === "relation" && a.name === "mapImage",
    );
    return rel?.value ?? null;
}

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

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
