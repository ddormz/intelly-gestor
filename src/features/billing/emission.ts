import { createHash, createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, clients, intellyDteWebhookEvents, integrationAttempts, invoices, paymentOrderLines, paymentOrders } from "@/db/schema";
import { getIntellyDteWebhookSecret } from "@/features/integrations/config-service";
import { getIntellyDteConfig, normalizeIntellyDteTenantRut } from "@/features/integrations/config-service";
import { getIntellyDteGateway, type IntellyDteGateway, type InvoiceResult } from "@/features/integrations/intellydte";
import { providerData, type IntellyDteFacturaPayload } from "@/features/integrations/intellydte-contract";
import { validChileanRut } from "@/features/clients/validation";
import { getEnv } from "@/lib/env";
import { AppError } from "@/lib/errors";
import { getFiscalEvidenceArtifact, storeReconstructedPdf, storeSignedXmlBytes } from "./evidence";
import { parseSignedDteXmlBytes, renderFiscalPdf } from "./xml";
import { buildAuditEvent } from "@/features/audit/service";
import { redactMetadata } from "@/lib/errors";

type FiscalClientSnapshot = { taxId: string | null; legalName: string; giro: string | null; addressLine: string | null; commune: string | null; city: string | null; email?: string };
type FiscalOrderSnapshot = { subtotal?: string; total: string; taxTotal: string; discountTotal: string; notes: string | null };
type FiscalLineSnapshot = { description: string; quantity: string; unitPrice: string; subtotal: string; discountAmount: string; taxRate: string; taxAmount: string; total: string };

