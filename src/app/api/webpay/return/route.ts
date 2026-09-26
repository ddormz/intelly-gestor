import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { commitWebpayTransaction } from "@/features/integrations/webpay";
import { markOrderPaid } from "@/features/orders/service";
import { findPublicOrder } from "@/features/orders/service";
import { issueInvoice } from "@/features/billing/emission";
import { sendOrderInvoiceEmailIfNeeded } from "@/features/billing/service";
import { writeAudit } from "@/features/audit/service";
import { getEnv } from "@/lib/env";

export async function GET(request: Request) {
  return handleReturn(request);
}

export async function POST(request: Request) {
  return handleReturn(request);
}

function maskTokenValue(token: string | null): string {
  if (!token) return "missing";
  if (token.length <= 10) return `len=${token.length} last4=${token.slice(-4)}`;
  return `len=${token.length} last6=${token.slice(-6)}`;
}

function returnLog(requestId: string, event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ scope: "webpay-return", requestId, event, ...data }));
}

async function readPostBody(request: Request): Promise<URLSearchParams> {
  const params = new URLSearchParams();
  const method = request.method.toUpperCase();
  if (method !== "POST") return params;
  const contentType = request.headers.get("content-type") ?? "";
  try {
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") params.set(key, value);
      }
      return params;
    }
    // Fallback: Transbank en integración envía el aborto por POST form,
    // pero algunos proxies lo exponen como texto plano.
    const text = await request.text();
    if (!text) return params;
    if (contentType.includes("application/json")) {
      try {
        const json = JSON.parse(text) as Record<string, unknown>;
        for (const [key, value] of Object.entries(json)) {
          if (typeof value === "string" || typeof value === "number") params.set(key, String(value));
        }
        return params;
      } catch {
        return params;
      }
    }
    const parsed = new URLSearchParams(text);
    for (const [key, value] of parsed.entries()) params.set(key, value);
    return params;
  } catch {
    return params;
  }
}

function pickParam(query: URLSearchParams, body: URLSearchParams, ...names: string[]): string | null {
  for (const name of names) {
    const q = query.get(name);
    if (q) return q;
    const b = body.get(name);
    if (b) return b;
  }
  return null;
}

