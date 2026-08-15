import { mkdtemp, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoiceEvidence } from "@/db/schema";
import { getFiscalEvidence, storeReconstructedPdf, storeSignedXml, storeSignedXmlBytes } from "@/features/billing/evidence";

vi.mock("@/db", () => ({ getDb: vi.fn() }));

describe("private fiscal evidence", () => {
  beforeEach(() => {
    process.env.FISCAL_EVIDENCE_DIR = undefined;
  });

  it("defines invoice evidence metadata for XML and reconstructed PDF artifacts", () => {
    expect(invoiceEvidence.invoiceId).toBeDefined();
    expect(invoiceEvidence.kind).toBeDefined();
    expect(invoiceEvidence.storageKey).toBeDefined();
    expect(invoiceEvidence.sha256).toBeDefined();
    expect(invoiceEvidence.rendererVersion).toBeDefined();
  });

  it("hashes and stores signed XML privately without exposing a public URL", async () => {
    const root = await mkdtemp(join(tmpdir(), "intelly-fiscal-"));
    process.env.FISCAL_EVIDENCE_DIR = root;
    const insert = vi.fn().mockResolvedValue(undefined);
    const db = { insert: vi.fn(() => ({ values: insert })) };
    const { getDb } = await import("@/db");
    vi.mocked(getDb).mockReturnValue(db as never);

    const result = await storeSignedXml("invoice-1", { dteType: "33", folio: "42" }, "<DTE>signed</DTE>");
    const bytes = await readFile(join(root, result.storageKey));

    expect(bytes.toString()).toBe("<DTE>signed</DTE>");
    expect(result.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(result).not.toHaveProperty("publicUrl");
    expect(insert).toHaveBeenCalledOnce();
  });

  it("rejects empty XML and bytes that are not PDFs", async () => {
    await expect(storeSignedXml("invoice-1", { dteType: "33", folio: "42" }, " ")).rejects.toThrow("FISCAL_EVIDENCE_EMPTY");
    await expect(storeReconstructedPdf("invoice-1", { dteType: "33", folio: "42" }, new Uint8Array([1, 2, 3]))).rejects.toThrow("FISCAL_PDF_INVALID");
  });

  it("reads evidence through the server storage contract", async () => {
    const root = await mkdtemp(join(tmpdir(), "intelly-fiscal-"));
    process.env.FISCAL_EVIDENCE_DIR = root;
    const db = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ execute: vi.fn().mockResolvedValue([{ id: "evidence-1", invoiceId: "invoice-1", kind: "signed_xml", storageKey: "invoice-1/signed.xml", sha256: createHash("sha256").update("<DTE/>").digest("hex"), mimeType: "application/xml", dteType: "33", folio: "42", rendererVersion: null, version: 1 }]) })) })) })),
    };
    const { getDb } = await import("@/db");
    vi.mocked(getDb).mockReturnValue(db as never);
    await import("node:fs/promises").then(({ mkdir, writeFile }) => mkdir(join(root, "invoice-1"), { recursive: true }).then(() => writeFile(join(root, "invoice-1", "signed.xml"), "<DTE/>")));

    const result = await getFiscalEvidence("invoice-1");
    expect(result?.artifacts[0]?.bytes).toEqual(new Uint8Array(Buffer.from("<DTE/>")));
  });

  it("stores exact signed XML bytes and rejects tampering on read", async () => {
    const root = await mkdtemp(join(tmpdir(), "intelly-fiscal-"));
    process.env.FISCAL_EVIDENCE_DIR = root;
    const insert = vi.fn().mockResolvedValue(undefined);
    let storedKey = "invoice-1/signed.xml";
    const db = { insert: vi.fn(() => ({ values: insert })), select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ execute: vi.fn().mockResolvedValue([{ id: "evidence-1", invoiceId: "invoice-1", kind: "signed_xml", storageKey: storedKey, sha256: "not-the-file-hash", mimeType: "application/xml", dteType: "33", folio: "42", rendererVersion: null, version: 1 }]) })) })) })) };
    const { getDb } = await import("@/db");
    vi.mocked(getDb).mockReturnValue(db as never);
    const bytes = Buffer.from("<?xml version=\"1.0\" encoding=\"ISO-8859-1\"?><DTE>NIÑO</DTE>", "latin1");
    const stored = await storeSignedXmlBytes("invoice-1", { dteType: "33", folio: "42" }, bytes);
    storedKey = stored.storageKey;
    expect(await readFile(join(root, stored.storageKey))).toEqual(bytes);
    await expect(getFiscalEvidence("invoice-1")).rejects.toThrow("FISCAL_EVIDENCE_HASH_MISMATCH");
  });

  it("retries a concurrent version collision without violating the unique version key", async () => {
    const root = await mkdtemp(join(tmpdir(), "intelly-fiscal-"));
    process.env.FISCAL_EVIDENCE_DIR = root;
    let transactionCalls = 0;
    const db = {
      select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ execute: vi.fn().mockResolvedValue(transactionCalls ? [{ version: 1 }] : []) })) })) })),
      transaction: vi.fn(async (callback: (tx: unknown) => unknown) => { transactionCalls += 1; if (transactionCalls === 1) throw Object.assign(new Error("duplicate"), { code: "ER_DUP_ENTRY" }); return callback({ insert: vi.fn(() => ({ values: vi.fn(async () => undefined) })), update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => undefined) })) })) }); }),
    };
    const { getDb } = await import("@/db");
    vi.mocked(getDb).mockReturnValue(db as never);
    const result = await storeSignedXmlBytes("invoice-1", { dteType: "33", folio: "42" }, new Uint8Array(Buffer.from("<DTE/>")));
    expect(result.version).toBe(2);
    expect(transactionCalls).toBe(2);
  });
});
