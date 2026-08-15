import { randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gt, inArray, isNull, like, or, type SQL } from "drizzle-orm";
import { getDb } from "@/db";
import { auditEvents, catalogItems, clients, paymentOrderLines, paymentOrders, payments } from "@/db/schema";
import { buildAuditEvent } from "@/features/audit/service";
import { AppError } from "@/lib/errors";
import { hashToken, randomToken } from "@/lib/security";
import { assertClientCanReceiveOrder, assertEditableOrder, assertOrderTotalPositive, assertTransition, calculateOrder, type OrderLineInput } from "./domain";
import { clp } from "@/lib/money";
import type { DraftOrderCsvRow } from "./csv";
import { normalizeRutKey } from "@/features/clients/csv";
import type { PageQuery, PageResult } from "@/lib/list-query";
import { orderCartSchema, type OrderCartInput } from "./validation";
import { validateUnitPriceOverride, type OrderActorRole } from "./price-policy";
import { encryptPublicToken } from "./public-token";
import { isPublicOrderAccessible } from "./public-access";

const orderFields = { id: paymentOrders.id, number: paymentOrders.number, status: paymentOrders.status, total: paymentOrders.total, createdAt: paymentOrders.createdAt, clientName: clients.legalName, clientEmail: clients.email };
type OrderListItem = { id: string; number: string; status: "draft" | "issued" | "paid" | "expired" | "cancelled" | "invoiced"; total: string; createdAt: Date; clientName: string; clientEmail: string };

export function listOrders(): Promise<OrderListItem[]>;
export function listOrders(query: PageQuery): Promise<PageResult<OrderListItem>>;
export async function listOrders(query?: PageQuery): Promise<OrderListItem[] | PageResult<OrderListItem>> {
  const db = getDb();
  const base = db.select(orderFields).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId));
  if (!query) return base.orderBy(desc(paymentOrders.createdAt), desc(paymentOrders.id)).execute();

  const conditions: SQL[] = [];
  if (query.q) {
    const search = `%${query.q}%`;
    conditions.push(or(like(paymentOrders.number, search), like(clients.legalName, search))!);
  }
  const status = query.status ?? query.tab;
  if (status === "draft" || status === "issued" || status === "paid" || status === "expired" || status === "cancelled" || status === "invoiced") conditions.push(eq(paymentOrders.status, status));
  const where = conditions.length ? and(...conditions) : undefined;
  const itemsQuery = where ? base.where(where) : base;
  const [items, [{ value: total }]] = await Promise.all([
    itemsQuery.orderBy(desc(paymentOrders.createdAt), desc(paymentOrders.id)).limit(query.pageSize).offset((query.page - 1) * query.pageSize).execute(),
    (where ? db.select({ value: count() }).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(where) : db.select({ value: count() }).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId))).execute(),
  ]);
  return { items, page: query.page, pageSize: query.pageSize, total: Number(total) };
}

function decimalToMinor(value: string | number): bigint {
  const normalized = String(value).trim();
  const match = /^(\d+)(?:\.(\d+))?$/.exec(normalized);
  if (!match) throw new AppError("INVALID_MONEY", "El monto no es válido.");
  const fraction = match[2] ?? "";
  const roundedFraction = fraction.length > 0 && Number(`0.${fraction}`) >= 0.5 ? 1n : 0n;
  return BigInt(match[1]) + roundedFraction;
}

