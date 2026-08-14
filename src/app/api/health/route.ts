import { NextResponse } from "next/server";
import { databaseHealth } from "@/db";

export async function GET() {
  const available = await databaseHealth();
  return NextResponse.json(
    available
      ? { status: "ok", database: "available" }
      : { status: "degraded", database: "unavailable" },
    {
      status: available ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
