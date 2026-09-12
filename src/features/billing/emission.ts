import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, clients, intellyDteWebhookEvents, integrationAttempts, invoices, paymentOrderLines, paymentOrders } from "@/db/schema";
import { getIntellyDteWebhookSecret } from "@/features/integrations/config-service";
import { getIntellyDteConfig, normalizeIntellyDteTenantRut } from "@/features/integrations/config-service";
import { getCompanySettings } from "@/features/company/service";
import { getIntellyDteGateway, type IntellyDteGateway, type InvoiceResult } from "@/features/integrations/intellydte";
import { isSiiAcceptedStatus, isSiiRejectedStatus } from "@/features/integrations/sii-status";
import { providerData, providerError, type IntellyDteFacturaPayload } from "@/features/integrations/intellydte-contract";
import { validChileanRut } from "@/features/clients/validation";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getFiscalEvidenceArtifact, storeReconstructedPdf } from "./evidence";
import { materializeInvoiceEvidence, normalizeRut, type EvidenceMaterializationResult } from "./evidence-orchestration";
import { parseSignedDteXmlBytes, renderFiscalPdf } from "./xml";
import { buildAuditEvent } from "@/features/audit/service";
import { hashToken, randomToken } from "@/lib/security";
import { encryptPublicToken } from "@/features/orders/public-token";
import { redactMetadata } from "@/lib/errors";

export { assertProviderMatchesOrder } from "./evidence-orchestration";

type FiscalClientSnapshot = { taxId: string | null; legalName: string; giro: string | null; addressLine: string | null; commune: string | null; city: string | null; email?: string };
type FiscalOrderSnapshot = { subtotal?: string; total: string; taxTotal: string; discountTotal: string; notes: string | null };
type FiscalLineSnapshot = { code?: string | null; description: string; quantity: string; unitPrice: string; subtotal: string; discountAmount: string; taxRate: string; taxAmount: string; total: string };

export function buildFacturaPayload(input: { client: FiscalClientSnapshot; order: FiscalOrderSnapshot; lines: FiscalLineSnapshot[]; issuerRut?: string | null }): IntellyDteFacturaPayload {
  assertDte33Preflight(input);
  const items = input.lines.map((line) => {
    const originalUnitPrice = fiscalUnitPrice(line.unitPrice);
    const quantity = Number(line.quantity);
    const originalSubtotal = Math.round(originalUnitPrice * quantity);
    const discountAmount = fiscalMoney(line.discountAmount, "DISCOUNT");
    const nombre = (line.code?.trim() || line.description).slice(0, 80);
    const item: IntellyDteFacturaPayload["items"][number] = {
      nombre,
      cantidad: quantity,
      precioUnitario: originalUnitPrice,
      montoItem: originalSubtotal - discountAmount,
      exento: Number(line.taxRate) === 0,
    };
    if (line.description?.trim() && line.description.trim() !== nombre) {
      item.descripcion = line.description.trim().slice(0, 1000);
    }
    if (discountAmount > 0) {
      item.descuentoMonto = discountAmount;
      item.descuentoPct = Number(((discountAmount / originalSubtotal) * 100).toFixed(2));
    }
    return item;
  });
  const taxable = items.filter((_, index) => Number(input.lines[index]!.taxRate) > 0).reduce((sum, item) => sum + item.montoItem, 0);
  const exempt = items.filter((_, index) => Number(input.lines[index]!.taxRate) === 0).reduce((sum, item) => sum + item.montoItem, 0);
  const payload: IntellyDteFacturaPayload = {
    receptor: { rut: input.client.taxId!, razonSocial: input.client.legalName, ...(input.client.giro ? { giro: input.client.giro } : {}), ...(input.client.addressLine ? { direccion: input.client.addressLine } : {}), ...(input.client.commune ? { comuna: input.client.commune } : {}), ...(input.client.city ? { ciudad: input.client.city } : {}), ...(input.client.email ? { email: input.client.email } : {}) },
    items,
    montoNeto: taxable,
    ...(exempt > 0 ? { montoExento: exempt } : {}),
    montoIva: Math.round(Number(input.order.taxTotal)),
    montoTotal: Math.round(Number(input.order.total)),
    fechaEmision: new Date().toISOString().slice(0, 10),
  };
  if (input.order.notes?.trim()) payload.observaciones = input.order.notes.trim().slice(0, 500);
  return payload;
}

function fiscalMoney(value: string, field: string): number {
  if (!/^\d+(?:\.\d+)?$/.test(String(value).trim())) throw new AppError(`FISCAL_${field}_INVALID`, `El monto fiscal ${field} no es válido.`, 400);
  const parsed = Number(value);
  if (!Number.isSafeInteger(Math.round(parsed)) || parsed < 0) throw new AppError(`FISCAL_${field}_INVALID`, `El monto fiscal ${field} no es seguro.`, 400);
  return Math.round(parsed);
}

function fiscalUnitPrice(value: string): number {
  const trimmed = String(value).trim();
  if (!/^\d+(?:\.\d+)?$/.test(trimmed)) throw new AppError("FISCAL_UNIT_PRICE_INVALID", "El precio fiscal no es válido.", 400);
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > Number.MAX_SAFE_INTEGER) {
    throw new AppError("FISCAL_UNIT_PRICE_INVALID", "El precio fiscal no es seguro.", 400);
  }
  return parsed;
}

