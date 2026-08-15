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

export const integrationConfigs = mysqlTable("integration_configs", {
  id: varchar("id", { length: 36 }).primaryKey(),
  integration: varchar("integration", { length: 50 }).notNull(),
  baseUrl: varchar("base_url", { length: 500 }).notNull(),
  apiKeyCiphertext: text("api_key_ciphertext").notNull(),
  apiKeyIv: varchar("api_key_iv", { length: 32 }).notNull(),
  apiKeyAuthTag: varchar("api_key_auth_tag", { length: 32 }).notNull(),
  apiKeyLastFour: varchar("api_key_last_four", { length: 4 }).notNull(),
  tenantApiKeyCiphertext: text("tenant_api_key_ciphertext"),
  tenantApiKeyIv: varchar("tenant_api_key_iv", { length: 32 }),
  tenantApiKeyAuthTag: varchar("tenant_api_key_auth_tag", { length: 32 }),
  tenantApiKeyLastFour: varchar("tenant_api_key_last_four", { length: 4 }),
  systemApiKeyCiphertext: text("system_api_key_ciphertext"),
  systemApiKeyIv: varchar("system_api_key_iv", { length: 32 }),
  systemApiKeyAuthTag: varchar("system_api_key_auth_tag", { length: 32 }),
  systemApiKeyLastFour: varchar("system_api_key_last_four", { length: 4 }),
  tenantRut: varchar("tenant_rut", { length: 20 }),
  webhookSecretCiphertext: text("webhook_secret_ciphertext"),
  webhookSecretIv: varchar("webhook_secret_iv", { length: 32 }),
  webhookSecretAuthTag: varchar("webhook_secret_auth_tag", { length: 32 }),
  webhookSecretLastFour: varchar("webhook_secret_last_four", { length: 4 }),
  status: mysqlEnum("status", ["active", "disabled"]).notNull().default("active"),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
  ...timestamps,
}, (table) => [uniqueIndex("integration_configs_name_uq").on(table.integration)]);

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

export const passwordResetTokens = mysqlTable("password_reset_tokens", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id),
  tokenHash: varchar("token_hash", { length: 64 }).notNull(),
  expiresAt: datetime("expires_at", { mode: "date" }).notNull(),
  usedAt: datetime("used_at", { mode: "date" }),
  requestedIpHash: varchar("requested_ip_hash", { length: 64 }).notNull(),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [
  uniqueIndex("password_reset_tokens_hash_uq").on(table.tokenHash),
  index("password_reset_tokens_user_idx").on(table.userId, table.createdAt),
  index("password_reset_tokens_expiry_idx").on(table.expiresAt),
]);

export const passwordResetRequests = mysqlTable("password_reset_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  emailHash: varchar("email_hash", { length: 64 }).notNull(),
  ipHash: varchar("ip_hash", { length: 64 }).notNull(),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [
  index("password_reset_requests_email_idx").on(table.emailHash, table.createdAt),
  index("password_reset_requests_ip_idx").on(table.ipHash, table.createdAt),
  index("password_reset_requests_created_idx").on(table.createdAt),
]);

export const clients = mysqlTable("clients", {
  id: varchar("id", { length: 36 }).primaryKey(),
  kind: mysqlEnum("kind", ["person", "company"]).notNull(),
  taxId: varchar("tax_id", { length: 20 }),
  legalName: varchar("legal_name", { length: 180 }).notNull(),
  tradeName: varchar("trade_name", { length: 180 }),
  email: varchar("email", { length: 254 }).notNull(),
  phone: varchar("phone", { length: 30 }),
  addressLine: varchar("address_line", { length: 240 }),
  giro: varchar("giro", { length: 180 }),
  commune: varchar("commune", { length: 100 }),
  city: varchar("city", { length: 100 }),
  region: varchar("region", { length: 100 }),
  countryCode: varchar("country_code", { length: 2 }).notNull().default("CL"),
  status: mysqlEnum("status", ["active", "inactive"]).notNull().default("active"),
  ...timestamps,
}, (table) => [index("clients_search_idx").on(table.legalName, table.email), index("clients_tax_idx").on(table.taxId)]);

