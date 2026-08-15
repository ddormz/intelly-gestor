import { requireUser } from "@/features/auth/session";
import { createOrderPdfResponse } from "@/features/orders/pdf";
import { findOrderPdf } from "@/features/orders/pdf-service";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const order = await findOrderPdf(id);
  return order ? createOrderPdfResponse(order) : new Response("Orden no encontrada.", { status: 404 });
}