export function assertDte33Preflight(input: { client: FiscalClientSnapshot; order: FiscalOrderSnapshot; lines: FiscalLineSnapshot[]; issuerRut?: string | null }): void {
  const receiverFields: Array<[string | null | undefined, string]> = [[input.client.taxId, "RUT"], [input.client.legalName, "RAZON_SOCIAL"], [input.client.giro, "GIRO"], [input.client.addressLine, "DIRECCION"], [input.client.commune, "COMUNA"], [input.client.city, "CIUDAD"]];
  for (const [value, field] of receiverFields) if (!value?.trim()) throw new AppError(`FISCAL_RECEIVER_${field}_REQUIRED`, `La factura requiere ${field.toLowerCase()} del receptor.`, 400);
  if (!validChileanRut(input.client.taxId!)) throw new AppError("FISCAL_RECEIVER_RUT_INVALID", "El RUT del receptor no es válido.", 400);
  if (input.issuerRut !== undefined && (!input.issuerRut || !validChileanRut(input.issuerRut))) throw new AppError("FISCAL_ISSUER_RUT_INVALID", "Configura un RUT emisor válido para IntellyDTE.", 503);
  if (input.lines.length === 0 || input.lines.length > 60) throw new AppError("FISCAL_LINE_LIMIT", "La factura debe tener entre 1 y 60 líneas.", 400);
  const subtotal = input.lines.reduce((sum, line) => {
    const unitPrice = fiscalUnitPrice(line.unitPrice);
    const quantity = Number(line.quantity);
    if (!Number.isFinite(quantity) || quantity <= 0) throw new AppError("FISCAL_QUANTITY_INVALID", "La cantidad fiscal debe ser positiva.", 400);
    const originalSubtotal = Math.round(unitPrice * quantity);
    if (originalSubtotal !== fiscalMoney(line.subtotal, "SUBTOTAL")) throw new AppError("FISCAL_LINE_SUBTOTAL_MISMATCH", "El subtotal fiscal no coincide con precio y cantidad.", 400);
    const discount = fiscalMoney(line.discountAmount, "DISCOUNT");
    if (discount > originalSubtotal) throw new AppError("FISCAL_DISCOUNT_INVALID", "El descuento fiscal no puede superar el subtotal.", 400);
    const net = originalSubtotal - discount;
    const taxRate = Number(line.taxRate);
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100) throw new AppError("FISCAL_TAX_RATE_INVALID", "La tasa fiscal no es válida.", 400);
    const expectedTax = Math.round(net * taxRate / 100);
    if (expectedTax !== fiscalMoney(line.taxAmount, "TAX")) throw new AppError("FISCAL_LINE_TAX_MISMATCH", "El IVA de la línea no coincide con sus valores.", 400);
    if (net + expectedTax !== fiscalMoney(line.total, "TOTAL")) throw new AppError("FISCAL_LINE_TOTAL_MISMATCH", "El total de la línea no coincide con sus valores.", 400);
    return sum + originalSubtotal;
  }, 0);
  if (input.order.subtotal !== undefined && subtotal !== fiscalMoney(input.order.subtotal, "ORDER_SUBTOTAL")) throw new AppError("FISCAL_ORDER_SUBTOTAL_MISMATCH", "El subtotal de la orden no coincide con sus líneas.", 400);
  const discounts = input.lines.reduce((sum, line) => sum + fiscalMoney(line.discountAmount, "DISCOUNT"), 0);
  if (discounts !== fiscalMoney(input.order.discountTotal, "ORDER_DISCOUNT")) throw new AppError("FISCAL_ORDER_DISCOUNT_MISMATCH", "El descuento de la orden no coincide con sus líneas.", 400);
  const tax = input.lines.reduce((sum, line) => sum + fiscalMoney(line.taxAmount, "TAX"), 0);
  const total = input.lines.reduce((sum, line) => sum + fiscalMoney(line.total, "TOTAL"), 0);
  if (tax !== fiscalMoney(input.order.taxTotal, "ORDER_TAX")) throw new AppError("FISCAL_ORDER_TAX_MISMATCH", "El IVA de la orden no coincide con sus líneas.", 400);
  if (total !== fiscalMoney(input.order.total, "ORDER_TOTAL") || total <= 0) throw new AppError("FISCAL_ORDER_TOTAL_MISMATCH", "El total de la orden no coincide con sus líneas.", 400);
}

