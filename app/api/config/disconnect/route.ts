/**
 * DELETE /api/config/disconnect
 *
 * Clears the stored credentials cookies for one or both services.
 * Query param `service` = "allcodex" | "allknower" | "all" (default: "all")
 */

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function DELETE(req: NextRequest) {
  const service = req.nextUrl.searchParams.get("service") ?? "all";
  const jar = await cookies();

  if (service === "allcodex" || service === "all") {
    jar.delete("allcodex_url");
    jar.delete("allcodex_token");
  }
  if (service === "allknower" || service === "all") {
    jar.delete("allknower_url");
    jar.delete("allknower_token");
  }

  return NextResponse.json({ disconnected: service });
}
