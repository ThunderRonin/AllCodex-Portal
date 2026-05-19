import { NextResponse } from "next/server";
import { execFileSync } from "child_process";
import { getAkCreds } from "@/lib/get-creds";

/**
 * Determines whether the repository's current Git branch is named "dev".
 *
 * If the current branch cannot be determined (for example, outside a Git repository or if the Git command fails), this returns `false`.
 *
 * @returns `true` if the current branch is `"dev"`, `false` otherwise.
 */
function isDevBranch(): boolean {
  try {
    return execFileSync("git", ["branch", "--show-current"], { encoding: "utf-8" }).trim() === "dev";
  } catch {
    return false;
  }
}

/**
 * HTTP POST route that triggers an AllKnower config wipe when running on the `dev` git branch and not in production.
 *
 * Attempts to call the AllKnower `/config/wipe` endpoint when credentials are available; otherwise no downstream request is made.
 *
 * @returns A JSON HTTP response:
 * - `{ error: "Not found" }` with status `404` if the environment disallows the operation,
 * - `{ ok: false, error: "AllKnower wipe failed: <status>" }` with status `502` if the downstream wipe returns a non-OK status,
 * - `{ ok: false, error: <message> }` with status `500` on unexpected errors,
 * - `{ ok: true, message: "AllKnower dev data wiped successfully" }` with status `200` on success.
 */
export async function POST() {
  if (process.env.NODE_ENV === "production" || !isDevBranch()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const akCreds = await getAkCreds();

  try {
    if (akCreds.url && akCreds.token) {
      const akRes = await fetch(`${akCreds.url}/config/wipe`, {
        method: "POST",
        headers: { Authorization: `Bearer ${akCreds.token}` },
      });
      if (!akRes.ok) {
        const body = await akRes.text();
        console.error("AllKnower wipe failed:", body);
        return NextResponse.json({ ok: false, error: `AllKnower wipe failed: ${akRes.status}` }, { status: 502 });
      }
    }

    return NextResponse.json({ ok: true, message: "AllKnower dev data wiped successfully" });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
