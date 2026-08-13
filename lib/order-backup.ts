import type { CompanySettings, OrderItem, PaymentOrder } from "./order-pdf";

export const BACKUP_FORMAT = "intelly-payment-orders" as const;
export const BACKUP_VERSION = 1 as const;

export const STORAGE_KEYS = {
  settings: "intelly.op.settings.v1",
  orders: "intelly.op.orders.v1",
  sequence: "intelly.op.sequence.v1",
  paymentDetails: "intelly.op.payment-details.v1",
} as const;

export type OrderBackupV1 = {
  format: typeof BACKUP_FORMAT;
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  data: {
    settings: CompanySettings;
    orders: PaymentOrder[];
    sequence: Record<string, number>;
  };
};

type JsonObject = Record<string, unknown>;
type StorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const settingStringFields = [
  "companyName",
  "companyRut",
  "businessLine",
  "address",
  "email",
  "phone",
  "bankName",
  "accountType",
  "accountNumber",
  "accountHolder",
  "accountRut",
  "transferEmail",
  "paymentTerms",
  "paymentInstructions",
] as const;

const orderStringFields = [
  "id",
  "number",
  "issueDate",
  "dueDate",
  "customerName",
  "customerRut",
  "customerEmail",
] as const;

const itemStringFields = ["id", "name", "description"] as const;

const isPlainObject = (value: unknown): value is JsonObject =>
  typeof value === "object" &&
  value !== null &&
  !Array.isArray(value) &&
  Object.getPrototypeOf(value) === Object.prototype;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

const hasStringFields = <T extends readonly string[]>(
  value: JsonObject,
  fields: T,
) => fields.every((field) => typeof value[field] === "string");

const invalidSettings = () => {
  throw new Error("El respaldo no contiene una configuración válida.");
};

const invalidOrders = () => {
  throw new Error("El respaldo no contiene órdenes válidas.");
};

const invalidSequence = () => {
  throw new Error("El respaldo no contiene un correlativo válido.");
};

const copySettings = (settings: CompanySettings): CompanySettings => ({
  companyName: settings.companyName,
  companyRut: settings.companyRut,
  businessLine: settings.businessLine,
  address: settings.address,
  email: settings.email,
  phone: settings.phone,
  bankName: settings.bankName,
  accountType: settings.accountType,
  accountNumber: settings.accountNumber,
  accountHolder: settings.accountHolder,
  accountRut: settings.accountRut,
  transferEmail: settings.transferEmail,
  paymentTerms: settings.paymentTerms,
  paymentInstructions: settings.paymentInstructions,
  dueDays: settings.dueDays,
});

const copyItem = (item: OrderItem): OrderItem => ({
  id: item.id,
  name: item.name,
  description: item.description,
  amount: item.amount,
});

const copyOrder = (order: PaymentOrder): PaymentOrder => {
  const copy: PaymentOrder = {
    id: order.id,
    number: order.number,
    committed: order.committed,
    issueDate: order.issueDate,
    dueDate: order.dueDate,
    customerName: order.customerName,
    customerRut: order.customerRut,
    customerEmail: order.customerEmail,
    serviceType: order.serviceType,
    invoice: order.invoice,
    discountPercent: order.discountPercent,
    discountReason: order.discountReason,
    items: order.items.map(copyItem),
  };

  if (typeof order.createdAt === "string") copy.createdAt = order.createdAt;
  if (typeof order.updatedAt === "string") copy.updatedAt = order.updatedAt;

  return copy;
};

const copySequence = (sequence: Record<string, number>): Record<string, number> =>
  Object.fromEntries(Object.entries(sequence).map(([year, value]) => [year, value]));

const normalizeSequenceForOrders = (
  orders: PaymentOrder[],
  sequence: Record<string, number>,
): Record<string, number> => {
  const normalized = copySequence(sequence);

  for (const order of orders) {
    const match = /^OP-(\d{4})-(\d+)$/.exec(order.number);
    if (!match) continue;

    const [, year, value] = match;
    const number = Number(value);
    if (Number.isSafeInteger(number)) {
      normalized[year] = Math.max(normalized[year] || 0, number);
    }
  }

  return normalized;
};

export function restoreOrderBackup(
  storage: StorageAdapter,
  backup: OrderBackupV1,
) {
  const entries = [
    [STORAGE_KEYS.settings, JSON.stringify(backup.data.settings)],
    [STORAGE_KEYS.orders, JSON.stringify(backup.data.orders)],
    [STORAGE_KEYS.sequence, JSON.stringify(backup.data.sequence)],
    [STORAGE_KEYS.paymentDetails, "1"],
  ] as const;
  const previous = new Map<string, string | null>();
  const written: string[] = [];

  try {
    for (const [key] of entries) previous.set(key, storage.getItem(key));
    for (const [key, value] of entries) {
      storage.setItem(key, value);
      written.push(key);
    }
  } catch {
    for (const key of written.reverse()) {
      const value = previous.get(key);
      try {
        if (value === null) storage.removeItem(key);
        else storage.setItem(key, value);
      } catch {
        // Continue attempting to restore every key changed before the failure.
      }
    }
    throw new Error("No fue posible restaurar el respaldo.");
  }
}

