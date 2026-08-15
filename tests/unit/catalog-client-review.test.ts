import { beforeEach, describe, expect, it, vi } from "vitest";
import { getDb } from "@/db";
import { createCatalogItemAction, updateCatalogItemAction } from "@/features/catalog/actions";
import { importClientsAction } from "@/features/clients/actions";

vi.mock("@/db", () => ({ getDb: vi.fn() }));
vi.mock("@/features/auth/session", () => ({ requireUser: vi.fn(async () => ({ userId: "user-1", role: "operator" })) }));
vi.mock("@/lib/security", () => ({ enforceSameOrigin: vi.fn(async () => undefined) }));
vi.mock("@/features/audit/service", () => ({ writeAudit: vi.fn(async () => undefined), buildAuditEvent: vi.fn(() => ({ id: "audit-1" })) }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

function formData(fields: Record<string, string>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return form;
}

function updateBuilder(set: ReturnType<typeof vi.fn>) {
  return { set: vi.fn((values: unknown) => { set(values); return { where: vi.fn(async () => undefined) }; }) };
}

describe("catalog action review regressions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves the database code during an update instead of trusting the hidden form value", async () => {
    const setValues = vi.fn();
    const selectChain = {
      from: vi.fn(() => selectChain),
      where: vi.fn(() => selectChain),
      limit: vi.fn(() => selectChain),
      for: vi.fn(async () => [{ code: "LEGACY001" }]),
    };
    const tx = { select: vi.fn(() => selectChain), update: vi.fn(() => updateBuilder(setValues)) };
    const db = {
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
      update: vi.fn(() => updateBuilder(setValues)),
    };
    vi.mocked(getDb).mockReturnValue(db as never);

    const result = await updateCatalogItemAction({ status: "idle" }, formData({
      id: "4fc73a41-4f1f-4bd1-a775-21b93af922d4",
      type: "service",
      code: "ATTACKED001",
      name: "Servicio actualizado",
      description: "",
      unitPrice: "1000",
      taxCategory: "taxable",
    }));

    expect(result.status).toBe("success");
    expect(db.transaction).toHaveBeenCalledTimes(1);
    expect(setValues).toHaveBeenCalledWith(expect.objectContaining({ code: "LEGACY001" }));
    expect(db.update).not.toHaveBeenCalled();
  });

  it("retries a generated code after a unique collision", async () => {
    const insertValues = vi.fn();
    const tx = {
      select: vi.fn(() => ({ from: vi.fn(async () => [{ code: "IMPLEMENTA" }]) })),
      insert: vi.fn(() => ({ values: vi.fn(async (values: unknown) => { insertValues(values); }) })),
    };
    const db = {
      transaction: vi.fn()
        .mockRejectedValueOnce({ code: "ER_DUP_ENTRY" })
        .mockImplementationOnce(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    vi.mocked(getDb).mockReturnValue(db as never);

    const result = await createCatalogItemAction({ status: "idle" }, formData({
      type: "service",
      name: "Implementación mensual",
      description: "",
      unitPrice: "1000",
      taxCategory: "taxable",
    }));

    expect(result.status).toBe("success");
    expect(db.transaction).toHaveBeenCalledTimes(2);
    expect(insertValues).toHaveBeenCalledWith(expect.objectContaining({ code: "IMPLEMENT1" }));
  });

  it("imports an incomplete exported client only through the legacy existing-record path", async () => {
    const updateValues = vi.fn();
    const existing = { id: "client-1", taxId: null, email: "historico@example.com", status: "inactive" };
    const tx = {
      update: vi.fn(() => ({ set: vi.fn((values: unknown) => { updateValues(values); return { where: vi.fn(async () => undefined) }; }) })),
      insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })),
    };
    const db = {
      select: vi.fn(() => ({ from: vi.fn(async () => [existing]) })),
      transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) => callback(tx)),
    };
    vi.mocked(getDb).mockReturnValue(db as never);
    const csv = "tipo,rut,nombre,giro,correo,telefono,direccion,region,comuna,ciudad,estado\nempresa,,Cliente histórico,,historico@example.com,,,,,,inactivo";
    const file = new File([csv], "clientes.csv", { type: "text/csv" });
    const form = new FormData();
    form.set("file", file);

    const result = await importClientsAction({ status: "idle" }, form);

    expect(result.status).toBe("success");
    expect(updateValues).toHaveBeenCalledWith(expect.objectContaining({ taxId: null, addressLine: null, legalName: "Cliente histórico" }));
  });
});