function orderNumber(id: string): string {
  return `OP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;
}

async function resolveCartLines(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], input: OrderCartInput, role: OrderActorRole): Promise<{ item: typeof catalogItems["$inferSelect"]; line: OrderLineInput }[]> {
  const resolved: { item: typeof catalogItems["$inferSelect"]; line: OrderLineInput }[] = [];
  for (const line of input.lines) {
    const [item] = await tx.select().from(catalogItems).where(eq(catalogItems.id, line.catalogItemId)).limit(1).for("update").execute();
    if (!item || item.status !== "active") throw new AppError("ITEM_NOT_FOUND", "El producto o servicio no está disponible.", 404);
    const unitPrice = validateUnitPriceOverride(line.unitPrice, item.unitPrice, role);
    resolved.push({
      item,
      line: {
        catalogItemId: item.id,
        code: item.code,
        description: item.name,
        quantity: line.quantity,
        unitPrice: clp(unitPrice),
        taxRate: Number(item.taxRate),
        taxCategory: item.taxCategory,
      },
    });
  }
  return resolved;
}

function auditOrder(tx: Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], userId: string, action: "order.created" | "order.updated" | "order.issued" | "order.paid", id: string, metadata: Record<string, unknown>) {
  return tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action, entityType: "payment_order", entityId: id, metadata }));
}

export async function createOrderFromCart(input: OrderCartInput, userId: string, role: OrderActorRole = "operator"): Promise<string> {
  const parsed = orderCartSchema.parse(input);
  return getDb().transaction(async (tx) => {
    const [client] = await tx.select({ id: clients.id, status: clients.status }).from(clients).where(eq(clients.id, parsed.clientId)).limit(1).for("update").execute();
    if (!client) throw new AppError("CLIENT_NOT_FOUND", "Cliente no encontrado.", 404);
    assertClientCanReceiveOrder(client.status);
    const resolved = await resolveCartLines(tx, parsed, role);
    const calculated = calculateOrder(resolved.map(({ line }) => line), parsed.discountPercent, parsed.discountReason);
    const id = randomUUID();
    await tx.insert(paymentOrders).values({
      id,
      number: orderNumber(id),
      clientId: parsed.clientId,
      status: "draft",
      currency: "CLP",
      subtotal: String(calculated.subtotal.minor),
      discountTotal: String(calculated.discount.minor),
      discountPercent: parsed.discountPercent.toFixed(2),
      discountReason: calculated.discountReason || null,
      taxTotal: String(calculated.tax.minor),
      total: String(calculated.total.minor),
      dueAt: parsed.dueAt,
      notes: parsed.notes || null,
      createdBy: userId,
      updatedBy: userId,
    });
    await tx.insert(paymentOrderLines).values(calculated.lines.map((line, index) => ({
      id: randomUUID(),
      paymentOrderId: id,
      catalogItemId: line.catalogItemId,
      code: line.code,
      description: line.description,
      quantity: String(line.quantity),
      unitPrice: String(line.unitPrice.minor),
      discountAmount: String(line.discountAmount.minor),
      taxRate: resolved[index]?.item.taxRate ?? String(line.taxRate),
      subtotal: String(line.subtotal.minor),
      taxAmount: String(line.taxAmount.minor),
      total: String(line.total.minor),
      sortOrder: index,
    })));
    await auditOrder(tx, userId, "order.created", id, { lineCount: calculated.lines.length, discount: String(calculated.discount.minor) });
    return id;
  });
}

export async function createOrder(input: { clientId: string; catalogItemId: string; quantity: number; userId: string }, role: OrderActorRole = "operator") {
  const [item] = await getDb().select({ unitPrice: catalogItems.unitPrice }).from(catalogItems).where(eq(catalogItems.id, input.catalogItemId)).limit(1).execute();
  if (!item) throw new AppError("ITEM_NOT_FOUND", "El producto o servicio no está disponible.", 404);
  return createOrderFromCart({ clientId: input.clientId, lines: [{ catalogItemId: input.catalogItemId, quantity: input.quantity, unitPrice: Number(decimalToMinor(item.unitPrice)) }], discountPercent: 0, discountReason: "" }, input.userId, role);
}

export type UpdateOrderInput = OrderCartInput & { id: string };

export type OrderUpdateResult = { publicToken?: string; publicLink?: string };

function sameDate(left: Date | null | undefined, right: Date | null | undefined): boolean {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null);
}

function orderPublicDataChanged(order: typeof paymentOrders["$inferSelect"], previousLines: Array<typeof paymentOrderLines["$inferSelect"]>, nextLines: ReturnType<typeof calculateOrder>["lines"], input: OrderCartInput): boolean {
  if (order.clientId !== input.clientId || !sameDate(order.dueAt, input.dueAt) || (order.notes ?? "") !== (input.notes ?? "") || Number(order.discountPercent) !== input.discountPercent || (order.discountReason ?? "") !== input.discountReason) return true;
  if (previousLines.length !== nextLines.length) return true;
  return previousLines.some((line, index) => {
    const next = nextLines[index];
    return !next || line.catalogItemId !== next.catalogItemId || line.code !== next.code || line.description !== next.description || Number(line.quantity) !== next.quantity || decimalToMinor(line.unitPrice) !== next.unitPrice.minor || decimalToMinor(line.discountAmount) !== next.discountAmount.minor || Number(line.taxRate) !== next.taxRate || decimalToMinor(line.subtotal) !== next.subtotal.minor || decimalToMinor(line.taxAmount) !== next.taxAmount.minor || decimalToMinor(line.total) !== next.total.minor;
  });
}

export async function updateOrderFromCart(input: UpdateOrderInput, userId: string, expectedVersion = input.expectedVersion ?? 1, role: OrderActorRole = "operator"): Promise<OrderUpdateResult> {
  const { id, ...rawInput } = input;
  const parsed = orderCartSchema.parse(rawInput);
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, id)).limit(1).for("update").execute();
    if (!order) throw new AppError("ORDER_NOT_FOUND", "Orden no encontrada.", 404);
    if (order.version !== expectedVersion) throw new AppError("ORDER_VERSION_CONFLICT", "La orden cambió mientras la editabas. Recarga e intenta nuevamente.", 409);
    assertEditableOrder(order.status);
    const [client] = await tx.select({ id: clients.id, status: clients.status }).from(clients).where(eq(clients.id, parsed.clientId)).limit(1).for("update").execute();
    if (!client) throw new AppError("CLIENT_NOT_FOUND", "Cliente no encontrado.", 404);
    assertClientCanReceiveOrder(client.status);
    const previousLines = await tx.select().from(paymentOrderLines).where(eq(paymentOrderLines.paymentOrderId, id)).orderBy(asc(paymentOrderLines.sortOrder)).execute();
    const resolved = await resolveCartLines(tx, parsed, role);
    const calculated = calculateOrder(resolved.map(({ line }) => line), parsed.discountPercent, parsed.discountReason);
    const rotatePublicToken = order.status === "issued" && orderPublicDataChanged(order, previousLines, calculated.lines, parsed);
    const token = rotatePublicToken ? randomToken() : undefined;
    const encryptedToken = token ? encryptPublicToken(token) : undefined;
    const updateResult = await tx.update(paymentOrders).set({
      clientId: parsed.clientId,
      subtotal: String(calculated.subtotal.minor),
      discountTotal: String(calculated.discount.minor),
      discountPercent: parsed.discountPercent.toFixed(2),
      discountReason: calculated.discountReason || null,
      taxTotal: String(calculated.tax.minor),
      total: String(calculated.total.minor),
      dueAt: parsed.dueAt,
      notes: parsed.notes || null,
      ...(rotatePublicToken ? { publicTokenHash: hashToken(token!), publicTokenCiphertext: encryptedToken!.ciphertext, publicTokenIv: encryptedToken!.iv, publicTokenAuthTag: encryptedToken!.authTag, publicExpiresAt: new Date(Date.now() + 30 * 86_400_000), publicRevokedAt: null } : {}),
      updatedBy: userId,
      updatedAt: new Date(),
      version: order.version + 1,
    }).where(and(eq(paymentOrders.id, id), eq(paymentOrders.version, expectedVersion))).execute();
    if (Number(updateResult[0]?.affectedRows ?? 0) !== 1) throw new AppError("ORDER_VERSION_CONFLICT", "La orden cambió mientras la editabas. Recarga e intenta nuevamente.", 409);
    await tx.delete(paymentOrderLines).where(eq(paymentOrderLines.paymentOrderId, id)).execute();
    await tx.insert(paymentOrderLines).values(calculated.lines.map((line, index) => ({
      id: randomUUID(), paymentOrderId: id, catalogItemId: line.catalogItemId, code: line.code, description: line.description,
      quantity: String(line.quantity), unitPrice: String(line.unitPrice.minor), discountAmount: String(line.discountAmount.minor), taxRate: resolved[index]?.item.taxRate ?? String(line.taxRate),
      subtotal: String(line.subtotal.minor), taxAmount: String(line.taxAmount.minor), total: String(line.total.minor), sortOrder: index,
    })));
    await auditOrder(tx, userId, "order.updated", id, { lineCount: calculated.lines.length, financial: orderPublicDataChanged(order, previousLines, calculated.lines, parsed), publicTokenRotated: Boolean(token) });
    return token ? { publicToken: token, publicLink: `/orden/${token}` } : {};
  });
}

export async function findOrderForEdit(id: string) {
  const [order] = await getDb().select({
    id: paymentOrders.id, number: paymentOrders.number, clientId: paymentOrders.clientId, status: paymentOrders.status, version: paymentOrders.version,
    discountPercent: paymentOrders.discountPercent, discountReason: paymentOrders.discountReason, dueAt: paymentOrders.dueAt, notes: paymentOrders.notes,
    subtotal: paymentOrders.subtotal, discountTotal: paymentOrders.discountTotal, taxTotal: paymentOrders.taxTotal, total: paymentOrders.total,
    clientName: clients.legalName, clientEmail: clients.email,
  }).from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId)).where(eq(paymentOrders.id, id)).limit(1).execute();
  if (!order) return null;
  const lines = await getDb().select().from(paymentOrderLines).where(eq(paymentOrderLines.paymentOrderId, id)).orderBy(asc(paymentOrderLines.sortOrder)).execute();
  return { ...order, lines: lines.map((line) => ({ ...line, quantity: Number(line.quantity), unitPrice: Number(line.unitPrice), taxRate: Number(line.taxRate) })) };
}

export async function hasActiveClient(): Promise<boolean> {
  const [client] = await getDb().select({ id: clients.id }).from(clients).where(eq(clients.status, "active")).limit(1).execute();
  return Boolean(client);
}

export async function hasActiveCatalogItem(): Promise<boolean> {
  const [item] = await getDb().select({ id: catalogItems.id }).from(catalogItems).where(eq(catalogItems.status, "active")).limit(1).execute();
  return Boolean(item);
}

export async function importDraftOrders(rows: DraftOrderCsvRow[], userId: string): Promise<number> {
  const [clientRows, catalogRows] = await Promise.all([
    getDb().select({ id: clients.id, taxId: clients.taxId }).from(clients).where(eq(clients.status, "active")),
    getDb().select().from(catalogItems).where(eq(catalogItems.status, "active")),
  ]);
  const clientsByRut = new Map(clientRows.filter((item) => item.taxId).map((item) => [normalizeRutKey(item.taxId!), item]));
  const catalogByCode = new Map(catalogRows.map((item) => [item.code.toUpperCase(), item]));
  const resolved = rows.map((row, index) => {
    const client = clientsByRut.get(normalizeRutKey(row.clientTaxId));
    if (!client) throw new AppError("CSV_CLIENT_NOT_FOUND", `Fila ${index + 2}: el cliente no existe o está inactivo.`);
    const item = catalogByCode.get(row.catalogCode);
    if (!item) throw new AppError("CSV_ITEM_NOT_FOUND", `Fila ${index + 2}: el producto o servicio no existe o está inactivo.`);
    return { client, item, quantity: row.quantity };
  });
  await getDb().transaction(async (tx) => {
    for (const row of resolved) {
      const calculated = calculateOrder([{ description: row.item.name, quantity: row.quantity, unitPrice: clp(BigInt(row.item.unitPrice.split(".")[0])), taxRate: Number(row.item.taxRate) }]);
      const id = randomUUID();
      const number = `OP-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${id.slice(0, 6).toUpperCase()}`;
      await tx.insert(paymentOrders).values({ id, number, clientId: row.client.id, status: "draft", currency: "CLP", subtotal: String(calculated.subtotal.minor), taxTotal: String(calculated.tax.minor), total: String(calculated.total.minor), createdBy: userId, updatedBy: userId });
      await tx.insert(paymentOrderLines).values({ id: randomUUID(), paymentOrderId: id, catalogItemId: row.item.id, code: row.item.code, description: row.item.name, quantity: String(row.quantity), unitPrice: row.item.unitPrice, taxRate: row.item.taxRate, subtotal: String(calculated.subtotal.minor), taxAmount: String(calculated.tax.minor), total: String(calculated.total.minor) });
    }
    await tx.insert(auditEvents).values(buildAuditEvent({ actorUserId: userId, actorType: "user", action: "orders.imported", entityType: "payment_order", metadata: { created: resolved.length } }));
  });
  return resolved.length;
}

export async function issueOrder(id: string, userId: string) {
  return getDb().transaction(async (tx) => {
    const [order] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, id)).limit(1).for("update").execute();
    if (!order) throw new AppError("ORDER_NOT_FOUND", "Orden no encontrada.", 404);
    assertOrderTotalPositive(order.total);
    assertTransition(order.status, "issued");
    const token = randomToken();
    const encryptedToken = encryptPublicToken(token);
    const result = await tx.update(paymentOrders).set({ status: "issued", issuedAt: new Date(), publicTokenHash: hashToken(token), publicTokenCiphertext: encryptedToken.ciphertext, publicTokenIv: encryptedToken.iv, publicTokenAuthTag: encryptedToken.authTag, publicExpiresAt: new Date(Date.now() + 30 * 86_400_000), publicRevokedAt: null, updatedBy: userId, version: order.version + 1 }).where(and(eq(paymentOrders.id, id), eq(paymentOrders.version, order.version))).execute();
    if (Number(result[0]?.affectedRows ?? 0) !== 1) throw new AppError("ORDER_VERSION_CONFLICT", "La orden cambió mientras se emitía. Intenta nuevamente.", 409);
    await auditOrder(tx, userId, "order.issued", id, { publicTokenRotated: true });
    return token;
  });
}

export async function markOrderPaid(id: string, userId: string, idempotencyKey: string) {
  return getDb().transaction(async (tx) => {
    const [existing] = await tx.select().from(payments).where(eq(payments.idempotencyKey, idempotencyKey)).limit(1).execute();
    if (existing) return existing.id;
    const [order] = await tx.select().from(paymentOrders).where(eq(paymentOrders.id, id)).limit(1).for("update").execute();
    if (!order) throw new AppError("ORDER_NOT_FOUND", "Orden no encontrada.", 404);
    assertTransition(order.status, "paid");
    const paymentId = randomUUID();
    await tx.insert(payments).values({ id: paymentId, paymentOrderId: id, idempotencyKey, amount: order.total, currency: order.currency, method: "manual", paidAt: new Date(), recordedBy: userId });
    const result = await tx.update(paymentOrders).set({ status: "paid", paidAt: new Date(), updatedBy: userId, version: order.version + 1 }).where(and(eq(paymentOrders.id, id), eq(paymentOrders.version, order.version))).execute();
    if (Number(result[0]?.affectedRows ?? 0) !== 1) throw new AppError("ORDER_VERSION_CONFLICT", "La orden cambió mientras se registraba el pago. Intenta nuevamente.", 409);
    await auditOrder(tx, userId, "order.paid", id, { amount: order.total });
    return paymentId;
  });
}

export async function findPublicOrder(token: string) {
  const [row] = await getDb().select({ number: paymentOrders.number, status: paymentOrders.status, total: paymentOrders.total, dueAt: paymentOrders.dueAt, clientName: clients.legalName, publicTokenHash: paymentOrders.publicTokenHash, publicExpiresAt: paymentOrders.publicExpiresAt, publicRevokedAt: paymentOrders.publicRevokedAt })
    .from(paymentOrders).innerJoin(clients, eq(clients.id, paymentOrders.clientId))
    .where(and(
      eq(paymentOrders.publicTokenHash, hashToken(token)),
      inArray(paymentOrders.status, ["issued", "paid", "invoiced"]),
      gt(paymentOrders.publicExpiresAt, new Date()),
      isNull(paymentOrders.publicRevokedAt),
    )).limit(1).execute();
  if (!row || !isPublicOrderAccessible(row, token)) return null;
  return { number: row.number, status: row.status, total: row.total, dueAt: row.dueAt, clientName: row.clientName };
}
