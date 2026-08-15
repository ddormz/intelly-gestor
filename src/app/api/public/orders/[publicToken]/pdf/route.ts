import { createOrderPdfResponse } from "@/features/orders/pdf";
import { findPublicOrderPdf } from "@/features/orders/pdf-service";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  if (publicToken.length < 40 || publicToken.length > 128) return new Response("Orden no encontrada.", { status: 404 });
  const order = await findPublicOrderPdf(publicToken);
  return order ? createOrderPdfResponse(order) : new Response("Orden no encontrada.", { status: 404 });
}