export function buildFacturaPayload(input: { client: FiscalClientSnapshot; order: FiscalOrderSnapshot; lines: FiscalLineSnapshot[]; issuerRut?: string | null }): IntellyDteFacturaPayload {
  assertDte33Preflight(input);
  const items = input.lines.map((line) => {
    const originalUnitPrice = fiscalMoney(line.unitPrice, "UNIT_PRICE");
    const quantity = Number(line.quantity);
    const originalSubtotal = Math.round(originalUnitPrice * quantity);
    const discountAmount = fiscalMoney(line.discountAmount, "DISCOUNT");
    const item: IntellyDteFacturaPayload["items"][number] = { nombre: line.description, cantidad: quantity, precioUnitario: originalUnitPrice, montoItem: originalSubtotal - discountAmount, exento: Number(line.taxRate) === 0 };
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

export function assertDte33Preflight(input: { client: FiscalClientSnapshot; order: FiscalOrderSnapshot; lines: FiscalLineSnapshot[]; issuerRut?: string | null }): void {
  const receiverFields: Array<[string | null | undefined, string]> = [[input.client.taxId, "RUT"], [input.client.legalName, "RAZON_SOCIAL"], [input.client.giro, "GIRO"], [input.client.addressLine, "DIRECCION"], [input.client.commune, "COMUNA"], [input.client.city, "CIUDAD"]];
  for (const [value, field] of receiverFields) if (!value?.trim()) throw new AppError(`FISCAL_RECEIVER_${field}_REQUIRED`, `La factura requiere ${field.toLowerCase()} del receptor.`, 400);
  if (!validChileanRut(input.client.taxId!)) throw new AppError("FISCAL_RECEIVER_RUT_INVALID", "El RUT del receptor no es válido.", 400);
  if (input.issuerRut !== undefined && (!input.issuerRut || !validChileanRut(input.issuerRut))) throw new AppError("FISCAL_ISSUER_RUT_INVALID", "Configura un RUT emisor válido para IntellyDTE.", 503);
  if (input.lines.length === 0 || input.lines.length > 60) throw new AppError("FISCAL_LINE_LIMIT", "La factura debe tener entre 1 y 60 líneas.", 400);
  const subtotal = input.lines.reduce((sum, line) => {
    const unitPrice = fiscalMoney(line.unitPrice, "UNIT_PRICE");
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
  const match = /^sha256=([a-f0-9]{64})$/i.exec(signatureHeader?.trim() ?? "");
  if (!match || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const received = Buffer.from(match[1]!, "utf8");
  return expected.length === received.length && timingSafeEqual(expected, received);
}

function requestHash(payload: IntellyDteFacturaPayload): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function decodeProviderXml(value: string): Uint8Array {
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(value) || value.length % 4 === 1) throw new AppError("SIGNED_XML_INVALID", "El XML firmado de IntellyDTE no es base64 válido.", 502);
  const bytes = new Uint8Array(Buffer.from(value, "base64"));
  if (!bytes.byteLength) throw new AppError("SIGNED_XML_INVALID", "El XML firmado de IntellyDTE está vacío.", 502);
  return bytes;
}

function normalizeRut(value: string): string {
  const compact = value.replace(/[^0-9kK]/g, "").toUpperCase();
  return compact.length > 1 ? `${compact.slice(0, -1)}-${compact.slice(-1)}` : compact;
}

export function assertProviderMatchesOrder(result: Extract<InvoiceResult, { kind: "issued" }>, document: ReturnType<typeof parseSignedDteXmlBytes>, payload: IntellyDteFacturaPayload, expectedIssuerRut?: string | null): void {
  if (document.type !== "33" || result.tipoDte && result.tipoDte !== "33" || result.printPayload && result.printPayload.signedXmlBase64 && result.printPayload.signedXmlBase64 !== result.signedXmlBase64) throw new AppError("SIGNED_XML_DTE_TYPE_MISMATCH", "El XML firmado no corresponde a una Factura 33.", 502);
  if (String(document.folio) !== String(result.folio)) throw new AppError("SIGNED_XML_FOLIO_MISMATCH", "El folio del XML firmado no coincide con IntellyDTE.", 502);
  if (expectedIssuerRut && normalizeRut(document.issuer.rut) !== normalizeRut(expectedIssuerRut)) throw new AppError("SIGNED_XML_ISSUER_MISMATCH", "El emisor del XML firmado no coincide con la configuración fiscal.", 502);
  if (normalizeRut(document.receiver.rut) !== normalizeRut(payload.receptor.rut) || document.receiver.name.trim() !== payload.receptor.razonSocial.trim()) throw new AppError("SIGNED_XML_RECEIVER_MISMATCH", "El receptor del XML firmado no coincide con la orden.", 502);
  if (document.totals.net !== (payload.montoNeto ?? 0) || document.totals.exempt !== (payload.montoExento ?? 0) || document.totals.iva !== (payload.montoIva ?? 0) || document.totals.total !== payload.montoTotal) throw new AppError("SIGNED_XML_TOTALS_MISMATCH", "Los totales del XML firmado no coinciden con la orden.", 502);
  if (payload.fechaEmision && document.issueDate !== payload.fechaEmision) throw new AppError("SIGNED_XML_DATE_MISMATCH", "La fecha del XML firmado no coincide con la orden.", 502);
  if (document.details.length !== payload.items.length) throw new AppError("SIGNED_XML_DETAIL_COUNT_MISMATCH", "El detalle del XML firmado no coincide con la orden.", 502);
  document.details.forEach((detail, index) => {
    const item = payload.items[index]!;
    if (detail.name.trim() !== item.nombre.trim() || detail.quantity !== item.cantidad || detail.unitPrice !== item.precioUnitario || detail.amount !== item.montoItem || detail.discountAmount !== (item.descuentoMonto ?? 0) || detail.exempt !== Boolean(item.exento)) throw new AppError("SIGNED_XML_DETAIL_MISMATCH", "Una línea del XML firmado no coincide con la orden.", 502);
  });
  if (result.printPayload && result.printPayload.signedXmlBase64 && document.type !== "33") throw new AppError("SIGNED_XML_DTE_TYPE_MISMATCH", "El proveedor devolvió un DTE distinto de 33.", 502);
}

async function materializeEvidence(invoiceId: string, result: Extract<InvoiceResult, { kind: "issued" }>, payload: IntellyDteFacturaPayload, expectedIssuerRut?: string | null) {
  if (!result.signedXmlBase64) return { signed: null, reconstructed: null, error: new AppError("SIGNED_XML_MISSING", "IntellyDTE no devolvió el XML firmado.", 502) };
  const bytes = decodeProviderXml(result.signedXmlBase64);
  const document = parseSignedDteXmlBytes(bytes);
  assertProviderMatchesOrder(result, document, payload, expectedIssuerRut);
  const signed = await storeSignedXmlBytes(invoiceId, { dteType: document.type, folio: document.folio }, bytes);
  try {
    const pdf = await renderFiscalPdf(document);
    const reconstructed = await storeReconstructedPdf(invoiceId, { dteType: document.type, folio: document.folio, rendererVersion: "fiscal-pdf-v2" }, pdf);
    return { document, signed, reconstructed, error: null };
  } catch (error) {
    return { document, signed, reconstructed: null, error: error instanceof AppError ? error : new AppError("PDF_RECONSTRUCTION_FAILED", "No se pudo reconstruir el PDF fiscal.", 500) };
  }
}

async function retryLocalPdf(invoiceId: string) {
  const signed = await getFiscalEvidenceArtifact(invoiceId, "signed_xml");
  if (!signed?.bytes) throw new AppError("SIGNED_XML_MISSING", "No existe XML firmado para reconstruir el PDF.", 409);
  const document = parseSignedDteXmlBytes(signed.bytes);
  const pdf = await renderFiscalPdf(document);
  return storeReconstructedPdf(invoiceId, { dteType: document.type, folio: document.folio, rendererVersion: "fiscal-pdf-v2" }, pdf);
}

function resultMessage(result: InvoiceResult): string {
  return result.kind === "rejected" ? result.safeMessage : result.kind === "pending" ? "Emisión pendiente de conciliación." : result.kind === "unavailable" ? result.safeMessage : "Factura emitida.";
}

type BillingDb = ReturnType<typeof getDb>;

async function latestAttempt(db: BillingDb, invoiceId: string) {
  const rows = await db.select().from(integrationAttempts).where(eq(integrationAttempts.aggregateId, invoiceId)).orderBy(desc(integrationAttempts.attemptNumber)).limit(1).execute();
  return rows[0] ?? null;
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
  if ((invoice.status === "issued" || invoice.status === "rejected") && result.kind !== "issued") {
    await db.update(integrationAttempts).set({ status: "ignored", completedAt: now, providerCode: result.kind === "rejected" ? result.code : result.providerCode, responseBody: providerResponseBody(result), safeMessage: "Evento o conciliación ignorada por estado terminal local." }).where(eq(integrationAttempts.id, attemptId));
    return result;
  }
  if (result.kind === "issued") {
    let evidence: Awaited<ReturnType<typeof materializeEvidence>>;
    try {
      evidence = await materializeEvidence(invoice.id, result, payload, invoice.tenantRut);
    } catch (error) {
      evidence = { signed: null, reconstructed: null, error: error instanceof AppError ? error : new AppError("EVIDENCE_GENERATION_FAILED", "No se pudo materializar la evidencia fiscal.", 500) };
    }
    if (evidence.signed) {
      const localError = evidence.error?.message.slice(0, 300) ?? null;
      await db.transaction(async (tx) => {
        await tx.update(invoices).set({ status: "issued", providerDocumentId: result.providerDocumentId, folio: result.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, signedXmlEvidenceId: evidence.signed.id, reconstructedPdfEvidenceId: evidence.reconstructed?.id ?? invoice.reconstructedPdfEvidenceId, evidenceStatus: evidence.reconstructed ? "complete" : "pending", evidenceError: localError, issuedAt: invoice.issuedAt ?? new Date(result.issuedAt), lastErrorCode: evidence.error ? "PDF_RECONSTRUCTION_RETRYABLE" : null, lastErrorMessage: localError, updatedAt: now }).where(eq(invoices.id, invoice.id));
        await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date(), updatedAt: now }).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.status, "paid")));
        await tx.update(integrationAttempts).set({ status: "issued", completedAt: now, providerCode: result.providerDocumentId, providerDocumentId: result.providerDocumentId, responseBody: providerResponseBody(result), safeMessage: evidence.error ? "Factura emitida; PDF fiscal pendiente de reconstrucción." : "Factura emitida y evidencia fiscal almacenada." }).where(eq(integrationAttempts.id, attemptId));
        await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: "invoice.issued", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: result.providerDocumentId, folio: result.folio, evidenceStatus: evidence.reconstructed ? "complete" : "pending" } }));
      });
      return result;
    }
    if (invoice.signedXmlEvidenceId) {
      let regeneratedPdfId: string | null = null;
      let regenerationError: Error | null = null;
      try { regeneratedPdfId = (await retryLocalPdf(invoice.id)).id; } catch (error) { regenerationError = error instanceof Error ? error : new Error("PDF_RECONSTRUCTION_FAILED"); }
      await db.transaction(async (tx) => {
        await tx.update(invoices).set({ status: "issued", providerDocumentId: result.providerDocumentId, folio: result.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, reconstructedPdfEvidenceId: regeneratedPdfId ?? invoice.reconstructedPdfEvidenceId, evidenceStatus: regeneratedPdfId ? "complete" : "pending", evidenceError: regenerationError?.message.slice(0, 300) ?? null, lastErrorCode: regeneratedPdfId ? null : "PDF_RECONSTRUCTION_RETRYABLE", lastErrorMessage: regenerationError ? "Factura emitida; PDF fiscal pendiente de reconstrucción." : null, issuedAt: invoice.issuedAt ?? new Date(result.issuedAt), updatedAt: now }).where(eq(invoices.id, invoice.id));
        await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date(), updatedAt: now }).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.status, "paid")));
        await tx.update(integrationAttempts).set({ status: "issued", completedAt: now, providerCode: result.providerDocumentId, providerDocumentId: result.providerDocumentId, responseBody: providerResponseBody(result), safeMessage: "Factura emitida; PDF fiscal pendiente de reconstrucción." }).where(eq(integrationAttempts.id, attemptId));
      });
      return result;
    }
    await db.transaction(async (tx) => {
      await tx.update(invoices).set({ status: "issued", providerDocumentId: result.providerDocumentId, folio: result.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, evidenceStatus: "pending", evidenceError: evidence.error?.message.slice(0, 300) ?? "Falta XML firmado.", issuedAt: invoice.issuedAt ?? new Date(result.issuedAt), lastErrorCode: "SIGNED_XML_PENDING", lastErrorMessage: "La factura fue aceptada; falta almacenar el XML firmado.", updatedAt: now }).where(eq(invoices.id, invoice.id));
      await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date(), updatedAt: now }).where(and(eq(paymentOrders.id, orderId), eq(paymentOrders.status, "paid")));
      await tx.update(integrationAttempts).set({ status: "issued", completedAt: now, providerCode: result.providerDocumentId, providerDocumentId: result.providerDocumentId, responseBody: providerResponseBody(result), safeMessage: "Factura aceptada; evidencia tributaria pendiente." }).where(eq(integrationAttempts.id, attemptId));
      await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: "invoice.issued", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: result.providerDocumentId, folio: result.folio, evidenceStatus: "pending" } }));
    });
    return result;
  }
  const status = result.kind === "rejected" ? "rejected" : "pending";
  await db.transaction(async (tx) => {
    await tx.update(invoices).set({ status, providerDocumentId: result.providerDocumentId ?? invoice.providerDocumentId, folio: result.folio ?? invoice.folio, trackId: result.trackId ?? invoice.trackId, siiStatus: result.siiStatus ?? invoice.siiStatus, siiGlosa: result.siiGlosa ?? invoice.siiGlosa, lastErrorCode: result.kind === "rejected" ? result.code : result.providerCode ?? "EMISSION_PENDING", lastErrorMessage: resultMessage(result).slice(0, 300), evidenceStatus: invoice.signedXmlEvidenceId ? invoice.evidenceStatus : "pending", updatedAt: now }).where(eq(invoices.id, invoice.id));
    await tx.update(integrationAttempts).set({ status, completedAt: now, providerCode: result.kind === "rejected" ? result.code : result.providerCode, providerDocumentId: result.providerDocumentId, responseBody: providerResponseBody(result), safeMessage: resultMessage(result).slice(0, 300) }).where(eq(integrationAttempts.id, attemptId));
    await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: status === "rejected" ? "invoice.rejected" : "invoice.pending", entityType: "invoice", entityId: invoice.id, metadata: { providerDocumentId: result.providerDocumentId ?? null, providerCode: result.kind === "rejected" ? result.code : result.providerCode ?? null } }));
  });
  return result;
}