export function verifyIntellyDteSignature(rawBody: string, signatureHeader: string | null | undefined, secret: string): boolean {
  const cleanHeader = signatureHeader?.trim() ?? "";
  const match = /^(?:sha256=)?([a-f0-9]{64})$/i.exec(cleanHeader);
  if (!match || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex").toLowerCase(), "utf8");
  const received = Buffer.from(match[1]!.toLowerCase(), "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function requestHash(payload: IntellyDteFacturaPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

async function retryLocalPdf(invoiceId: string) {
  const signed = await getFiscalEvidenceArtifact(invoiceId, "signed_xml");
  if (!signed?.bytes) throw new AppError("SIGNED_XML_MISSING", "No existe XML firmado para reconstruir el PDF.", 409);
  const document = parseSignedDteXmlBytes(signed.bytes);
  const pdf = await renderFiscalPdf(document);
  return storeReconstructedPdf(invoiceId, { dteType: document.type, folio: document.folio, rendererVersion: "fiscal-pdf-v2" }, pdf);
}

export async function regenerateInvoicePdf(invoiceId: string, userId: string, gateway?: IntellyDteGateway): Promise<InvoiceResult> {
  const db = getDb();
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1).execute();
  if (!invoice) throw new AppError("INVOICE_NOT_FOUND", "Factura no encontrada.", 404);
  if (invoice.status === "rejected") throw new AppError("INVOICE_NOT_ISSUED", "La factura debe estar emitida para regenerar su PDF.", 409);
  if (!invoice.signedXmlEvidenceId) {
    const recovered = await recoverStoredEmissionEvidence(db, invoice, userId);
    if (recovered) return recovered;
    return refreshInvoiceStatus(invoiceId, userId, gateway);
  }

  try {
    const reconstructed = await retryLocalPdf(invoice.id);
    await db.update(invoices).set({ reconstructedPdfEvidenceId: reconstructed.id, evidenceStatus: "complete", evidenceError: null, lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    await db.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: "invoice.pdf_reconstructed", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: invoice.providerDocumentId, folio: invoice.folio, manual: true } }));
    return { kind: "issued", providerDocumentId: invoice.providerDocumentId ?? "", folio: invoice.folio ?? "", issuedAt: invoice.issuedAt?.toISOString() ?? new Date().toISOString(), trackId: invoice.trackId, siiStatus: invoice.siiStatus, siiGlosa: invoice.siiGlosa };
  } catch (error) {
    try {
      const recovered = await recoverStoredEmissionEvidence(db, invoice, userId);
      if (recovered) return recovered;
      if (invoice.providerDocumentId) {
        return await refreshInvoiceStatus(invoiceId, userId, gateway);
      }
    } catch {
      // Fall through to error reporting
    }
    const safe = error instanceof AppError ? error : new AppError("PDF_RECONSTRUCTION_FAILED", "No se pudo reconstruir el PDF fiscal.", 500);
    await db.update(invoices).set({ evidenceStatus: "failed", evidenceError: safe.message.slice(0, 300), lastErrorCode: safe.code, lastErrorMessage: safe.message.slice(0, 300), updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    throw safe;
  }
}

function resultMessage(result: InvoiceResult): string {
  if (result.kind === "issued") return "Factura emitida.";
  if (result.kind === "pending") return result.safeMessage ?? "Emisión pendiente de conciliación.";
  return result.safeMessage;
}

function resultCode(result: Exclude<InvoiceResult, { kind: "issued" }>): string {
  return result.code ?? result.providerCode ?? "EMISSION_PENDING";
}

type BillingDb = ReturnType<typeof getDb>;

async function latestAttempt(db: BillingDb, invoiceId: string) {
  const rows = await db.select().from(integrationAttempts).where(eq(integrationAttempts.aggregateId, invoiceId)).orderBy(desc(integrationAttempts.attemptNumber)).limit(1).execute();
  return rows[0] ?? null;
}

function resultFromStoredAttempt(invoice: typeof invoices["$inferSelect"], attempt: Awaited<ReturnType<typeof latestAttempt>>): Extract<InvoiceResult, { kind: "issued" }> | null {
  if (!attempt) return null;
  const data = providerData(attempt.responseBody);
  const providerDocumentId = data.dteRecordId ?? attempt.providerDocumentId ?? invoice.providerDocumentId;
  if (!providerDocumentId || !data.folio || !data.printPayload?.signedXmlBase64) return null;
  return {
    kind: "issued",
    providerDocumentId,
    folio: data.folio,
    tipoDte: data.tipoDte,
    issuedAt: data.issuedAt ?? invoice.issuedAt?.toISOString() ?? new Date().toISOString(),
    trackId: data.trackId,
    siiStatus: data.siiStatus,
    siiGlosa: data.siiGlosa,
    signedXmlBase64: data.printPayload.signedXmlBase64,
    printPayload: data.printPayload,
    providerBody: attempt.responseBody ?? undefined,
  };
}

async function recoverStoredEmissionEvidence(db: BillingDb, invoice: typeof invoices["$inferSelect"], userId: string): Promise<InvoiceResult | null> {
  const attempts = await db.select().from(integrationAttempts).where(eq(integrationAttempts.aggregateId, invoice.id)).orderBy(desc(integrationAttempts.attemptNumber)).limit(10).execute();
  const result = attempts.map((attempt) => resultFromStoredAttempt(invoice, attempt)).find((candidate): candidate is Extract<InvoiceResult, { kind: "issued" }> => Boolean(candidate));
  if (!result) return null;
  const evidence = await materializeInvoiceEvidence({ invoiceId: invoice.id, result, payload: await payloadForInvoice(db, invoice.paymentOrderId), expectedIssuerRut: invoice.tenantRut });
  if (evidence.status === "pending") return null;
  const complete = evidence.status === "complete";
  const accepted = isSiiAcceptedStatus(result.siiStatus);
  await db.update(invoices).set({ status: accepted ? "issued" : "processing", providerDocumentId: result.providerDocumentId, folio: result.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, signedXmlEvidenceId: evidence.signedXmlEvidenceId ?? invoice.signedXmlEvidenceId, reconstructedPdfEvidenceId: evidence.reconstructedPdfEvidenceId ?? invoice.reconstructedPdfEvidenceId, evidenceStatus: complete ? "complete" : "failed", evidenceError: complete ? null : evidence.errorMessage, issuedAt: accepted ? invoice.issuedAt ?? new Date(result.issuedAt) : invoice.issuedAt, lastErrorCode: complete ? null : evidence.errorCode, lastErrorMessage: complete ? null : evidence.errorMessage, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
  if (!complete) throw new AppError(evidence.errorCode ?? "PDF_RECONSTRUCTION_FAILED", evidence.errorMessage ?? "No se pudo reconstruir el PDF fiscal.", 500);
  await db.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: "invoice.pdf_reconstructed", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: result.providerDocumentId, folio: result.folio, manual: true, fromStoredEmission: true } }));
  return result;
}

async function createAttempt(db: BillingDb, invoiceId: string, idempotencyKey: string, requestHashValue: string, payload: IntellyDteFacturaPayload, attemptNumber: number, operation = "issue_invoice") {
  const id = randomUUID();
  const correlationId = randomUUID();
  await db.insert(integrationAttempts).values([{ id, integration: "intellydte", operation, aggregateType: "invoice", aggregateId: invoiceId, idempotencyKey, correlationId, attemptNumber, status: "processing", requestHash: requestHashValue, endpoint: operation === "issue_invoice" ? "/api/v1/dte/factura" : "/api/v1/integrations/dte/:id/status", requestBody: redactMetadata(payload as unknown as Record<string, unknown>) }]);
  return { id, correlationId };
}

function providerResponseBody(result: InvoiceResult): Record<string, unknown> | null {
  return result.providerBody ? redactMetadata(result.providerBody) : null;
}