async function handleReturn(request: Request) {
  const t0 = Date.now();
  const requestId = randomUUID().slice(0, 8);
  const url = new URL(request.url);
  const searchParams = url.searchParams;
  const env = getEnv();
  const origin = env.APP_URL || url.origin;

  const bodyParams = await readPostBody(request);
  const method = request.method.toUpperCase();
  const contentType = request.headers.get("content-type") ?? "";

  const publicToken = searchParams.get("token");
  // Éxito (flujo normal o flujo error-con-token): token_ws puede venir por
  // query (GET v1.1+) o por body (POST). Antes solo se leía query y todo
  // éxito por POST se marcaba como cancelled.
  const tokenWs = pickParam(searchParams, bodyParams, "token_ws");
  // Aborto: TBK_TOKEN + TBK_ORDEN_COMPRA + TBK_ID_SESION (GET en prod, POST en integración).
  const tbkToken = pickParam(searchParams, bodyParams, "TBK_TOKEN", "tbk_token");
  // Timeout: solo orden + sesión, sin token.
  const tbkOrden = pickParam(searchParams, bodyParams, "TBK_ORDEN_COMPRA", "TBK_ORDEN_COMPRA".toLowerCase());
  const tbkSesion = pickParam(searchParams, bodyParams, "TBK_ID_SESION", "TBK_ID_SESION".toLowerCase(), "TBK_ID_SESSION");

  returnLog(requestId, "received", {
    method,
    contentType: contentType.slice(0, 80),
    queryKeys: [...searchParams.keys()],
    bodyKeys: [...bodyParams.keys()],
    tokenWs: maskTokenValue(tokenWs),
    tokenWsSource: searchParams.get("token_ws") ? "query" : bodyParams.get("token_ws") ? "body" : "missing",
    tbkToken: maskTokenValue(tbkToken),
    tbkTokenSource: searchParams.get("TBK_TOKEN") ?? searchParams.get("tbk_token") ? "query" : bodyParams.get("TBK_TOKEN") ?? bodyParams.get("tbk_token") ? "body" : "missing",
    hasTbkOrden: Boolean(tbkOrden),
    hasTbkSesion: Boolean(tbkSesion),
    publicTokenLen: publicToken?.length ?? 0,
    publicTokenPrefix: publicToken?.slice(0, 6) ?? "missing",
    originUsed: origin,
    requestOrigin: url.origin,
  });

  if (!publicToken) {
    returnLog(requestId, "no-public-token", { elapsedMs: Date.now() - t0 });
    return NextResponse.redirect(`${origin}/`);
  }

  // Sin token_ws no hay nada que confirmar en Transbank: aborto, timeout o
  // retorno sin token. Se distingue la razón solo para diagnóstico; la UI
  // mantiene ?status=cancelled.
  if (!tokenWs) {
    const reason = tbkToken ? "aborted" : tbkOrden || tbkSesion ? "timeout" : "missing-token";
    returnLog(requestId, "no-token_ws", {
      reason,
      tbkOrden: tbkOrden ?? "missing",
      elapsedMs: Date.now() - t0,
    });
    try {
      const order = await findPublicOrder(publicToken);
      if (order) {
        await writeAudit({
          actorType: "public",
          action: reason === "timeout" ? "order.webpay_timeout" : "order.webpay_aborted",
          entityType: "payment_order",
          entityId: order.id,
          correlationId: tbkToken ?? tbkOrden ?? requestId,
          metadata: {
            reason,
            buyOrder: tbkOrden ?? undefined,
            sessionId: tbkSesion ?? undefined,
          },
        });
      }
    } catch (auditError) {
      returnLog(requestId, "abort-audit-failed", {
        error: auditError instanceof Error ? auditError.message : "unknown",
      });
    }
    return NextResponse.redirect(`${origin}/orden/${publicToken}?status=cancelled&reason=${reason}`);
  }

  try {
    const commitStart = Date.now();
    returnLog(requestId, "commit-start", {
      token: maskTokenValue(tokenWs),
      withTbkToken: Boolean(tbkToken),
      elapsedMs: commitStart - t0,
    });
    const result = await commitWebpayTransaction(tokenWs);
    returnLog(requestId, "commit-ok", {
      responseCode: result.responseCode,
      status: result.status,
      amount: result.amount,
      buyOrder: result.buyOrder,
      elapsedMs: Date.now() - t0,
      commitMs: Date.now() - commitStart,
    });
    const order = await findPublicOrder(publicToken);

    if (result.responseCode === 0) {
      if (order && order.status !== "paid" && order.status !== "invoiced") {
        // createdBy es un users.id real: recorded_by/updated_by/actor_user_id
        // tienen FK a users y "system-webpay" la violaba (cargo hecho, registro fallido).
        const effectiveUserId = order.createdBy;
        await markOrderPaid(order.id, effectiveUserId, `webpay:${tokenWs}`, {
          method: "external",
          externalReference: `webpay:${tokenWs}`,
        });
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
        returnLog(requestId, "order-marked-paid", { orderId: order.id, elapsedMs: Date.now() - t0 });

        // Auto-emisión de Factura Electrónica y auto-envío por correo.
        // El envío es idempotente y solo ocurre si quedó aceptada por el SII;
        // si quedó pendiente, el webhook lo envía al confirmarse.
        try {
          const emissionResult = await issueInvoice(order.id, effectiveUserId);
          if (emissionResult.kind === "issued") {
            const emailOutcome = await sendOrderInvoiceEmailIfNeeded(order.id, effectiveUserId);
            returnLog(requestId, "auto-invoice-done", {
              emailed: emailOutcome.sent,
              reason: "reason" in emailOutcome ? emailOutcome.reason : undefined,
              elapsedMs: Date.now() - t0,
            });
          } else {
            returnLog(requestId, "auto-invoice-pending", { kind: emissionResult.kind, elapsedMs: Date.now() - t0 });
          }
        } catch (autoFiscalError) {
          console.error("Auto invoice / email error after Webpay payment:", autoFiscalError);
          returnLog(requestId, "auto-invoice-failed", {
            error: autoFiscalError instanceof Error ? autoFiscalError.message : "Error al auto-emitir factura",
            elapsedMs: Date.now() - t0,
          });
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
      returnLog(requestId, "commit-rejected", { responseCode: result.responseCode, elapsedMs: Date.now() - t0 });
      return NextResponse.redirect(
        `${origin}/orden/${publicToken}?status=rejected&code=${result.responseCode}`
      );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al procesar pago WebPay";
    console.error(JSON.stringify({ scope: "webpay-return", requestId, event: "commit-failed", error: message, elapsedMs: Date.now() - t0 }));
    return NextResponse.redirect(
      `${origin}/orden/${publicToken}?status=error&message=${encodeURIComponent(message)}`
    );
  }
}
