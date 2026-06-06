import { describe, expect, it } from "vitest";
import { computeLineDiff, htmlToPlain } from "./diff-helpers";

describe("diff-helpers", () => {
  it("strips HTML tags without regex fallback parsing", () => {
    expect(htmlToPlain("<p>Alpha</p><script>hidden</script><b>Beta</b>")).toBe(" Alpha  hidden  Beta ");
  });

  it("handles malformed HTML tags in fallback parsing", () => {
    expect(htmlToPlain("Alpha <broken Beta")).toBe("Alpha  ");
  });

  it("computes line diffs without adding trailing empty lines", () => {
    expect(computeLineDiff("Alpha\nBeta\n", "Alpha\nGamma\n")).toEqual([
      { type: "unchanged", text: "Alpha" },
      { type: "removed", text: "Beta" },
      { type: "added", text: "Gamma" },
    ]);
  });
});