async function applyInvoiceResult(db: BillingDb, invoice: typeof invoices["$inferSelect"], orderId: string, attemptId: string, result: InvoiceResult, payload: IntellyDteFacturaPayload, userId: string): Promise<InvoiceResult> {
  const now = new Date();
  if (((invoice.status === "issued" && isSiiAcceptedStatus(invoice.siiStatus)) || (invoice.status === "rejected" && isSiiRejectedStatus(invoice.siiStatus))) && result.kind !== "issued") {
    await db.update(integrationAttempts).set({ status: "ignored", completedAt: now, providerCode: result.kind === "rejected" || result.kind === "failed" || result.kind === "unavailable" ? result.code : result.providerCode, responseBody: providerResponseBody(result), safeMessage: "Evento o conciliación ignorada por estado terminal local." }).where(eq(integrationAttempts.id, attemptId));
    return result;
  }
  if (result.kind === "issued") {
    const siiAccepted = isSiiAcceptedStatus(result.siiStatus);
    const localStatus = siiAccepted ? "issued" : "processing";
    const issuedAt = siiAccepted ? invoice.issuedAt ?? new Date(result.issuedAt) : invoice.issuedAt;
    const attemptStatus = siiAccepted ? "issued" : "processing";
    let evidence: EvidenceMaterializationResult;
    try {
      evidence = await materializeInvoiceEvidence({ invoiceId: invoice.id, result, payload, expectedIssuerRut: invoice.tenantRut });
    } catch (error) {
      evidence = { status: "failed", signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null, errorCode: error instanceof AppError ? error.code : "EVIDENCE_GENERATION_FAILED", errorMessage: error instanceof AppError ? error.message : "No se pudo materializar la evidencia fiscal." };
    }
    if (evidence.status === "complete" || evidence.status === "failed") {
      const complete = evidence.status === "complete";
      await db.transaction(async (tx) => {
        await tx.update(invoices).set({ status: localStatus, providerDocumentId: result.providerDocumentId, folio: result.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, signedXmlEvidenceId: evidence.signedXmlEvidenceId ?? invoice.signedXmlEvidenceId, reconstructedPdfEvidenceId: evidence.reconstructedPdfEvidenceId ?? invoice.reconstructedPdfEvidenceId, evidenceStatus: complete ? "complete" : "failed", evidenceError: complete ? null : evidence.errorMessage, issuedAt, lastErrorCode: complete ? null : evidence.errorCode, lastErrorMessage: complete ? null : evidence.errorMessage, updatedAt: now }).where(eq(invoices.id, invoice.id));
        if (siiAccepted) await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date(), updatedAt: now }).where(and(eq(paymentOrders.id, orderId), inArray(paymentOrders.status, ["draft", "issued", "paid"])));
        await tx.update(integrationAttempts).set({ status: attemptStatus, completedAt: now, providerCode: result.providerDocumentId, providerDocumentId: result.providerDocumentId, responseBody: providerResponseBody(result), safeMessage: complete ? (siiAccepted ? "Factura aceptada por el SII y evidencia fiscal almacenada." : "Factura emitida y evidencia fiscal almacenada; esperando confirmación del SII.") : (siiAccepted ? "Factura aceptada; la evidencia fiscal requiere reintento." : "Factura emitida; la evidencia fiscal requiere reintento y confirmación del SII.") }).where(eq(integrationAttempts.id, attemptId));
        await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: siiAccepted ? "invoice.issued" : "invoice.processing", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: result.providerDocumentId, folio: result.folio, evidenceStatus: complete ? "complete" : "failed", siiConfirmed: siiAccepted } }));
      });
      return result;
    }
    if (invoice.signedXmlEvidenceId) {
      let regeneratedPdfId: string | null = null;
      let regenerationError: Error | null = null;
      try { regeneratedPdfId = (await retryLocalPdf(invoice.id)).id; } catch (error) { regenerationError = error instanceof Error ? error : new Error("PDF_RECONSTRUCTION_FAILED"); }
      await db.transaction(async (tx) => {
        await tx.update(invoices).set({ status: localStatus, providerDocumentId: result.providerDocumentId, folio: result.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, reconstructedPdfEvidenceId: regeneratedPdfId ?? invoice.reconstructedPdfEvidenceId, evidenceStatus: regeneratedPdfId ? "complete" : "failed", evidenceError: regenerationError?.message.slice(0, 300) ?? null, lastErrorCode: regeneratedPdfId ? null : "PDF_RECONSTRUCTION_RETRYABLE", lastErrorMessage: regenerationError ? "Factura emitida; PDF fiscal pendiente de reconstrucción." : null, issuedAt, updatedAt: now }).where(eq(invoices.id, invoice.id));
        if (siiAccepted) await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date(), updatedAt: now }).where(and(eq(paymentOrders.id, orderId), inArray(paymentOrders.status, ["draft", "issued", "paid"])));
        await tx.update(integrationAttempts).set({ status: attemptStatus, completedAt: now, providerCode: result.providerDocumentId, providerDocumentId: result.providerDocumentId, responseBody: providerResponseBody(result), safeMessage: `${siiAccepted ? "Factura aceptada" : "Factura emitida"}; PDF fiscal pendiente de reconstrucción.` }).where(eq(integrationAttempts.id, attemptId));
      });
      return result;
    }
    await db.transaction(async (tx) => {
      await tx.update(invoices).set({ status: localStatus, providerDocumentId: result.providerDocumentId, folio: result.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, evidenceStatus: "pending", evidenceError: evidence.errorMessage ?? "Falta XML firmado.", issuedAt, lastErrorCode: evidence.errorCode ?? "SIGNED_XML_PENDING", lastErrorMessage: siiAccepted ? "La factura fue aceptada; falta almacenar el XML firmado." : "La factura fue emitida; esperando confirmación del SII y evidencia tributaria.", updatedAt: now }).where(eq(invoices.id, invoice.id));
      if (siiAccepted) await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date(), updatedAt: now }).where(and(eq(paymentOrders.id, orderId), inArray(paymentOrders.status, ["draft", "issued", "paid"])));
      await tx.update(integrationAttempts).set({ status: attemptStatus, completedAt: now, providerCode: result.providerDocumentId, providerDocumentId: result.providerDocumentId, responseBody: providerResponseBody(result), safeMessage: siiAccepted ? "Factura aceptada; evidencia tributaria pendiente." : "Factura emitida; esperando confirmación del SII." }).where(eq(integrationAttempts.id, attemptId));
      await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: siiAccepted ? "invoice.issued" : "invoice.processing", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: result.providerDocumentId, folio: result.folio, evidenceStatus: "pending", siiConfirmed: siiAccepted } }));
    });
    return result;
  }
  const status: "rejected" | "pending" = result.kind === "rejected" ? "rejected" : "pending";
  const attemptStatus = result.kind === "rejected" ? "rejected" : result.kind === "pending" ? "pending" : "failed";
  const errorCode = resultCode(result);
  await db.transaction(async (tx) => {
    await tx.update(invoices).set({ status, providerDocumentId: result.providerDocumentId ?? invoice.providerDocumentId, folio: result.folio ?? invoice.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, lastErrorCode: errorCode, lastErrorMessage: resultMessage(result).slice(0, 300), evidenceStatus: invoice.signedXmlEvidenceId ? invoice.evidenceStatus : "pending", rejectedAt: status === "rejected" ? now : null, updatedAt: now }).where(eq(invoices.id, invoice.id));
    await tx.update(integrationAttempts).set({ status: attemptStatus, completedAt: now, httpStatus: result.statusCode, providerCode: errorCode, providerDocumentId: result.providerDocumentId, responseBody: providerResponseBody(result), safeMessage: resultMessage(result).slice(0, 300) }).where(eq(integrationAttempts.id, attemptId));
    await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: status === "rejected" ? "invoice.rejected" : result.kind === "failed" || result.kind === "unavailable" ? "invoice.emission_failed" : "invoice.pending", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: result.providerDocumentId ?? null, providerCode: errorCode, retryable: result.kind === "pending" ? true : result.retryable } }));
  });
  return result;
}

