import { NextResponse } from "next/server";

export type ServiceErrorCode =
  | "NOT_CONFIGURED"
  | "UNAUTHORIZED"
  | "UNREACHABLE"
  | "SERVICE_ERROR";

export class ServiceError extends Error {
  constructor(
    public readonly code: ServiceErrorCode,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = "ServiceError";
  }
}

/** Call in the catch block of every API route handler. */
export function handleRouteError(err: unknown): NextResponse {
  if (err instanceof ServiceError) {
    return NextResponse.json(
      { error: err.code, message: err.message },
      { status: err.httpStatus },
    );
  }
  const msg = String(err);
  if (
    msg.includes("ECONNREFUSED") ||
    msg.includes("fetch failed") ||
    msg.includes("ENOTFOUND") ||
    msg.includes("ETIMEDOUT")
  ) {
    return NextResponse.json(
      { error: "UNREACHABLE", message: "Service is unreachable. Check the URL in Settings." },
      { status: 503 },
    );
  }
  return NextResponse.json({ error: "SERVICE_ERROR", message: msg }, { status: 502 });
}

/** Return this when credentials are missing / not yet configured. */
export function notConfigured(service: "AllCodex" | "AllKnower"): NextResponse {
  return NextResponse.json(
    {
      error: "NOT_CONFIGURED",
      message: `${service} is not connected. Go to Settings to add credentials.`,
    },
    { status: 503 },
  );
}