export const catalogItems = mysqlTable("catalog_items", {
  id: varchar("id", { length: 36 }).primaryKey(),
  type: mysqlEnum("type", ["product", "service", "project"]).notNull(),
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
  discountPercent: decimal("discount_percent", { precision: 5, scale: 2 }).notNull().default("0.00"),
  discountReason: varchar("discount_reason", { length: 240 }),
  taxTotal: decimal("tax_total", { precision: 18, scale: 2 }).notNull(),
  total: decimal("total", { precision: 18, scale: 2 }).notNull(),
  dueAt: datetime("due_at", { mode: "date" }),
  notes: text("notes"),
  issuedAt: datetime("issued_at", { mode: "date" }),
  paidAt: datetime("paid_at", { mode: "date" }),
  cancelledAt: datetime("cancelled_at", { mode: "date" }),
  invoicedAt: datetime("invoiced_at", { mode: "date" }),
  publicTokenHash: varchar("public_token_hash", { length: 64 }),
  publicTokenCiphertext: text("public_token_ciphertext"),
  publicTokenIv: varchar("public_token_iv", { length: 32 }),
  publicTokenAuthTag: varchar("public_token_auth_tag", { length: 32 }),
  publicExpiresAt: datetime("public_expires_at", { mode: "date" }),
  publicRevokedAt: datetime("public_revoked_at", { mode: "date" }),
  version: int("version").notNull().default(1),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  updatedBy: varchar("updated_by", { length: 36 }).notNull().references(() => users.id),
  ...timestamps,
}, (table) => [uniqueIndex("orders_number_uq").on(table.number), uniqueIndex("orders_public_token_uq").on(table.publicTokenHash), index("orders_status_date_idx").on(table.status, table.createdAt), index("orders_client_idx").on(table.clientId)]);

export const orderEmailDeliveries = mysqlTable("order_email_deliveries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  paymentOrderId: varchar("payment_order_id", { length: 36 }).notNull().references(() => paymentOrders.id),
  recipient: varchar("recipient", { length: 254 }).notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed"]).notNull(),
  errorCode: varchar("error_code", { length: 80 }),
  safeMessage: varchar("safe_message", { length: 300 }),
  sentAt: datetime("sent_at", { mode: "date" }),
  createdBy: varchar("created_by", { length: 36 }).notNull().references(() => users.id),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [index("order_email_order_idx").on(table.paymentOrderId, table.createdAt)]);

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
  tenantRut: varchar("tenant_rut", { length: 20 }),
  folio: varchar("folio", { length: 60 }),
  trackId: varchar("track_id", { length: 120 }),
  siiStatus: varchar("sii_status", { length: 50 }),
  siiGlosa: varchar("sii_glosa", { length: 300 }),
  signedXmlEvidenceId: varchar("signed_xml_evidence_id", { length: 36 }),
  reconstructedPdfEvidenceId: varchar("reconstructed_pdf_evidence_id", { length: 36 }),
  evidenceStatus: varchar("evidence_status", { length: 30 }).notNull().default("pending"),
  evidenceError: varchar("evidence_error", { length: 300 }),
  version: int("version").notNull().default(1),
  requestHash: varchar("request_hash", { length: 64 }).notNull(),
  issuedAt: datetime("issued_at", { mode: "date" }),
  rejectedAt: datetime("rejected_at", { mode: "date" }),
  lastErrorCode: varchar("last_error_code", { length: 80 }),
  lastErrorMessage: varchar("last_error_message", { length: 300 }),
  ...timestamps,
}, (table) => [uniqueIndex("invoices_order_uq").on(table.paymentOrderId), uniqueIndex("invoices_provider_id_uq").on(table.providerDocumentId), index("invoices_status_date_idx").on(table.status, table.createdAt)]);

