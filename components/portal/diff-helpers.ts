"use client";

import { diffLines } from "diff";

export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  text: string;
}

function stripHtmlTagsToSpaces(html: string): string {
  let plain = "";
  let insideTag = false;

  for (const char of html) {
    if (char === "<") {
      if (!insideTag) plain += " ";
      insideTag = true;
      continue;
    }

    if (char === ">") {
      insideTag = false;
      continue;
    }

    if (!insideTag) plain += char;
  }

  return plain;
}

function collapseExtraNewlines(text: string): string {
  let collapsed = "";
  let newlineRun = 0;

  for (const char of text) {
    if (char === "\n") {
      newlineRun += 1;
      if (newlineRun <= 2) collapsed += char;
      continue;
    }

    newlineRun = 0;
    collapsed += char;
  }

  return collapsed;
}

export function htmlToPlain(html: string): string {
  if (typeof globalThis.window === "undefined") {
    return stripHtmlTagsToSpaces(html);
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

    return collapseExtraNewlines(doc.body.textContent?.trim() || "");
  } catch {
    return stripHtmlTagsToSpaces(html);
  }
}

export function computeLineDiff(before: string, after: string): DiffLine[] {
  const changes = diffLines(before, after);
  const result: DiffLine[] = [];

  for (const change of changes) {
    const value = change.value.endsWith("\n") ? change.value.slice(0, -1) : change.value;
    const lines = value.split("\n");
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
