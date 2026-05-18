import { describe, it, expect } from "vitest";
import { parseGeolocation, getMapDimensions, getMapImageNoteId, notesToPins } from "./map-utils";
import type { EtapiNote } from "./etapi-server";

function makeNote(overrides: Partial<EtapiNote> = {}): EtapiNote {
    return {
        noteId: "test1",
        title: "Test Note",
        type: "text",
        mime: "text/html",
        isProtected: false,
        dateCreated: "2026-01-01",
        dateModified: "2026-01-01",
        utcDateModified: "2026-01-01T00:00:00Z",
        parentNoteIds: [],
        childNoteIds: [],
        parentBranchIds: [],
        childBranchIds: [],
        attributes: [],
        ...overrides,
    };
}

describe("parseGeolocation", () => {
    it("parses valid x,y coordinates", () => {
        expect(parseGeolocation("150, 300")).toEqual({ x: 150, y: 300 });
    });

    it("handles decimals", () => {
        expect(parseGeolocation("150.5, 300.7")).toEqual({ x: 150.5, y: 300.7 });
    });

    it("handles no whitespace", () => {
        expect(parseGeolocation("100,200")).toEqual({ x: 100, y: 200 });
    });

    it("returns null for invalid input", () => {
        expect(parseGeolocation("not coords")).toBeNull();
        expect(parseGeolocation("")).toBeNull();
        expect(parseGeolocation("150")).toBeNull();
    });

    it("returns null for NaN values", () => {
        expect(parseGeolocation("abc, 200")).toBeNull();
        expect(parseGeolocation("100, def")).toBeNull();
    });

    it("returns null for too many parts", () => {
        expect(parseGeolocation("100, 200, 300")).toBeNull();
    });
});

describe("getMapDimensions", () => {
    it("returns dimensions when both mapWidth and mapHeight are present", () => {
        const note = makeNote({
            attributes: [
                { attributeId: "a1", noteId: "test1", type: "label", name: "mapWidth", value: "2000", isInheritable: false },
                { attributeId: "a2", noteId: "test1", type: "label", name: "mapHeight", value: "1500", isInheritable: false },
            ],
        });
        expect(getMapDimensions(note)).toEqual({ width: 2000, height: 1500 });
    });

    it("returns null when attributes are missing", () => {
        const note = makeNote({ attributes: [] });
        expect(getMapDimensions(note)).toBeNull();
    });

    it("returns null when only one dimension is present", () => {
        const note = makeNote({
            attributes: [
                { attributeId: "a1", noteId: "test1", type: "label", name: "mapWidth", value: "2000", isInheritable: false },
            ],
        });
        expect(getMapDimensions(note)).toBeNull();
    });

    it("returns null for non-numeric values", () => {
        const note = makeNote({
            attributes: [
                { attributeId: "a1", noteId: "test1", type: "label", name: "mapWidth", value: "wide", isInheritable: false },
                { attributeId: "a2", noteId: "test1", type: "label", name: "mapHeight", value: "tall", isInheritable: false },
            ],
        });
        expect(getMapDimensions(note)).toBeNull();
    });
});

describe("getMapImageNoteId", () => {
    it("returns the mapImage relation target", () => {
        const note = makeNote({
            attributes: [
                { attributeId: "a1", noteId: "test1", type: "relation", name: "mapImage", value: "img123", isInheritable: false },
            ],
        });
        expect(getMapImageNoteId(note)).toBe("img123");
    });

    it("returns null when no mapImage relation exists", () => {
        const note = makeNote({ attributes: [] });
        expect(getMapImageNoteId(note)).toBeNull();
    });

    it("ignores label attributes named mapImage", () => {
        const note = makeNote({
            attributes: [
                { attributeId: "a1", noteId: "test1", type: "label", name: "mapImage", value: "img123", isInheritable: false },
            ],
        });
        expect(getMapImageNoteId(note)).toBeNull();
    });
});

describe("notesToPins", () => {
    it("converts notes with geolocation to pins", () => {
        const notes = [
            makeNote({
                noteId: "loc1",
                title: "Castle Reach",
                attributes: [
                    { attributeId: "a1", noteId: "loc1", type: "label", name: "geolocation", value: "100, 200", isInheritable: false },
                    { attributeId: "a2", noteId: "loc1", type: "label", name: "loreType", value: "location", isInheritable: false },
                ],
            }),
        ];
        const pins = notesToPins(notes);
        expect(pins).toHaveLength(1);
        expect(pins[0]).toEqual({
            noteId: "loc1",
            title: "Castle Reach",
            loreType: "location",
            x: 100,
            y: 200,
        });
    });

    it("skips notes without geolocation", () => {
        const notes = [makeNote({ noteId: "n1", title: "No Geo", attributes: [] })];
        expect(notesToPins(notes)).toHaveLength(0);
    });

    it("skips notes with invalid geolocation", () => {
        const notes = [
            makeNote({
                noteId: "bad",
                title: "Bad Coords",
                attributes: [
                    { attributeId: "a1", noteId: "bad", type: "label", name: "geolocation", value: "not,valid", isInheritable: false },
                ],
            }),
        ];
        expect(notesToPins(notes)).toHaveLength(0);
    });

    it("escapes HTML in titles", () => {
        const notes = [
            makeNote({
                noteId: "xss",
                title: '<script>alert("xss")</script>',
                attributes: [
                    { attributeId: "a1", noteId: "xss", type: "label", name: "geolocation", value: "50, 50", isInheritable: false },
                ],
            }),
        ];
        const pins = notesToPins(notes);
        expect(pins[0].title).not.toContain("<script>");
        expect(pins[0].title).toContain("&lt;script&gt;");
    });

    it("escapes ampersands and quotes in titles", () => {
        const notes = [
            makeNote({
                noteId: "esc",
                title: 'Tom & "Jerry"',
                attributes: [
                    { attributeId: "a1", noteId: "esc", type: "label", name: "geolocation", value: "10, 20", isInheritable: false },
                ],
            }),
        ];
        const pins = notesToPins(notes);
        expect(pins[0].title).toBe("Tom &amp; &quot;Jerry&quot;");
    });

    it("returns null loreType when attribute is absent", () => {
        const notes = [
            makeNote({
                noteId: "noType",
                title: "Unnamed Place",
                attributes: [
                    { attributeId: "a1", noteId: "noType", type: "label", name: "geolocation", value: "0, 0", isInheritable: false },
                ],
            }),
        ];
        const pins = notesToPins(notes);
        expect(pins[0].loreType).toBeNull();
    });
});
