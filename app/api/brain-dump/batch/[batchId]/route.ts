import { NextRequest, NextResponse } from "next/server";
import { getAkCreds } from "@/lib/get-creds";
import { handleRouteError, notConfigured } from "@/lib/route-error";
import { getBrainDumpBatch, cancelBrainDumpBatch } from "@/lib/allknower-server";

export async function GET(_req: NextRequest, props: { params: Promise<{ batchId: string }> }) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { batchId } = await props.params;
    const result = await getBrainDumpBatch(creds, batchId);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ batchId: string }> }) {
  try {
    const creds = await getAkCreds();
    if (!creds.url || !creds.token) return notConfigured("AllKnower");
    const { batchId } = await props.params;
    const result = await cancelBrainDumpBatch(creds, batchId);
    return NextResponse.json(result);
  } catch (err) {
    return handleRouteError(err);
  }
}