export async function issueInvoice(orderId: string, userId: string, gateway?: IntellyDteGateway): Promise<InvoiceResult> {
  const db = getDb();
  const [order] = await db.select({ id: paymentOrders.id, number: paymentOrders.number, status: paymentOrders.status, subtotal: paymentOrders.subtotal, total: paymentOrders.total, taxTotal: paymentOrders.taxTotal, discountTotal: paymentOrders.discountTotal, notes: paymentOrders.notes, publicTokenHash: paymentOrders.publicTokenHash, issuedAt: paymentOrders.issuedAt, clientId: clients.id, clientTaxId: clients.taxId, clientName: clients.legalName, clientGiro: clients.giro, clientAddress: clients.addressLine, clientCommune: clients.commune, clientCity: clients.city, clientEmail: clients.email }).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.id, orderId)).limit(1).execute();
  if (!order || (order.status !== "draft" && order.status !== "issued" && order.status !== "paid")) throw new AppError("NOT_INVOICEABLE", "La orden debe estar en borrador, emitida o pagada.", 409);
  if (order.status === "draft" && !order.publicTokenHash) {
    const token = randomToken();
    const encryptedToken = encryptPublicToken(token);
    await db.update(paymentOrders).set({
      publicTokenHash: hashToken(token),
      publicTokenCiphertext: encryptedToken.ciphertext,
      publicTokenIv: encryptedToken.iv,
      publicTokenAuthTag: encryptedToken.authTag,
      publicExpiresAt: new Date(Date.now() + 30 * 86_400_000),
      publicRevokedAt: null,
      issuedAt: order.issuedAt ?? new Date(),
    }).where(eq(paymentOrders.id, orderId));
  }
  const lines = await db.select({ code: paymentOrderLines.code, description: paymentOrderLines.description, quantity: paymentOrderLines.quantity, unitPrice: paymentOrderLines.unitPrice, subtotal: paymentOrderLines.subtotal, discountAmount: paymentOrderLines.discountAmount, taxRate: paymentOrderLines.taxRate, taxAmount: paymentOrderLines.taxAmount, total: paymentOrderLines.total }).from(paymentOrderLines).where(eq(paymentOrderLines.paymentOrderId, orderId)).orderBy(paymentOrderLines.sortOrder).execute();
  const config = await getIntellyDteConfig();
  const env = getEnv();
  let tenantRut = config?.tenantRut ?? (env.INTELLYDTE_TENANT_RUT || env.INTELLYDTE_COMPANY_TAX_ID ? normalizeIntellyDteTenantRut(env.INTELLYDTE_TENANT_RUT || env.INTELLYDTE_COMPANY_TAX_ID!) : env.INTELLYDTE_MODE === "fake" ? "12345678-5" : null);
  if (!tenantRut) {
    try {
      const company = await getCompanySettings();
      if (company?.rut) tenantRut = normalizeIntellyDteTenantRut(company.rut);
    } catch {
      // ignore
    }
  }
  const payload = buildFacturaPayload({ client: { taxId: order.clientTaxId, legalName: order.clientName, giro: order.clientGiro, addressLine: order.clientAddress, commune: order.clientCommune, city: order.clientCity, email: order.clientEmail }, order: { subtotal: order.subtotal, total: order.total, taxTotal: order.taxTotal, discountTotal: order.discountTotal, notes: order.notes }, lines, issuerRut: tenantRut });
  const hash = requestHash(payload);
  const [existing] = await db.select().from(invoices).where(eq(invoices.paymentOrderId, orderId)).limit(1).execute();
  const idempotencyKey = `invoice:${orderId}`;
  const provider = gateway ?? await getIntellyDteGateway();
  if (existing?.status === "issued" && isSiiAcceptedStatus(existing.siiStatus) && existing.evidenceStatus !== "pending") return { kind: "issued", providerDocumentId: existing.providerDocumentId ?? "", folio: existing.folio ?? "", issuedAt: existing.issuedAt?.toISOString() ?? new Date().toISOString(), trackId: existing.trackId, siiStatus: existing.siiStatus, siiGlosa: existing.siiGlosa };
  const invoiceId = existing?.id ?? randomUUID();
  if (existing?.status === "rejected" && isSiiRejectedStatus(existing.siiStatus)) return { kind: "rejected", code: existing.lastErrorCode ?? "SII_REJECTED", safeMessage: existing.lastErrorMessage ?? existing.siiGlosa ?? "El SII rechazó el documento.", retryable: false, providerDocumentId: existing.providerDocumentId ?? undefined, folio: existing.folio ?? undefined, siiStatus: existing.siiStatus, siiGlosa: existing.siiGlosa };
  if (existing?.providerDocumentId) {
    const previousAttempt = await latestAttempt(db, invoiceId);
    const attempt = await createAttempt(db, invoiceId, idempotencyKey, hash, payload, (previousAttempt?.attemptNumber ?? 0) + 1, "reconcile_invoice_status");
    const statusResult = await provider.getInvoiceStatus(existing.providerDocumentId);
    return applyInvoiceResult(db, existing, orderId, attempt.id, statusResult, payload, userId);
  }
  if (existing?.folio || existing?.signedXmlEvidenceId) return { kind: "pending", code: "STATUS_RECONCILIATION_REQUIRED", safeMessage: "Existe evidencia de emisión sin identificador del proveedor; requiere conciliación manual.", providerCode: "STATUS_RECONCILIATION_REQUIRED" };
  const previousAttempt = await latestAttempt(db, invoiceId);
  if ((previousAttempt?.attemptNumber ?? 0) >= 5) throw new AppError("DTE_RETRY_LIMIT_REACHED", "La emisión alcanzó el máximo de 5 intentos y requiere revisión manual.", 409);
  if (!existing) await db.insert(invoices).values({ id: invoiceId, paymentOrderId: orderId, status: "processing", requestHash: hash, tenantRut });
  else await db.update(invoices).set({ status: "processing", requestHash: hash, lastErrorCode: null, lastErrorMessage: null, rejectedAt: null, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  const attempt = await createAttempt(db, invoiceId, idempotencyKey, hash, payload, (previousAttempt?.attemptNumber ?? 0) + 1);
  const previousProviderCode = previousAttempt ? providerError(previousAttempt.responseBody, previousAttempt.providerCode ?? "", "").code : "";
  const preserveLegacyAsyncMode = Boolean(existing && [existing.lastErrorCode, previousProviderCode].some((code) => /^(?:ASYNC_|IDEMPOTENCY_PREVIOUSLY_FAILED)/.test(code ?? "")));
  const result = await provider.issueInvoice({ idempotencyKey, correlationId: attempt.correlationId, orderNumber: order.number, total: order.total, recipientTaxId: order.clientTaxId ?? "", payload, ...(preserveLegacyAsyncMode ? { emissionMode: "async" as const } : {}) });
  return applyInvoiceResult(db, { ...(existing ?? { id: invoiceId, paymentOrderId: orderId, status: "processing", providerDocumentId: null, folio: null, trackId: null, siiStatus: null, siiGlosa: null, signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null, evidenceStatus: "pending", evidenceError: null, issuedAt: null }) } as typeof invoices["$inferSelect"], orderId, attempt.id, result, payload, userId);
}

function eventData(payload: Record<string, unknown>): Record<string, unknown> {
  return payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : payload;
}

async function payloadForInvoice(db: BillingDb, paymentOrderId: string): Promise<IntellyDteFacturaPayload> {
  const [order] = await db.select({ subtotal: paymentOrders.subtotal, total: paymentOrders.total, taxTotal: paymentOrders.taxTotal, discountTotal: paymentOrders.discountTotal, notes: paymentOrders.notes, clientTaxId: clients.taxId, clientName: clients.legalName, clientGiro: clients.giro, clientAddress: clients.addressLine, clientCommune: clients.commune, clientCity: clients.city, clientEmail: clients.email }).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.id, paymentOrderId)).limit(1).execute();
  if (!order) throw new AppError("INVOICE_ORDER_MISSING", "La orden de la factura no existe.", 404);
  const lines = await db.select({ code: paymentOrderLines.code, description: paymentOrderLines.description, quantity: paymentOrderLines.quantity, unitPrice: paymentOrderLines.unitPrice, subtotal: paymentOrderLines.subtotal, discountAmount: paymentOrderLines.discountAmount, taxRate: paymentOrderLines.taxRate, taxAmount: paymentOrderLines.taxAmount, total: paymentOrderLines.total }).from(paymentOrderLines).where(eq(paymentOrderLines.paymentOrderId, paymentOrderId)).orderBy(paymentOrderLines.sortOrder).execute();
  return buildFacturaPayload({ client: { taxId: order.clientTaxId, legalName: order.clientName, giro: order.clientGiro, addressLine: order.clientAddress, commune: order.clientCommune, city: order.clientCity, email: order.clientEmail }, order: { subtotal: order.subtotal, total: order.total, taxTotal: order.taxTotal, discountTotal: order.discountTotal, notes: order.notes }, lines });
}

