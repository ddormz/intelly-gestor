import { NextResponse } from "next/server";
import { findPublicOrder } from "@/features/orders/service";
import { createWebpayTransaction } from "@/features/integrations/webpay";
import { getEnv } from "@/lib/env";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ publicToken: string }> }
) {
  const { publicToken } = await params;
  if (publicToken.length < 40 || publicToken.length > 128) {
    return NextResponse.json({ error: "Token inválido" }, { status: 404 });
  }

  const order = await findPublicOrder(publicToken);
  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  if (order.status !== "issued" && order.status !== "draft") {
    return NextResponse.json({ error: "La orden no se encuentra pendiente de pago" }, { status: 409 });
  }

  const env = getEnv();
  const origin = env.APP_URL || new URL(request.url).origin;
  const returnUrl = `${origin}/api/webpay/return?token=${encodeURIComponent(publicToken)}`;

  try {
    const webpay = await createWebpayTransaction({
      buyOrder: order.number.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 26),
      sessionId: order.id,
      amount: Number(order.total),
      returnUrl,
    });

    return NextResponse.redirect(`${webpay.url}?token_ws=${webpay.token}`, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al iniciar pago en WebPay";
    return NextResponse.redirect(`${origin}/orden/${publicToken}?error=${encodeURIComponent(message)}`, 303);
  }
}