export async function issueInvoice(orderId: string, userId: string, gateway?: IntellyDteGateway): Promise<InvoiceResult> {
  const db = getDb();
  const [order] = await db.select({ id: paymentOrders.id, number: paymentOrders.number, status: paymentOrders.status, subtotal: paymentOrders.subtotal, total: paymentOrders.total, taxTotal: paymentOrders.taxTotal, discountTotal: paymentOrders.discountTotal, notes: paymentOrders.notes, clientId: clients.id, clientTaxId: clients.taxId, clientName: clients.legalName, clientGiro: clients.giro, clientAddress: clients.addressLine, clientCommune: clients.commune, clientCity: clients.city, clientEmail: clients.email }).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.id, orderId)).limit(1).execute();
  if (!order || order.status !== "paid") throw new AppError("NOT_INVOICEABLE", "La orden debe estar pagada.", 409);
  const lines = await db.select({ description: paymentOrderLines.description, quantity: paymentOrderLines.quantity, unitPrice: paymentOrderLines.unitPrice, subtotal: paymentOrderLines.subtotal, discountAmount: paymentOrderLines.discountAmount, taxRate: paymentOrderLines.taxRate, taxAmount: paymentOrderLines.taxAmount, total: paymentOrderLines.total }).from(paymentOrderLines).where(eq(paymentOrderLines.paymentOrderId, orderId)).orderBy(paymentOrderLines.sortOrder).execute();
  const config = await getIntellyDteConfig();
  const env = getEnv();
  const tenantRut = config?.tenantRut ?? (env.INTELLYDTE_TENANT_RUT || env.INTELLYDTE_COMPANY_TAX_ID ? normalizeIntellyDteTenantRut(env.INTELLYDTE_TENANT_RUT || env.INTELLYDTE_COMPANY_TAX_ID!) : env.INTELLYDTE_MODE === "fake" ? "12345678-5" : null);
  const payload = buildFacturaPayload({ client: { taxId: order.clientTaxId, legalName: order.clientName, giro: order.clientGiro, addressLine: order.clientAddress, commune: order.clientCommune, city: order.clientCity, email: order.clientEmail }, order: { subtotal: order.subtotal, total: order.total, taxTotal: order.taxTotal, discountTotal: order.discountTotal, notes: order.notes }, lines, issuerRut: tenantRut });
  const hash = requestHash(payload);
  const [existing] = await db.select().from(invoices).where(eq(invoices.paymentOrderId, orderId)).limit(1).execute();
  const idempotencyKey = `invoice:${orderId}`;
  const provider = gateway ?? await getIntellyDteGateway();
  if (existing?.status === "issued" && existing.evidenceStatus !== "pending") return { kind: "issued", providerDocumentId: existing.providerDocumentId ?? "", folio: existing.folio ?? "", issuedAt: existing.issuedAt?.toISOString() ?? new Date().toISOString(), trackId: existing.trackId, siiStatus: existing.siiStatus, siiGlosa: existing.siiGlosa };
  const invoiceId = existing?.id ?? randomUUID();
  if (existing && (existing.status === "pending" || existing.status === "processing" || Boolean(existing.providerDocumentId) || existing.evidenceStatus === "pending")) {
    if (!existing.providerDocumentId) return { kind: "pending", providerCode: "STATUS_RECONCILIATION_REQUIRED" };
    const previousAttempt = await latestAttempt(db, invoiceId);
    const attempt = await createAttempt(db, invoiceId, idempotencyKey, hash, payload, (previousAttempt?.attemptNumber ?? 0) + 1, "reconcile_invoice_status");
    const statusResult = await provider.getInvoiceStatus(existing.providerDocumentId);
    return applyInvoiceResult(db, existing, orderId, attempt.id, statusResult, payload, userId);
  }
  if (!existing) await db.insert(invoices).values({ id: invoiceId, paymentOrderId: orderId, status: "processing", requestHash: hash, tenantRut });
  else await db.update(invoices).set({ status: "processing", requestHash: hash, lastErrorCode: null, lastErrorMessage: null, updatedAt: new Date() }).where(eq(invoices.id, invoiceId));
  const previousAttempt = await latestAttempt(db, invoiceId);
  const attempt = await createAttempt(db, invoiceId, idempotencyKey, hash, payload, (previousAttempt?.attemptNumber ?? 0) + 1);
  const result = await provider.issueInvoice({ idempotencyKey, correlationId: attempt.correlationId, orderNumber: order.number, total: order.total, recipientTaxId: order.clientTaxId ?? "", payload });
  return applyInvoiceResult(db, { ...(existing ?? { id: invoiceId, paymentOrderId: orderId, status: "processing", providerDocumentId: null, folio: null, trackId: null, siiStatus: null, siiGlosa: null, signedXmlEvidenceId: null, reconstructedPdfEvidenceId: null, evidenceStatus: "pending", evidenceError: null, issuedAt: null }) } as typeof invoices["$inferSelect"], orderId, attempt.id, result, payload, userId);
}

