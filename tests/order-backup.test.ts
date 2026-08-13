import assert from "node:assert/strict";
import test from "node:test";
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  createOrderBackup,
  parseOrderBackup,
  restoreOrderBackup,
  STORAGE_KEYS,
} from "../lib/order-backup";
import type { CompanySettings, PaymentOrder } from "../lib/order-pdf";

type StorageAdapter = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

const settings: CompanySettings = {
  companyName: "INTELLY SPA",
  companyRut: "78.202.703-4",
  businessLine: "Tecnología",
  address: "Santiago",
  email: "dramirez@intelly.cl",
  phone: "+56900000000",
  bankName: "Banco de Chile",
  accountType: "Cuenta Corriente",
  accountNumber: "00-171-21318-01",
  accountHolder: "INTELLY SPA",
  accountRut: "78.202.703-4",
  transferEmail: "dramirez@intelly.cl",
  paymentTerms: "Pago al vencimiento.",
  paymentInstructions: "Indicar el número de orden.",
  dueDays: 10,
};

const order: PaymentOrder = {
  id: "order-1",
  number: "OP-2026-0002",
  committed: true,
  issueDate: "2026-08-12",
  dueDate: "2026-08-22",
  customerName: "Cliente",
  customerRut: "11.111.111-1",
  customerEmail: "cliente@example.com",
  serviceType: "hosting",
  invoice: true,
  discountPercent: 20,
  discountReason: "Antigüedad",
  items: [{ id: "item-1", name: "Hosting", description: "Anual", amount: 100000 }],
};

const exportedAt = "2026-08-12T12:00:00.000Z";

function serialize(data: unknown) {
  return JSON.stringify(data);
}

function validBackup() {
  return createOrderBackup(settings, [order], { "2026": 2 }, exportedAt);
}

test("creates a versioned complete backup", () => {
  const backup = validBackup();
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.exportedAt, exportedAt);
  assert.deepEqual(backup.data.settings, settings);
  assert.deepEqual(backup.data.orders, [order]);
  assert.deepEqual(backup.data.sequence, { "2026": 2 });
});

test("parses a valid serialized backup without retaining mutable data", () => {
  const backup = parseOrderBackup(serialize(validBackup()));
  assert.deepEqual(backup.data.orders, [order]);

  backup.data.orders[0].items[0].name = "Cambiado";
  backup.data.sequence["2026"] = 9;
  assert.equal(order.items[0].name, "Hosting");
  assert.equal(validBackup().data.sequence["2026"], 2);
});

test("normalizes discount fields missing from pre-discount backups", () => {
  const backup = validBackup();
  const legacyOrder = { ...backup.data.orders[0] } as Record<string, unknown>;
  delete legacyOrder.discountPercent;
  delete legacyOrder.discountReason;
  backup.data.orders = [legacyOrder as unknown as PaymentOrder];

  const parsed = parseOrderBackup(serialize(backup));
  assert.equal(parsed.data.orders[0].discountPercent, 0);
  assert.equal(parsed.data.orders[0].discountReason, "");
});

test("normalizes imported sequence to the highest order number for each year", () => {
  const backup = validBackup();
  backup.data.sequence = { "2026": 1 };

  assert.deepEqual(parseOrderBackup(serialize(backup)).data.sequence, {
    "2026": 2,
  });
});

test("rejects malformed backup envelopes", () => {
  assert.throws(() => parseOrderBackup("{"), /JSON válido/);
  assert.throws(
    () => parseOrderBackup(serialize({ format: "other", version: 1 })),
    /versión compatible/,
  );
  assert.throws(
    () => parseOrderBackup(serialize({ format: BACKUP_FORMAT, version: 2, data: {} })),
    /versión compatible/,
  );
  const badDate = validBackup();
  badDate.exportedAt = "ayer";
  assert.throws(() => parseOrderBackup(serialize(badDate)), /fecha de exportación válida/);

  const noMilliseconds = validBackup();
  noMilliseconds.exportedAt = "2026-08-12T12:00:00Z";
  assert.equal(parseOrderBackup(serialize(noMilliseconds)).exportedAt, noMilliseconds.exportedAt);

  const withOffset = validBackup();
  withOffset.exportedAt = "2026-08-12T12:00:00.000+00:00";
  assert.equal(parseOrderBackup(serialize(withOffset)).exportedAt, withOffset.exportedAt);

  const rolloverDate = validBackup();
  rolloverDate.exportedAt = "2026-02-30T12:00:00Z";
  assert.throws(() => parseOrderBackup(serialize(rolloverDate)), /fecha de exportación válida/);
});