export type WebhookResult = { accepted: true; duplicate: boolean; eventId: string; status: string };

export async function handleIntellyDteWebhook(rawBody: string, signature: string | null | undefined, secret?: string, incomingApiKey?: string | null): Promise<WebhookResult> {
  const webhookSecret = secret ?? await getIntellyDteWebhookSecret();
  let config: Awaited<ReturnType<typeof getIntellyDteConfig>> = null;
  try { config = await getIntellyDteConfig(); } catch { config = null; }
  let authenticated = false;
  if (webhookSecret && signature && verifyIntellyDteSignature(rawBody, signature, webhookSecret)) authenticated = true;
  else if (!authenticated && signature && config?.tenantApiKey && verifyIntellyDteSignature(rawBody, signature, config.tenantApiKey)) authenticated = true;
  else if (!authenticated && signature && config?.apiKey && verifyIntellyDteSignature(rawBody, signature, config.apiKey)) authenticated = true;
  else if (!authenticated && incomingApiKey && (incomingApiKey === config?.tenantApiKey || incomingApiKey === config?.apiKey || (config?.systemApiKey && incomingApiKey === config.systemApiKey))) authenticated = true;
  else if (!authenticated && !webhookSecret && !config?.tenantApiKey && !config?.apiKey) authenticated = true;
  if (!authenticated) throw new AppError("INVALID_WEBHOOK_SIGNATURE", "Firma de webhook inválida.", 401);
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { throw new AppError("INVALID_WEBHOOK_BODY", "El webhook no contiene JSON válido.", 400); }
  const data = eventData(body);
  const eventId = String(body.eventId ?? body.event_id ?? data.eventId ?? data.event_id ?? body.id ?? "").trim() || createHash("sha256").update(rawBody).digest("hex").slice(0, 36);
  const event = String(body.event ?? body.type ?? data.event ?? data.type ?? data.status ?? body.status ?? "dte.updated").trim();
  if (!eventId || !event) throw new AppError("INVALID_WEBHOOK_BODY", "El webhook requiere eventId y event.", 400);
  const dteRecordId = String(data.dteRecordId ?? data.dte_record_id ?? data.documentId ?? data.document_id ?? data.recordId ?? data.record_id ?? data.id ?? body.dteRecordId ?? body.dte_record_id ?? body.documentId ?? body.document_id ?? body.recordId ?? body.id ?? "").trim() || null;
  const tenantRut = normalizeRut(String(data.tenantRut ?? data.tenant_rut ?? body.rutEmisor ?? body.rut_emisor ?? body.tenantRut ?? body.tenant_rut ?? "").trim()) || null;
  const db = getDb();
  const [known] = await db.select().from(intellyDteWebhookEvents).where(eq(intellyDteWebhookEvents.providerEventId, eventId)).limit(1).execute();
  if (known?.processedAt) return { accepted: true, duplicate: true, eventId, status: "duplicate" };
  if (!known) {
    try {
      await db.insert(intellyDteWebhookEvents).values({ id: randomUUID(), providerEventId: eventId, eventType: event, dteRecordId, tenantRut, payload: redactMetadata(body), processedAt: null });
    } catch (error) {
      if (typeof error === "object" && error !== null && ("code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY" || "errno" in error && (error as { errno?: number }).errno === 1062)) return { accepted: true, duplicate: true, eventId, status: "duplicate" };
      throw error;
    }
  }
  let invoice: typeof invoices["$inferSelect"] | undefined;
  if (dteRecordId) {
    const [found] = await db.select().from(invoices).where(eq(invoices.providerDocumentId, dteRecordId)).limit(1).execute();
    invoice = found;
  }
  const dataResultValue = providerData(body);
  if (!invoice) {
    const incomingFolio = String(dataResultValue.folio ?? data.folio ?? body.folio ?? "").trim();
    const incomingOrderNumber = String(data.orderNumber ?? data.order_number ?? data.externalSaleId ?? data.external_sale_id ?? body.orderNumber ?? body.order_number ?? body.externalSaleId ?? body.external_sale_id ?? "").trim();
    if (incomingOrderNumber && incomingFolio) {
      const [found] = await db.select({ invoice: invoices }).from(invoices).innerJoin(paymentOrders, eq(paymentOrders.id, invoices.paymentOrderId)).where(and(eq(paymentOrders.number, incomingOrderNumber), eq(invoices.folio, incomingFolio))).limit(1).execute();
      invoice = found?.invoice;
    } else if (incomingOrderNumber) {
      const [found] = await db.select({ invoice: invoices }).from(invoices).innerJoin(paymentOrders, eq(paymentOrders.id, invoices.paymentOrderId)).where(eq(paymentOrders.number, incomingOrderNumber)).limit(1).execute();
      invoice = found?.invoice;
    } else if (incomingFolio) {
      const [found] = await db.select().from(invoices).where(eq(invoices.folio, incomingFolio)).limit(1).execute();
      invoice = found;
    }
  }
  if (!invoice) {
    await db.update(intellyDteWebhookEvents).set({ processedAt: new Date(), payload: redactMetadata(body) }).where(eq(intellyDteWebhookEvents.providerEventId, eventId));
    return { accepted: true, duplicate: false, eventId, status: "acknowledged_without_target" };
  }
  if (tenantRut && (!invoice.tenantRut || normalizeRut(tenantRut) !== normalizeRut(invoice.tenantRut))) {
    await db.update(intellyDteWebhookEvents).set({ processedAt: new Date() }).where(eq(intellyDteWebhookEvents.providerEventId, eventId));
    return { accepted: true, duplicate: false, eventId, status: "acknowledged_without_target" };
  }
  const effectiveDteId = dteRecordId ?? invoice.providerDocumentId ?? "";
  const issuedResult: InvoiceResult = dataResultValue.folio && dataResultValue.printPayload?.signedXmlBase64 ? { kind: "issued", providerDocumentId: effectiveDteId, folio: dataResultValue.folio, tipoDte: dataResultValue.tipoDte, issuedAt: dataResultValue.issuedAt ?? new Date().toISOString(), trackId: dataResultValue.trackId, siiStatus: dataResultValue.siiStatus, siiGlosa: dataResultValue.siiGlosa, signedXmlBase64: dataResultValue.printPayload.signedXmlBase64, printPayload: dataResultValue.printPayload, providerBody: body } : { kind: "pending", providerDocumentId: effectiveDteId, folio: dataResultValue.folio, trackId: dataResultValue.trackId, siiStatus: dataResultValue.siiStatus, siiGlosa: dataResultValue.siiGlosa, providerBody: body };
  const eventLower = event.toLowerCase();
  const isAcceptedEvent = eventLower === "dte.accepted" || eventLower === "dte.issued" || eventLower === "dte.authorized" || eventLower === "dte_accepted" || eventLower === "invoice.accepted" || eventLower === "invoice.issued";
  const incomingTrackId = typeof data.trackId === "string" ? data.trackId : typeof data.track_id === "string" ? data.track_id : undefined;
  const incomingSiiStatus = typeof data.siiStatus === "string" ? data.siiStatus : typeof data.sii_status === "string" ? data.sii_status : undefined;
  const incomingSiiGlosa = typeof data.siiGlosa === "string" ? data.siiGlosa : typeof data.sii_glosa === "string" ? data.sii_glosa : undefined;
  const accepted = isAcceptedEvent || isSiiAcceptedStatus(dataResultValue.siiStatus) || isSiiAcceptedStatus(incomingSiiStatus);
  let materialized: EvidenceMaterializationResult | null = null;
  if (accepted && issuedResult.kind === "issued") {
    try {
      materialized = await materializeInvoiceEvidence({ invoiceId: invoice.id, result: issuedResult, payload: await payloadForInvoice(db, invoice.paymentOrderId), expectedIssuerRut: invoice.tenantRut });
    } catch (error) {
      materialized = { status: "failed", signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null, errorCode: error instanceof AppError ? error.code : "EVIDENCE_GENERATION_FAILED", errorMessage: error instanceof AppError ? error.message : "No se pudo materializar la evidencia fiscal." };
    }
  }
  await db.transaction(async (tx) => {
    const currentRows = await tx.select().from(invoices).where(eq(invoices.id, invoice.id)).limit(1).execute();
    const current = currentRows[0] ?? invoice;
    const terminal = (current.status === "issued" && isSiiAcceptedStatus(current.siiStatus)) || current.status === "rejected";
    const effectiveSiiStatus = incomingSiiStatus ?? (accepted ? "DOK" : current.siiStatus);
    const nextStatus = terminal ? current.status : eventLower === "dte.rejected" ? "rejected" : accepted ? "issued" : eventLower === "dte.enqueued" ? "pending" : "processing";
    const evidenceStatus = accepted ? materialized?.status === "complete" ? "complete" : materialized?.status === "failed" ? "failed" : current.evidenceStatus === "complete" ? "complete" : "pending" : current.evidenceStatus;
    const effectiveTenantRut = current.tenantRut;
    const evidencePending = accepted && evidenceStatus === "pending";
    const evidenceError = materialized?.status === "complete" ? null : materialized?.errorMessage ?? (evidencePending ? "La factura fue aceptada; falta almacenar su evidencia tributaria." : current.evidenceError);
    const evidenceErrorCode = materialized?.status === "complete" ? null : materialized?.errorCode ?? (evidencePending ? "SIGNED_XML_PENDING" : nextStatus === "rejected" ? "SII_REJECTED" : current.lastErrorCode);
    const evidenceErrorMessage = materialized?.status === "complete" ? null : materialized?.errorMessage ?? (evidencePending ? "La factura fue aceptada; evidencia tributaria pendiente." : nextStatus === "rejected" ? incomingSiiGlosa ?? "Documento rechazado por el proveedor." : current.lastErrorMessage);
    await tx.update(invoices).set({ status: nextStatus, tenantRut: effectiveTenantRut, providerDocumentId: dteRecordId ?? current.providerDocumentId, folio: dataResultValue.folio ?? current.folio, trackId: incomingTrackId ?? current.trackId, siiStatus: effectiveSiiStatus, siiGlosa: incomingSiiGlosa ?? current.siiGlosa, signedXmlEvidenceId: materialized?.signedXmlEvidenceId ?? current.signedXmlEvidenceId, reconstructedPdfEvidenceId: materialized?.reconstructedPdfEvidenceId ?? current.reconstructedPdfEvidenceId, evidenceStatus, evidenceError, rejectedAt: nextStatus === "rejected" ? new Date() : current.rejectedAt, issuedAt: nextStatus === "issued" ? current.issuedAt ?? new Date() : current.issuedAt, lastErrorCode: evidenceErrorCode, lastErrorMessage: evidenceErrorMessage, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    if (nextStatus === "issued") await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date(), updatedAt: new Date() }).where(and(eq(paymentOrders.id, current.paymentOrderId), inArray(paymentOrders.status, ["draft", "issued", "paid"])));
    await tx.update(intellyDteWebhookEvents).set({ processedAt: new Date() }).where(eq(intellyDteWebhookEvents.providerEventId, eventId));
    await tx.insert(auditEvents).values(buildAuditEvent({ actorType: "system", action: "invoice.webhook_updated", entityType: "invoice", entityId: invoice.id, metadata: { eventId, event, dteRecordId, tenantRut: effectiveTenantRut, status: nextStatus, evidenceStatus } }));
  });
  return { accepted: true, duplicate: false, eventId, status: "processed" };
}

