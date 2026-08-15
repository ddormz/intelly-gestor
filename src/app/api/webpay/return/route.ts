import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invoices, orderEmailDeliveries } from "@/db/schema";
import { commitWebpayTransaction } from "@/features/integrations/webpay";
import { markOrderPaid } from "@/features/orders/service";
import { findPublicOrder } from "@/features/orders/service";
import { issueInvoice } from "@/features/billing/emission";
import { sendInvoiceEmail } from "@/features/billing/service";
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

        // Auto-emisión de Factura Electrónica y auto-envío por correo
        try {
          const emissionResult = await issueInvoice(order.id, "system-webpay");
          if (emissionResult.kind === "issued") {
            const db = getDb();
            const [createdInvoice] = await db
              .select({ id: invoices.id })
              .from(invoices)
              .where(eq(invoices.paymentOrderId, order.id))
              .orderBy(desc(invoices.createdAt))
              .limit(1)
              .execute();

            // Priorizar el correo al que se le despachó la orden originalmente
            const [latestDelivery] = await db
              .select({ recipient: orderEmailDeliveries.recipient })
              .from(orderEmailDeliveries)
              .where(and(
                eq(orderEmailDeliveries.paymentOrderId, order.id),
                eq(orderEmailDeliveries.status, "sent")
              ))
              .orderBy(desc(orderEmailDeliveries.createdAt))
              .limit(1)
              .execute();

            const targetEmail = latestDelivery?.recipient || order.clientEmail;

            if (createdInvoice && targetEmail) {
              await sendInvoiceEmail(createdInvoice.id, "system-webpay", targetEmail);
            }
          }
        } catch (autoFiscalError) {
          console.error("Auto invoice / email error after Webpay payment:", autoFiscalError);
          await writeAudit({
            actorType: "system",
            action: "order.auto_invoice_failed",
            entityType: "payment_order",
            entityId: order.id,
            metadata: {
              error: autoFiscalError instanceof Error ? autoFiscalError.message : "Error al auto-emitir factura",
            },
          });
        }
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