const isIsoDateString = (value: unknown): value is string => {
  if (typeof value !== "string") return false;

  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T([01]\d|2[0-3]):([0-5]\d):([0-5]\d)(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/,
  );
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [31, year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth[month - 1] && Number.isFinite(Date.parse(value));
};

const parseSettings = (value: unknown): CompanySettings => {
  if (
    !isPlainObject(value) ||
    !hasStringFields(value, settingStringFields) ||
    !isFiniteNumber(value.dueDays) ||
    value.dueDays <= 0
  ) {
    return invalidSettings();
  }

  return copySettings(value as CompanySettings);
};

const parseItem = (value: unknown): OrderItem => {
  if (
    !isPlainObject(value) ||
    !hasStringFields(value, itemStringFields) ||
    !isFiniteNumber(value.amount) ||
    value.amount < 0
  ) {
    return invalidOrders();
  }

  return copyItem(value as OrderItem);
};

const parseOrder = (value: unknown): PaymentOrder => {
  if (!isPlainObject(value)) return invalidOrders();

  const discountPercent =
    value.discountPercent === undefined ? 0 : value.discountPercent;
  const discountReason =
    value.discountReason === undefined ? "" : value.discountReason;
  if (
    !hasStringFields(value, orderStringFields) ||
    typeof value.committed !== "boolean" ||
    typeof value.invoice !== "boolean" ||
    (value.serviceType !== "hosting" && value.serviceType !== "custom") ||
    !isFiniteNumber(discountPercent) ||
    discountPercent < 0 ||
    discountPercent > 100 ||
    typeof discountReason !== "string" ||
    !Array.isArray(value.items) ||
    (value.createdAt !== undefined && typeof value.createdAt !== "string") ||
    (value.updatedAt !== undefined && typeof value.updatedAt !== "string")
  ) {
    return invalidOrders();
  }

  const items = value.items.map(parseItem);
  if (value.committed && items.length === 0) return invalidOrders();

  const order: PaymentOrder = {
    id: value.id as string,
    number: value.number as string,
    committed: value.committed,
    issueDate: value.issueDate as string,
    dueDate: value.dueDate as string,
    customerName: value.customerName as string,
    customerRut: value.customerRut as string,
    customerEmail: value.customerEmail as string,
    serviceType: value.serviceType,
    invoice: value.invoice,
    discountPercent,
    discountReason,
    items,
  };

  if (typeof value.createdAt === "string") order.createdAt = value.createdAt;
  if (typeof value.updatedAt === "string") order.updatedAt = value.updatedAt;

  return order;
};

const parseOrders = (value: unknown): PaymentOrder[] => {
  if (!Array.isArray(value)) return invalidOrders();
  return value.map(parseOrder);
};

const parseSequence = (value: unknown): Record<string, number> => {
  if (!isPlainObject(value)) return invalidSequence();

  for (const [year, sequence] of Object.entries(value)) {
    if (
      !/^\d{4}$/.test(year) ||
      !isFiniteNumber(sequence) ||
      !Number.isInteger(sequence) ||
      sequence < 0
    ) {
      return invalidSequence();
    }
  }

  return copySequence(value as Record<string, number>);
};

export function createOrderBackup(
  settings: CompanySettings,
  orders: PaymentOrder[],
  sequence: Record<string, number>,
  exportedAt = new Date().toISOString(),
): OrderBackupV1 {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt,
    data: {
      settings: copySettings(settings),
      orders: orders.map(copyOrder),
      sequence: copySequence(sequence),
    },
  };
}

export function parseOrderBackup(source: string): OrderBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch {
    throw new Error("El archivo no contiene JSON válido.");
  }

  if (
    !isPlainObject(parsed) ||
    parsed.format !== BACKUP_FORMAT ||
    parsed.version !== BACKUP_VERSION
  ) {
    throw new Error("El respaldo no tiene una versión compatible.");
  }

  if (!isIsoDateString(parsed.exportedAt)) {
    throw new Error("El respaldo no contiene una fecha de exportación válida.");
  }

  if (!isPlainObject(parsed.data)) {
    return invalidSettings();
  }

  const orders = parseOrders(parsed.data.orders);

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: parsed.exportedAt,
    data: {
      settings: parseSettings(parsed.data.settings),
      orders,
      sequence: normalizeSequenceForOrders(
        orders,
        parseSequence(parsed.data.sequence),
      ),
    },
  };
}
