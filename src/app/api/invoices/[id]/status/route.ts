import { NextResponse } from "next/server";
import { refreshInvoiceStatus } from "@/features/billing/emission";
import { requireUser } from "@/features/auth/session";
import { AppError, safeError } from "@/lib/errors";

export const runtime = "nodejs";

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  try {
    const { id } = await params;
    const result = await refreshInvoiceStatus(id, user.userId);
    return NextResponse.json({ success: true, result }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = safeError(error);
    return NextResponse.json({ success: false, code: safe.code, message: safe.message, correlationId: safe.correlationId }, { status: error instanceof AppError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
  }
}
