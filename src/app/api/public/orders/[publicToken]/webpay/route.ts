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

  const t0 = Date.now();
  const env = getEnv();
  const origin = env.APP_URL || new URL(request.url).origin;
  const returnUrl = `${origin}/api/webpay/return?token=${encodeURIComponent(publicToken)}`;

  try {
    const buyOrder = order.number.replace(/[^A-Za-z0-9_-]/g, "-").slice(0, 26);
    const amount = Number(order.total);
    console.log(JSON.stringify({
      scope: "webpay-create-route",
      event: "start",
      orderId: order.id,
      orderNumber: order.number,
      buyOrder,
      amount,
      orderStatus: order.status,
      returnOrigin: origin,
      requestOrigin: new URL(request.url).origin,
    }));
    const webpay = await createWebpayTransaction({
      buyOrder,
      sessionId: order.id,
      amount,
      returnUrl,
    });

    console.log(JSON.stringify({
      scope: "webpay-create-route",
      event: "ok",
      orderId: order.id,
      buyOrder,
      tokenLen: webpay.token.length,
      elapsedMs: Date.now() - t0,
    }));
    return NextResponse.redirect(`${webpay.url}?token_ws=${webpay.token}`, 303);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al iniciar pago en WebPay";
    console.error(JSON.stringify({
      scope: "webpay-create-route",
      event: "failed",
      orderId: order.id,
      error: message,
      elapsedMs: Date.now() - t0,
    }));
    return NextResponse.redirect(`${origin}/orden/${publicToken}?error=${encodeURIComponent(message)}`, 303);
  }
}
