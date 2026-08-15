import { NextResponse } from "next/server";
import { commitWebpayTransaction } from "@/features/integrations/webpay";
import { markOrderPaid } from "@/features/orders/service";
import { findPublicOrder } from "@/features/orders/service";
import { writeAudit } from "@/features/audit/service";
import { getEnv } from "@/lib/env";

export async function GET(request: Request) {
  return handleReturn(request);
}

export async function POST(request: Request) {
  return handleReturn(request);
}

async function handleReturn(request: Request) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const env = getEnv();
  const origin = env.APP_URL || url.origin;

  const publicToken = searchParams.get("token");
  const tokenWs = searchParams.get("token_ws");
  const tbkToken = searchParams.get("TBK_TOKEN") || searchParams.get("tbk_token");

  if (!publicToken) {
    return NextResponse.redirect(`${origin}/`);
  }

  // Si el usuario canceló la compra en el formulario de Transbank
  if (tbkToken || !tokenWs) {
    return NextResponse.redirect(`${origin}/orden/${publicToken}?status=cancelled`);
  }

  try {
    const result = await commitWebpayTransaction(tokenWs);
    const order = await findPublicOrder(publicToken);

    if (result.responseCode === 0) {
      if (order && order.status !== "paid" && order.status !== "invoiced") {
        await markOrderPaid(order.id, "system-webpay", `webpay:${tokenWs}`);
        await writeAudit({
          actorType: "public",
          action: "order.paid_webpay",
          entityType: "payment_order",
          entityId: order.id,
          correlationId: tokenWs,
          metadata: {
            amount: result.amount,
            authorizationCode: result.authorizationCode,
            cardNumber: result.cardDetail?.cardNumber,
            buyOrder: result.buyOrder,
          },
        });
      }

      return NextResponse.redirect(
        `${origin}/orden/${publicToken}?status=paid&auth=${encodeURIComponent(result.authorizationCode ?? "")}&amount=${result.amount}`
      );
    } else {
      return NextResponse.redirect(
        `${origin}/orden/${publicToken}?status=rejected&code=${result.responseCode}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al procesar pago WebPay";
    return NextResponse.redirect(
      `${origin}/orden/${publicToken}?status=error&message=${encodeURIComponent(message)}`
    );
  }
}
