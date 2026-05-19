import { describe, expect, it } from "vitest";
import {
  ConsistencyResultSchema,
  GapResultSchema,
  RelationshipsResultSchema,
  BrainDumpResultSchema,
} from "./allknower-schemas";

describe("ConsistencyResultSchema", () => {
  it("accepts a valid response", () => {
    const input = {
      issues: [
        { type: "contradiction", severity: "high", description: "Aria Vale is both alive and dead.", affectedNoteIds: ["n1", "n2"] },
      ],
      summary: "One contradiction found.",
    };
    expect(() => ConsistencyResultSchema.parse(input)).not.toThrow();
  });

  it("rejects a response missing issues array", () => {
    expect(() => ConsistencyResultSchema.parse({ summary: "ok" })).toThrow();
  });

  it("accepts all valid issue types", () => {
    for (const type of ["contradiction", "timeline", "orphan", "naming", "logic", "power"]) {
      expect(() => ConsistencyResultSchema.parse({
        issues: [{ type, severity: "high", description: "x", affectedNoteIds: [] }],
        summary: "ok",
      })).not.toThrow();
    }
  });
});

describe("GapResultSchema", () => {
  it("accepts a valid response", () => {
    const input = {
      gaps: [{ area: "Factions", severity: "medium", description: "Thin", suggestion: "Add a rival guild" }],
      summary: "One gap found.",
      typeCounts: { character: 5 },
      totalNotes: 10,
    };
    expect(() => GapResultSchema.parse(input)).not.toThrow();
  });

  it("rejects a response missing gaps array", () => {
    expect(() => GapResultSchema.parse({ summary: "ok" })).toThrow();
  });
});

describe("RelationshipsResultSchema", () => {
  it("accepts a valid response", () => {
    const input = {
      suggestions: [
        { targetNoteId: "n1", targetTitle: "Aether Keep", relationshipType: "ally", description: "Allied." },
      ],
    };
    expect(() => RelationshipsResultSchema.parse(input)).not.toThrow();
  });

  it("rejects a response where suggestions is not an array", () => {
    expect(() => RelationshipsResultSchema.parse({ suggestions: "bad" })).toThrow();
  });
});

describe("BrainDumpResultSchema", () => {
  it("accepts a valid auto-mode response", () => {
    const input = {
      summary: "Extracted two entities",
      created: [{ noteId: "n1", title: "Aria Vale", type: "character" }],
      updated: [],
      skipped: [],
    };
    expect(() => BrainDumpResultSchema.parse(input)).not.toThrow();
  });
});
