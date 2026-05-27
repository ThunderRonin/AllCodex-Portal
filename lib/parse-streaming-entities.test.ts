import { describe, expect, it } from "vitest";
import { parseStreamingEntities } from "./parse-streaming-entities";

describe("parseStreamingEntities", () => {
  it("handles an empty buffer", () => {
    expect(parseStreamingEntities("")).toEqual({ completed: [], partial: null });
  });

  it("returns no entities before the entities array starts", () => {
    expect(parseStreamingEntities('{"summary":"hello"')).toEqual({ completed: [], partial: null });
  });

  it("parses one complete entity", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"Aldric","type":"character","action":"create","content":"King"}]}');

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe("Aldric");
    expect(result.partial).toBeNull();
  });

  it("parses multiple complete entities", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"Aldric","type":"character","action":"create"},{"title":"Valorheim","type":"location","action":"update"}]}');

    expect(result.completed.map((e) => e.title)).toEqual(["Aldric", "Valorheim"]);
  });

  it("detects a partial entity with a partial title", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"Blackst');

    expect(result.partial).toMatchObject({ title: "Blackst" });
  });

  it("detects a partial entity with complete title and partial type", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"Blackstone Keep","type":"loc');

    expect(result.partial).toMatchObject({ title: "Blackstone Keep", type: "loc" });
  });

  it("handles a partial entity with only an opening brace", () => {
    const result = parseStreamingEntities('{"entities":[{');

    expect(result.partial).toEqual({});
  });

  it("handles nested braces inside string values", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"Aldric","type":"character","action":"create","attributes":{"fullName":"Aldric {The Bold}"}},{"title":"Val');

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe("Aldric");
    expect(result.partial).toMatchObject({ title: "Val" });
  });

  it("skips complete objects missing required fields", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"No Type","action":"create"},{"title":"Valid","type":"event","action":"create"}]}');

    expect(result.completed.map((e) => e.title)).toEqual(["Valid"]);
  });

  it("stops at a closed entities array", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"A","type":"character","action":"create"}],"other":[{"title":"B","type":"location"}]}');

    expect(result.completed.map((e) => e.title)).toEqual(["A"]);
  });

  it("preserves content field", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"A","type":"character","action":"create","content":"<p>Body</p>"}]}');

    expect(result.completed[0].content).toBe("<p>Body</p>");
  });

  it("handles mid-HTML truncation in a partial content field", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"A","type":"character","action":"create","content":"<p>Half');

    expect(result.completed).toEqual([]);
    expect(result.partial).toMatchObject({ title: "A", type: "character" });
  });

  it("keeps completed entities when next entity is partial", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"A","type":"character","action":"create"},{"title":"B');

    expect(result.completed.map((e) => e.title)).toEqual(["A"]);
    expect(result.partial).toMatchObject({ title: "B" });
  });

  it("preserves action when present on partial entity", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"A","type":"character","action":"up');

    expect(result.partial).toMatchObject({ title: "A", type: "character", action: "up" });
  });

  it("does not treat braces inside strings as object boundaries", () => {
    const result = parseStreamingEntities('{"entities":[{"title":"A {B}","type":"myth","action":"create"}]}');

    expect(result.completed).toHaveLength(1);
    expect(result.completed[0].title).toBe("A {B}");
  });
});
