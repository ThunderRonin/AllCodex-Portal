"use client";

import { diffLines } from "diff";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

export function htmlToPlain(html: string): string {
  if (typeof window === "undefined") {
    return html.replace(/<[^>]*>/g, " ");
  }
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    const blockElements = doc.querySelectorAll(
      "p, div, h1, h2, h3, h4, h5, h6, li, ul, ol, br",
    );
    blockElements.forEach((el) => {
      if (el.tagName === "BR") {
        el.replaceWith(doc.createTextNode("\n"));
      } else {
        el.replaceWith(doc.createTextNode("\n" + el.textContent + "\n"));
      }
    });

    return doc.body.textContent?.trim().replace(/\n{3,}/g, "\n\n") || "";
  } catch {
    return html.replace(/<[^>]*>/g, " ");
  }
}

export function computeLineDiff(before: string, after: string): DiffLine[] {
  const changes = diffLines(before, after);
  const result: DiffLine[] = [];

  for (const change of changes) {
    const lines = change.value.replace(/\n$/, "").split("\n");
    let type: DiffLine["type"];
    if (change.added) type = "added";
    else if (change.removed) type = "removed";
    else type = "unchanged";
    for (const text of lines) {
      result.push({ type, text });
    }
  }

  return result;
}
