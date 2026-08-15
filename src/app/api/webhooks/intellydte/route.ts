import { NextResponse } from "next/server";
import { handleIntellyDteWebhook } from "@/features/billing/emission";
import { AppError, safeError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const rawBody = await request.text();
  try {
    const result = await handleIntellyDteWebhook(rawBody, request.headers.get("x-intelly-signature"));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = safeError(error);
    return NextResponse.json({ success: false, code: safe.code, message: safe.message, correlationId: safe.correlationId }, { status: error instanceof AppError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