export const invoiceEvidence = mysqlTable("invoice_evidence", {
  id: varchar("id", { length: 36 }).primaryKey(),
  invoiceId: varchar("invoice_id", { length: 36 }).notNull().references(() => invoices.id),
  kind: mysqlEnum("kind", ["signed_xml", "reconstructed_pdf"]).notNull(),
  storageKey: varchar("storage_key", { length: 500 }).notNull(),
  sha256: varchar("sha256", { length: 64 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  dteType: varchar("dte_type", { length: 10 }).notNull(),
  folio: varchar("folio", { length: 60 }).notNull(),
  rendererVersion: varchar("renderer_version", { length: 40 }),
  encoding: varchar("encoding", { length: 30 }),
  regeneratedAt: datetime("regenerated_at", { mode: "date" }),
  version: int("version").notNull().default(1),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [uniqueIndex("invoice_evidence_version_uq").on(table.invoiceId, table.kind, table.version), index("invoice_evidence_invoice_idx").on(table.invoiceId, table.kind, table.version)]);

export const intellyDteWebhookEvents = mysqlTable("intellydte_webhook_events", {
  id: varchar("id", { length: 36 }).primaryKey(),
  providerEventId: varchar("provider_event_id", { length: 160 }).notNull(),
  eventType: varchar("event_type", { length: 80 }).notNull(),
  dteRecordId: varchar("dte_record_id", { length: 120 }),
  tenantRut: varchar("tenant_rut", { length: 20 }),
  payload: json("payload").$type<Record<string, unknown>>().notNull(),
  processedAt: datetime("processed_at", { mode: "date" }),
  createdAt: datetime("created_at", { mode: "date" }).notNull().default(sql`(now())`),
}, (table) => [uniqueIndex("intelly_webhook_event_id_uq").on(table.providerEventId), index("intelly_webhook_dte_idx").on(table.dteRecordId, table.createdAt)]);

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
  endpoint: varchar("endpoint", { length: 200 }),
  providerDocumentId: varchar("provider_document_id", { length: 120 }),
  requestBody: json("request_body").$type<Record<string, unknown> | null>(),
  responseBody: json("response_body").$type<Record<string, unknown> | null>(),
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

export const companySettings = mysqlTable("company_settings", {
  id: varchar("id", { length: 36 }).primaryKey(),
  rut: varchar("rut", { length: 20 }).notNull().default("76.123.456-7"),
  legalName: varchar("legal_name", { length: 200 }).notNull().default("Intelly SpA"),
  tradeName: varchar("trade_name", { length: 200 }).default("Intelly"),
  giro: varchar("giro", { length: 200 }).default("Servicios Informáticos y Desarrollo de Software"),
  addressLine: varchar("address_line", { length: 250 }).default("Av. Providencia 1234, Of. 501"),
  commune: varchar("commune", { length: 100 }).default("Providencia"),
  city: varchar("city", { length: 100 }).default("Santiago"),
  region: varchar("region", { length: 100 }).default("Región Metropolitana"),
  email: varchar("email", { length: 254 }).default("contacto@intelly.cl"),
  phone: varchar("phone", { length: 50 }).default("+56 9 1234 5678"),
  website: varchar("website", { length: 200 }).default("https://intelly.cl"),
  bankName: varchar("bank_name", { length: 100 }).default("Banco Santander"),
  bankAccountType: varchar("bank_account_type", { length: 50 }).default("Cuenta Corriente"),
  bankAccountNumber: varchar("bank_account_number", { length: 50 }).default("12345678"),
  bankAccountHolder: varchar("bank_account_holder", { length: 200 }).default("Intelly SpA"),
  bankAccountRut: varchar("bank_account_rut", { length: 20 }).default("76.123.456-7"),
  bankAccountEmail: varchar("bank_account_email", { length: 254 }).default("pagos@intelly.cl"),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  ...timestamps,
});