export async function reconcileInvoiceStatus(invoiceId: string, gateway?: IntellyDteGateway): Promise<InvoiceResult> {
  const [invoice] = await getDb().select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1).execute();
  if (!invoice?.providerDocumentId) throw new AppError("INVOICE_PROVIDER_ID_MISSING", "La factura aún no tiene un identificador de proveedor.", 409);
  return (gateway ?? await getIntellyDteGateway()).getInvoiceStatus(invoice.providerDocumentId);
}

export async function refreshInvoiceStatus(invoiceId: string, userId: string, gateway?: IntellyDteGateway): Promise<InvoiceResult> {
  const db = getDb();
  const [invoice] = await db.select().from(invoices).where(eq(invoices.id, invoiceId)).limit(1).execute();
  if (!invoice?.providerDocumentId) throw new AppError("INVOICE_PROVIDER_ID_MISSING", "La factura aún no tiene un identificador de proveedor.", 409);
  if (invoice.status === "issued" && invoice.signedXmlEvidenceId && !invoice.reconstructedPdfEvidenceId) {
    try {
      const reconstructed = await retryLocalPdf(invoice.id);
      await db.update(invoices).set({ reconstructedPdfEvidenceId: reconstructed.id, evidenceStatus: "complete", evidenceError: null, lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
      await db.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: "invoice.pdf_reconstructed", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: invoice.providerDocumentId, folio: invoice.folio } }));
      return { kind: "issued", providerDocumentId: invoice.providerDocumentId, folio: invoice.folio ?? "", issuedAt: invoice.issuedAt?.toISOString() ?? new Date().toISOString(), trackId: invoice.trackId, siiStatus: invoice.siiStatus, siiGlosa: invoice.siiGlosa };
    } catch (error) {
      const safe = error instanceof AppError ? error : new AppError("PDF_RECONSTRUCTION_FAILED", "No se pudo reconstruir el PDF fiscal.", 500);
      await db.update(invoices).set({ evidenceStatus: "failed", evidenceError: safe.message.slice(0, 300), lastErrorCode: safe.code, lastErrorMessage: safe.message.slice(0, 300), updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
      throw safe;
    }
  }
  if (!invoice.signedXmlEvidenceId) {
    const recovered = await recoverStoredEmissionEvidence(db, invoice, userId);
    if (recovered) return recovered;
  }
  const payload = await payloadForInvoice(db, invoice.paymentOrderId);
  const previousAttempt = await latestAttempt(db, invoice.id);
  const attempt = await createAttempt(db, invoice.id, `invoice:${invoice.paymentOrderId}`, requestHash(payload), payload, (previousAttempt?.attemptNumber ?? 0) + 1, "reconcile_invoice_status");
  const result = await (gateway ?? await getIntellyDteGateway()).getInvoiceStatus(invoice.providerDocumentId);
  return applyInvoiceResult(db, invoice, invoice.paymentOrderId, attempt.id, result, payload, userId);
}