function eventData(payload: Record<string, unknown>): Record<string, unknown> {
  return payload.data && typeof payload.data === "object" ? payload.data as Record<string, unknown> : payload;
}

async function payloadForInvoice(db: BillingDb, paymentOrderId: string): Promise<IntellyDteFacturaPayload> {
  const [order] = await db.select({ subtotal: paymentOrders.subtotal, total: paymentOrders.total, taxTotal: paymentOrders.taxTotal, discountTotal: paymentOrders.discountTotal, notes: paymentOrders.notes, clientTaxId: clients.taxId, clientName: clients.legalName, clientGiro: clients.giro, clientAddress: clients.addressLine, clientCommune: clients.commune, clientCity: clients.city, clientEmail: clients.email }).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.id, paymentOrderId)).limit(1).execute();
  if (!order) throw new AppError("INVOICE_ORDER_MISSING", "La orden de la factura no existe.", 404);
  const lines = await db.select({ description: paymentOrderLines.description, quantity: paymentOrderLines.quantity, unitPrice: paymentOrderLines.unitPrice, subtotal: paymentOrderLines.subtotal, discountAmount: paymentOrderLines.discountAmount, taxRate: paymentOrderLines.taxRate, taxAmount: paymentOrderLines.taxAmount, total: paymentOrderLines.total }).from(paymentOrderLines).where(eq(paymentOrderLines.paymentOrderId, paymentOrderId)).orderBy(paymentOrderLines.sortOrder).execute();
  return buildFacturaPayload({ client: { taxId: order.clientTaxId, legalName: order.clientName, giro: order.clientGiro, addressLine: order.clientAddress, commune: order.clientCommune, city: order.clientCity, email: order.clientEmail }, order: { subtotal: order.subtotal, total: order.total, taxTotal: order.taxTotal, discountTotal: order.discountTotal, notes: order.notes }, lines });
}

