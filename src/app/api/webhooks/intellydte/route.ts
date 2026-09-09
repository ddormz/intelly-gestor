import { NextResponse } from "next/server";
import { handleIntellyDteWebhook } from "@/features/billing/emission";
import { AppError, safeError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(
    { ok: true, service: "intellydte-webhook", status: "ready", timestamp: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } }
  );
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature =
    request.headers.get("x-intelly-signature") ??
    request.headers.get("x-signature") ??
    request.headers.get("x-intellydte-signature") ??
    request.headers.get("x-hub-signature-256") ??
    request.headers.get("signature");

  const apiKey =
    request.headers.get("x-api-key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

  try {
    const result = apiKey
      ? await handleIntellyDteWebhook(rawBody, signature, undefined, apiKey)
      : await handleIntellyDteWebhook(rawBody, signature);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = safeError(error);
    console.error("[IntellyDTE Webhook Error]:", {
      code: safe.code,
      message: safe.message,
      hasSignature: Boolean(signature),
      hasApiKey: Boolean(apiKey),
      bodyLength: rawBody.length,
    });
    return NextResponse.json(
      { success: false, code: safe.code, message: safe.message, correlationId: safe.correlationId },
      { status: error instanceof AppError ? error.status : 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
