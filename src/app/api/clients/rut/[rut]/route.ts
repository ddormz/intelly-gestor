import { NextResponse } from "next/server";
import { requireUser } from "@/features/auth/session";
import { lookupClientRut } from "@/features/clients/rut-lookup";
import { AppError, safeError } from "@/lib/errors";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ rut: string }> }) {
  await requireUser();
  try {
    const { rut } = await params;
    const data = await lookupClientRut(rut);
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = safeError(error);
    const status = error instanceof AppError ? error.status : 502;
    return NextResponse.json({ success: false, code: safe.code, message: safe.message, correlationId: safe.correlationId }, { status, headers: { "Cache-Control": "no-store" } });
  }
}