export type WebhookResult = { accepted: true; duplicate: boolean; eventId: string; status: string };

export async function handleIntellyDteWebhook(rawBody: string, signature: string | null | undefined, secret?: string): Promise<WebhookResult> {
  const webhookSecret = secret ?? await getIntellyDteWebhookSecret();
  if (!webhookSecret || !verifyIntellyDteSignature(rawBody, signature, webhookSecret)) throw new AppError("INVALID_WEBHOOK_SIGNATURE", "Firma de webhook inválida.", 401);
  let body: Record<string, unknown>;
  try { body = JSON.parse(rawBody) as Record<string, unknown>; } catch { throw new AppError("INVALID_WEBHOOK_BODY", "El webhook no contiene JSON válido.", 400); }
  const data = eventData(body);
  const eventId = String(body.eventId ?? body.event_id ?? data.eventId ?? data.event_id ?? body.id ?? "").trim();
  const event = String(body.event ?? body.type ?? "").trim();
  if (!eventId || !event) throw new AppError("INVALID_WEBHOOK_BODY", "El webhook requiere eventId y event.", 400);
  const dteRecordId = String(data.dteRecordId ?? data.dte_record_id ?? "").trim() || null;
  const tenantRut = normalizeRut(String(data.tenantRut ?? data.tenant_rut ?? body.rutEmisor ?? body.rut_emisor ?? "").trim()) || null;
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
  if (!dteRecordId) {
    await db.update(intellyDteWebhookEvents).set({ processedAt: new Date(), payload: redactMetadata(body) }).where(eq(intellyDteWebhookEvents.providerEventId, eventId));
    return { accepted: true, duplicate: false, eventId, status: "acknowledged_without_target" };
  }
  const [invoice] = await db.select().from(invoices).where(eq(invoices.providerDocumentId, dteRecordId)).limit(1).execute();
  if (!invoice) {
    await db.update(intellyDteWebhookEvents).set({ processedAt: new Date() }).where(eq(intellyDteWebhookEvents.providerEventId, eventId));
    return { accepted: true, duplicate: false, eventId, status: "acknowledged_without_target" };
  }
  if (tenantRut && invoice.tenantRut && normalizeRut(tenantRut) !== normalizeRut(invoice.tenantRut)) {
    await db.update(intellyDteWebhookEvents).set({ processedAt: new Date() }).where(eq(intellyDteWebhookEvents.providerEventId, eventId));
    return { accepted: true, duplicate: false, eventId, status: "acknowledged_without_target" };
  }
  const dataResultValue = providerData(body);
  const issuedResult: InvoiceResult = dataResultValue.folio && dataResultValue.printPayload?.signedXmlBase64 ? { kind: "issued", providerDocumentId: dteRecordId, folio: dataResultValue.folio, tipoDte: dataResultValue.tipoDte, issuedAt: dataResultValue.issuedAt ?? new Date().toISOString(), trackId: dataResultValue.trackId, siiStatus: dataResultValue.siiStatus, siiGlosa: dataResultValue.siiGlosa, signedXmlBase64: dataResultValue.printPayload.signedXmlBase64, printPayload: dataResultValue.printPayload, providerBody: body } : { kind: "pending", providerDocumentId: dteRecordId, folio: dataResultValue.folio, trackId: dataResultValue.trackId, siiStatus: dataResultValue.siiStatus, siiGlosa: dataResultValue.siiGlosa, providerBody: body };
  let materialized: Awaited<ReturnType<typeof materializeEvidence>> | null = null;
  if (event === "dte.accepted" && issuedResult.kind === "issued") {
    try { materialized = await materializeEvidence(invoice.id, issuedResult, await payloadForInvoice(db, invoice.paymentOrderId), invoice.tenantRut); } catch (error) { materialized = { signed: null, reconstructed: null, error: error instanceof AppError ? error : new AppError("EVIDENCE_GENERATION_FAILED", "No se pudo materializar la evidencia fiscal.", 500) }; }
  }
  await db.transaction(async (tx) => {
    const currentRows = await tx.select().from(invoices).where(eq(invoices.id, invoice.id)).limit(1).execute();
    const current = currentRows[0] ?? invoice;
    const incomingTrackId = typeof data.trackId === "string" ? data.trackId : typeof data.track_id === "string" ? data.track_id : undefined;
    const incomingSiiStatus = typeof data.siiStatus === "string" ? data.siiStatus : typeof data.sii_status === "string" ? data.sii_status : undefined;
    const incomingSiiGlosa = typeof data.siiGlosa === "string" ? data.siiGlosa : typeof data.sii_glosa === "string" ? data.sii_glosa : undefined;
    const terminal = current.status === "issued" || current.status === "rejected";
    const accepted = event === "dte.accepted";
    const nextStatus = terminal ? current.status : event === "dte.rejected" ? "rejected" : accepted ? "issued" : event === "dte.enqueued" ? "pending" : "processing";
    const evidenceStatus = accepted ? materialized?.reconstructed ? "complete" : current.evidenceStatus === "complete" ? "complete" : "pending" : current.evidenceStatus;
    const effectiveTenantRut = current.tenantRut ?? tenantRut;
    const evidencePending = accepted && evidenceStatus !== "complete";
    await tx.update(invoices).set({ status: nextStatus, tenantRut: effectiveTenantRut, providerDocumentId: dteRecordId, folio: dataResultValue.folio ?? current.folio, trackId: incomingTrackId ?? current.trackId, siiStatus: incomingSiiStatus ?? current.siiStatus, siiGlosa: incomingSiiGlosa ?? current.siiGlosa, signedXmlEvidenceId: materialized?.signed?.id ?? current.signedXmlEvidenceId, reconstructedPdfEvidenceId: materialized?.reconstructed?.id ?? current.reconstructedPdfEvidenceId, evidenceStatus, evidenceError: materialized?.error?.message.slice(0, 300) ?? (evidencePending ? "La factura fue aceptada; falta almacenar su evidencia tributaria." : current.evidenceError), rejectedAt: nextStatus === "rejected" ? new Date() : current.rejectedAt, issuedAt: nextStatus === "issued" ? current.issuedAt ?? new Date() : current.issuedAt, lastErrorCode: materialized?.error ? "PDF_RECONSTRUCTION_RETRYABLE" : evidencePending ? "SIGNED_XML_PENDING" : nextStatus === "rejected" ? "SII_REJECTED" : current.lastErrorCode, lastErrorMessage: materialized?.error?.message.slice(0, 300) ?? (evidencePending ? "La factura fue aceptada; evidencia tributaria pendiente." : nextStatus === "rejected" ? incomingSiiGlosa ?? "Documento rechazado por el proveedor." : current.lastErrorMessage), updatedAt: new Date() }).where(eq(invoices.id, invoice.id));
    if (nextStatus === "issued") await tx.update(paymentOrders).set({ status: "invoiced", invoicedAt: new Date(), updatedAt: new Date() }).where(and(eq(paymentOrders.id, current.paymentOrderId), eq(paymentOrders.status, "paid")));
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
  const payload = await payloadForInvoice(db, invoice.paymentOrderId);
  const previousAttempt = await latestAttempt(db, invoice.id);
  const attempt = await createAttempt(db, invoice.id, `invoice:${invoice.paymentOrderId}`, requestHash(payload), payload, (previousAttempt?.attemptNumber ?? 0) + 1, "reconcile_invoice_status");
  const result = await (gateway ?? await getIntellyDteGateway()).getInvoiceStatus(invoice.providerDocumentId);
  return applyInvoiceResult(db, invoice, invoice.paymentOrderId, attempt.id, result, payload, userId);
}
