import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  datetime,
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const timestamps = {
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
  updatedAt: datetime("updated_at", { mode: "date" }).notNull().default(sql`(now())`),
};

export const users = mysqlTable("users", {
  id: varchar("id", { length: 36 }).primaryKey(),
  email: varchar("email", { length: 254 }).notNull(),
  name: varchar("name", { length: 120 }).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  role: mysqlEnum("role", ["admin", "operator"]).notNull().default("operator"),
  status: mysqlEnum("status", ["active", "disabled", "locked"]).notNull().default("active"),
  failedLoginCount: int("failed_login_count").notNull().default(0),
  lockedUntil: datetime("locked_until", { mode: "date" }),
  passwordChangedAt: datetime("password_changed_at", { mode: "date" }).notNull().default(sql`(now())`),
  lastLoginAt: datetime("last_login_at", { mode: "date" }),
  ...timestamps,
}, (table) => [uniqueIndex("users_email_uq").on(table.email)]);

export const sessions = mysqlTable("sessions", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  ipHash: varchar("ip_hash", { length: 64 }),
  userAgent: varchar("user_agent", { length: 300 }),
  lastSeenAt: datetime("last_seen_at", { mode: "date" }).notNull(),
  idleExpiresAt: datetime("idle_expires_at", { mode: "date" }).notNull(),
  absoluteExpiresAt: datetime("absolute_expires_at", { mode: "date" }).notNull(),
  revokedAt: datetime("revoked_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [uniqueIndex("sessions_token_uq").on(table.tokenHash), index("sessions_user_idx").on(table.userId)]);

export const loginAttempts = mysqlTable("login_attempts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  emailHash: varchar("email_hash", { length: 64 }).notNull(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  succeeded: boolean("succeeded").notNull(),
  occurredAt: datetime("occurred_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [index("login_email_time_idx").on(table.emailHash, table.occurredAt), index("login_ip_time_idx").on(table.ipHash, table.occurredAt)]);

export const clients = mysqlTable("clients", {
  id: varchar("id", { length: 36 }).primaryKey(),
  kind: mysqlEnum("kind", ["person", "company"]).notNull(),
  taxId: varchar("tax_id", { length: 20 }),
  legalName: varchar("legal_name", { length: 180 }).notNull(),
  tradeName: varchar("trade_name", { length: 180 }),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  addressLine: varchar("address_line", { length: 240 }),
  commune: varchar("commune", { length: 100 }),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  countryCode: varchar("country_code", { length: 2 }).notNull().default("CL"),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
  ...timestamps,
}, (table) => [index("clients_search_idx").on(table.legalName, table.email), index("clients_tax_idx").on(table.taxId)]);

export const catalogItems = mysqlTable("catalog_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  type: mysqlEnum("type", ["product", "service"]).notNull(),
  code: varchar("code", { length: 50 }).notNull(),
  name: varchar("name", { length: 160 }).notNull(),
  description: text("description"),
  unitPrice: decimal("unit_price", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("CLP"),
  taxCategory: mysqlEnum("tax_category", ["taxable", "exempt"]).notNull(),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull().default("19.00"),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
  ...timestamps,
}, (table) => [uniqueIndex("catalog_code_uq").on(table.code), index("catalog_name_idx").on(table.name)]);

export const paymentOrders = mysqlTable("payment_orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  number: varchar("number", { length: 32 }).notNull(),
  clientId: varchar("client_id", { length: 36 }).notNull().references(() => clients.id),
  status: mysqlEnum("status", ["draft", "issued", "paid", "expired", "cancelled", "invoiced"]).notNull().default("draft"),
  currency: varchar("currency", { length: 3 }).notNull().default("CLP"),
  subtotal: decimal("subtotal", { precision: 18, scale: 2 }).notNull(),
  discountTotal: decimal("discount_total", { precision: 18, scale: 2 }).notNull().default("0"),
  taxTotal: decimal("tax_total", { precision: 18, scale: 2 }).notNull(),
  total: decimal("total", { precision: 18, scale: 2 }).notNull(),
  dueAt: datetime("due_at", { mode: "date" }),
  notes: text("notes"),
  issuedAt: datetime("issued_at", { mode: "date" }),
  paidAt: datetime("paid_at", { mode: "date" }),
  cancelledAt: datetime("cancelled_at", { mode: "date" }),
  invoicedAt: datetime("invoiced_at", { mode: "date" }),
  publicTokenHash: varchar("public_token_hash", { length: 64 }),
  publicExpiresAt: datetime("public_expires_at", { mode: "date" }),
  publicRevokedAt: datetime("public_revoked_at", { mode: "date" }),
  version: int("version").notNull().default(1),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
  ...timestamps,
}, (table) => [uniqueIndex("orders_number_uq").on(table.number), uniqueIndex("orders_public_token_uq").on(table.publicTokenHash), index("orders_status_date_idx").on(table.status, table.createdAt), index("orders_client_idx").on(table.clientId)]);

export const paymentOrderLines = mysqlTable("payment_order_lines", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paymentOrderId: varchar("payment_order_id", { length: 36 }).notNull().references(() => paymentOrders.id),
  catalogItemId: varchar("catalog_item_id", { length: 36 }).references(() => catalogItems.id),
  code: varchar("code", { length: 50 }),
  description: varchar("description", { length: 240 }).notNull(),
  quantity: decimal("quantity", { precision: 12, scale: 3 }).notNull(),
  unitPrice: decimal("unit_price", { precision: 18, scale: 2 }).notNull(),
  discountAmount: decimal("discount_amount", { precision: 18, scale: 2 }).notNull().default("0"),
  taxRate: decimal("tax_rate", { precision: 5, scale: 2 }).notNull(),
  subtotal: decimal("subtotal", { precision: 18, scale: 2 }).notNull(),
  taxAmount: decimal("tax_amount", { precision: 18, scale: 2 }).notNull(),
  total: decimal("total", { precision: 18, scale: 2 }).notNull(),
  sortOrder: int("sort_order").notNull().default(0),
}, (table) => [index("order_lines_order_idx").on(table.paymentOrderId)]);

export const payments = mysqlTable("payments", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paymentOrderId: varchar("payment_order_id", { length: 36 }).notNull().references(() => paymentOrders.id),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
  amount: decimal("amount", { precision: 18, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  method: mysqlEnum("method", ["manual", "external"]).notNull(),
  externalReference: varchar("external_reference", { length: 120 }),
  paidAt: datetime("paid_at", { mode: "date" }).notNull(),
  recordedBy: varchar("recorded_by", { length: 36 }).references(() => users.id),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [uniqueIndex("payments_idempotency_uq").on(table.idempotencyKey), index("payments_order_idx").on(table.paymentOrderId)]);

export const invoices = mysqlTable("invoices", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paymentOrderId: varchar("payment_order_id", { length: 36 }).notNull().references(() => paymentOrders.id),
  status: mysqlEnum("status", ["pending", "processing", "issued", "rejected"]).notNull().default("pending"),
  documentType: varchar("document_type", { length: 40 }).notNull().default("factura-electronica"),
  provider: varchar("provider", { length: 40 }).notNull().default("intellydte"),
  providerDocumentId: varchar("provider_document_id", { length: 120 }),
  folio: varchar("folio", { length: 60 }),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  issuedAt: datetime("issued_at", { mode: "date" }),
  rejectedAt: datetime("rejected_at", { mode: "date" }),
  lastErrorCode: varchar("last_error_code", { length: 80 }),
  lastErrorMessage: varchar("last_error_message", { length: 300 }),
  ...timestamps,
}, (table) => [uniqueIndex("invoices_order_uq").on(table.paymentOrderId), uniqueIndex("invoices_provider_id_uq").on(table.providerDocumentId), index("invoices_status_date_idx").on(table.status, table.createdAt)]);

export const integrationAttempts = mysqlTable("integration_attempts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  integration: varchar("integration", { length: 50 }).notNull(),
  operation: varchar("operation", { length: 80 }).notNull(),
  aggregateType: varchar("aggregate_type", { length: 50 }).notNull(),
  aggregateId: varchar("aggregate_id", { length: 36 }).notNull(),
  idempotencyKey: varchar("idempotency_key", { length: 100 }).notNull(),
  correlationId: varchar("correlation_id", { length: 36 }).notNull(),
  attemptNumber: int("attempt_number").notNull(),
  status: varchar("status", { length: 40 }).notNull(),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  httpStatus: int("http_status"),
  providerCode: varchar("provider_code", { length: 80 }),
  safeMessage: varchar("safe_message", { length: 300 }),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
  completedAt: datetime("completed_at", { mode: "date" }),
}, (table) => [uniqueIndex("attempt_uq").on(table.integration, table.idempotencyKey, table.attemptNumber), index("attempt_aggregate_idx").on(table.aggregateType, table.aggregateId)]);

export const auditEvents = mysqlTable("audit_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  actorUserId: varchar("actor_user_id", { length: 36 }).references(() => users.id),
  actorType: mysqlEnum("actor_type", ["user", "system", "public"]).notNull(),
  action: varchar("action", { length: 100 }).notNull(),
  entityType: varchar("entity_type", { length: 60 }).notNull(),
  entityId: varchar("entity_id", { length: 36 }),
  correlationId: varchar("correlation_id", { length: 36 }).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>().notNull(),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [index("audit_entity_date_idx").on(table.entityType, table.entityId, table.createdAt), index("audit_correlation_idx").on(table.correlationId)]);

export const businessCounters = mysqlTable("business_counters", {
  name: varchar("name", { length: 40 }).primaryKey(),
  value: bigint("value", { mode: "bigint", unsigned: true }).notNull().default(sql`0`),
});