test("rejects malformed settings and sequences", () => {
  const invalidSettings = validBackup();
  invalidSettings.data.settings.email = 7 as unknown as string;
  assert.throws(() => parseOrderBackup(serialize(invalidSettings)), /configuración válida/);

  const invalidDueDays = validBackup();
  invalidDueDays.data.settings.dueDays = 0;
  assert.throws(() => parseOrderBackup(serialize(invalidDueDays)), /configuración válida/);

  const invalidYear = validBackup();
  invalidYear.data.sequence = { twenty26: 2 };
  assert.throws(() => parseOrderBackup(serialize(invalidYear)), /correlativo válido/);

  const invalidSequence = validBackup();
  invalidSequence.data.sequence = { "2026": 1.5 };
  assert.throws(() => parseOrderBackup(serialize(invalidSequence)), /correlativo válido/);

  const unsafeSequence = validBackup();
  unsafeSequence.data.sequence = { "2026": 1e21 };
  assert.throws(() => parseOrderBackup(serialize(unsafeSequence)), /correlativo válido/);
});

test("rejects malformed orders and committed order items", () => {
  const invalidService = validBackup();
  invalidService.data.orders[0].serviceType = "consulting" as PaymentOrder["serviceType"];
  assert.throws(() => parseOrderBackup(serialize(invalidService)), /órdenes válidas/);

  const invalidDiscount = validBackup();
  invalidDiscount.data.orders[0].discountPercent = 101;
  assert.throws(() => parseOrderBackup(serialize(invalidDiscount)), /órdenes válidas/);

  const nullDiscount = validBackup();
  nullDiscount.data.orders[0].discountPercent = null as unknown as number;
  assert.throws(() => parseOrderBackup(serialize(nullDiscount)), /órdenes válidas/);

  const nullReason = validBackup();
  nullReason.data.orders[0].discountReason = null as unknown as string;
  assert.throws(() => parseOrderBackup(serialize(nullReason)), /órdenes válidas/);

  const noItems = validBackup();
  noItems.data.orders[0].items = [];
  assert.throws(() => parseOrderBackup(serialize(noItems)), /órdenes válidas/);

  const invalidItem = validBackup();
  invalidItem.data.orders[0].items[0].amount = Number.NaN;
  assert.throws(() => parseOrderBackup(serialize(invalidItem)), /órdenes válidas/);
});

test("restores previous storage values when a backup write fails partway through", () => {
  const previous = new Map<string, string>([
    [STORAGE_KEYS.settings, "previous-settings"],
    [STORAGE_KEYS.orders, "previous-orders"],
    [STORAGE_KEYS.sequence, "previous-sequence"],
    [STORAGE_KEYS.paymentDetails, "previous-marker"],
  ]);
  let shouldFail = true;
  const storage: StorageAdapter = {
    getItem: (key) => previous.get(key) ?? null,
    setItem: (key, value) => {
      if (key === STORAGE_KEYS.sequence && shouldFail) {
        shouldFail = false;
        throw new Error("quota exceeded");
      }
      previous.set(key, value);
    },
    removeItem: (key) => previous.delete(key),
  };

  assert.throws(() => restoreOrderBackup(storage, validBackup()), /No fue posible restaurar/);
  assert.deepEqual([...previous.entries()], [
    [STORAGE_KEYS.settings, "previous-settings"],
    [STORAGE_KEYS.orders, "previous-orders"],
    [STORAGE_KEYS.sequence, "previous-sequence"],
    [STORAGE_KEYS.paymentDetails, "previous-marker"],
  ]);
});

test("writes every backup value and the payment-details marker together", () => {
  const values = new Map<string, string>();
  const storage: StorageAdapter = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
  const backup = validBackup();

  restoreOrderBackup(storage, backup);

  assert.deepEqual([...values.entries()], [
    [STORAGE_KEYS.settings, JSON.stringify(backup.data.settings)],
    [STORAGE_KEYS.orders, JSON.stringify(backup.data.orders)],
    [STORAGE_KEYS.sequence, JSON.stringify(backup.data.sequence)],
    [STORAGE_KEYS.paymentDetails, "1"],
  ]);
});
