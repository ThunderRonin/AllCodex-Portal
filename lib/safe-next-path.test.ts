import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-next-path";

describe("safeNextPath", () => {
  it("allows internal paths", () => {
    expect(safeNextPath("/dashboard")).toBe("/dashboard");
    expect(safeNextPath("%2Flore%2Fnote-1%3Fmode%3Dedit")).toBe("/lore/note-1?mode=edit");
  });

  it("falls back for external or unsafe targets", () => {
    expect(safeNextPath(null)).toBe("/dashboard");
    expect(safeNextPath("https://evil.example")).toBe("/dashboard");
    expect(safeNextPath("//evil.example")).toBe("/dashboard");
    expect(safeNextPath("/dashboard%0Ajavascript:alert(1)")).toBe("/dashboard");
    expect(safeNextPath("/dashboard?next=javascript:alert(1)")).toBe("/dashboard");
  });

  it("falls back for malformed encoded input", () => {
    expect(safeNextPath("%E0%A4%A")).toBe("/dashboard");
  });
});
