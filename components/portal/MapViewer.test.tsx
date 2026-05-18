import { describe, it, expect } from "vitest";
import type { MapPin } from "./MapViewer";

describe("MapViewer types", () => {
    it("MapPin has required fields", () => {
        const pin: MapPin = {
            noteId: "abc",
            title: "Test Location",
            loreType: "location",
            x: 100,
            y: 200,
        };
        expect(pin.noteId).toBe("abc");
        expect(pin.x).toBe(100);
        expect(pin.y).toBe(200);
    });
});
