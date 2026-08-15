import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/db";
import { invoiceEvidence, invoices } from "@/db/schema";

export type FiscalEvidenceMetadata = {
  dteType: string;
  folio: string | number;
  rendererVersion?: string | null;
  encoding?: string | null;
};

export type SignedFiscalEvidence = {
  id: string;
  invoiceId: string;
  kind: "signed_xml" | "reconstructed_pdf";
  storageKey: string;
  sha256: string;
  mimeType: string;
  dteType: string;
  folio: string;
  rendererVersion: string | null;
  version: number;
  encoding: string | null;
  createdAt: Date;
  bytes?: Uint8Array;
};

export type FiscalEvidence = {
  invoiceId: string;
  artifacts: SignedFiscalEvidence[];
};

function storageRoot(): string {
  const configured = process.env.FISCAL_EVIDENCE_DIR?.trim() || "data/fiscal-evidence";
  return isAbsolute(configured) ? configured : resolve(/* turbopackIgnore: true */ process.cwd(), configured);
}

function safeSegment(value: string): string {
  const sanitized = value.replace(/[^A-Za-z0-9._-]/g, "-");
  if (!sanitized || sanitized === "." || sanitized === "..") throw new Error("FISCAL_EVIDENCE_PATH_INVALID");
  return sanitized;
}

function safeStoragePath(storageKey: string): string {
  const root = storageRoot();
  const path = resolve(root, storageKey);
  const fromRoot = relative(root, path);
  if (fromRoot.startsWith("..") || isAbsolute(fromRoot)) throw new Error("FISCAL_EVIDENCE_PATH_INVALID");
  return path;
}

async function writePrivateBytes(invoiceId: string, kind: SignedFiscalEvidence["kind"], bytes: Uint8Array, extension: string): Promise<{ storageKey: string; sha256: string }> {
  if (bytes.byteLength === 0) throw new Error("FISCAL_EVIDENCE_EMPTY");
  if (kind === "reconstructed_pdf" && new TextDecoder().decode(bytes.slice(0, 4)) !== "%PDF") throw new Error("FISCAL_PDF_INVALID");
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const storageKey = `${safeSegment(invoiceId)}/${kind}-${sha256.slice(0, 20)}.${extension}`;
  const target = safeStoragePath(storageKey);
  await mkdir(resolve(target, ".."), { recursive: true, mode: 0o700 });
  await chmod(resolve(target, ".."), 0o700);
  const temporary = `${target}.tmp-${randomUUID()}`;
  await writeFile(temporary, bytes, { flag: "wx", mode: 0o600 });
  await chmod(temporary, 0o600);
  await rename(temporary, target);
  await chmod(target, 0o600);
  return { storageKey, sha256 };
}

function isDuplicateError(error: unknown): boolean {
  if (!error) return false;
  if (typeof error === "object") {
    if ("code" in error && (error as { code?: string }).code === "ER_DUP_ENTRY") return true;
    if ("errno" in error && (error as { errno?: number }).errno === 1062) return true;
    if ("cause" in error && isDuplicateError((error as { cause?: unknown }).cause)) return true;
    if ("message" in error && /ER_DUP_ENTRY|Duplicate entry|invoice_evidence_version_uq/i.test(String((error as { message?: string }).message))) return true;
  }
  return false;
}

async function storeArtifact(invoiceId: string, metadata: FiscalEvidenceMetadata, bytes: Uint8Array, kind: SignedFiscalEvidence["kind"], mimeType: string, extension: string, retry = 0): Promise<SignedFiscalEvidence> {
  const db = getDb();
  let version = 1;
  if (typeof (db as unknown as { select?: unknown }).select === "function") {
    const previous = await db.select({ version: invoiceEvidence.version }).from(invoiceEvidence).where(and(eq(invoiceEvidence.invoiceId, invoiceId), eq(invoiceEvidence.kind, kind))).execute();
    version = Math.max(0, ...previous.map((item) => item.version)) + 1;
  }
  const { storageKey, sha256 } = await writePrivateBytes(invoiceId, kind, bytes, extension);
  const id = randomUUID();
  const createdAt = new Date();
  const encoding = metadata.encoding ?? (kind === "signed_xml" ? detectXmlEncoding(bytes) : null);
  const row = { id, invoiceId, kind, storageKey, sha256, mimeType, dteType: metadata.dteType, folio: String(metadata.folio), rendererVersion: metadata.rendererVersion ?? null, encoding, regeneratedAt: kind === "reconstructed_pdf" ? createdAt : null, version, createdAt };
  try {
    if (typeof db.transaction === "function") {
      await db.transaction(async (tx) => {
        await tx.insert(invoiceEvidence).values(row);
        await tx.update(invoices).set(kind === "signed_xml" ? { signedXmlEvidenceId: id, updatedAt: createdAt } : { reconstructedPdfEvidenceId: id, updatedAt: createdAt }).where(eq(invoices.id, invoiceId));
      });
    } else {
      await db.insert(invoiceEvidence).values(row);
    }
  } catch (error) {
    if (isDuplicateError(error) && retry < 5) return storeArtifact(invoiceId, metadata, bytes, kind, mimeType, extension, retry + 1);
    throw error;
  }
  return { ...row, bytes };
}

function detectXmlEncoding(bytes: Uint8Array): string {
  const prefix = Buffer.from(bytes.slice(0, 512)).toString("latin1");
  const declaration = prefix.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1];
  return declaration?.trim() || "ISO-8859-1";
}

export function storeSignedXml(invoiceId: string, metadata: FiscalEvidenceMetadata, xml: string): Promise<SignedFiscalEvidence> {
  if (!xml.trim()) return Promise.reject(new Error("FISCAL_EVIDENCE_EMPTY"));
  return storeSignedXmlBytes(invoiceId, metadata, new TextEncoder().encode(xml));
}

export function storeSignedXmlBytes(invoiceId: string, metadata: FiscalEvidenceMetadata, bytes: Uint8Array): Promise<SignedFiscalEvidence> {
  if (bytes.byteLength === 0) return Promise.reject(new Error("FISCAL_EVIDENCE_EMPTY"));
  return storeArtifact(invoiceId, metadata, bytes, "signed_xml", "application/xml", "xml");
}

export function storeReconstructedPdf(invoiceId: string, metadata: FiscalEvidenceMetadata, pdf: Uint8Array): Promise<SignedFiscalEvidence> {
  return storeArtifact(invoiceId, metadata, pdf, "reconstructed_pdf", "application/pdf", "pdf");
}

export async function getFiscalEvidence(invoiceId: string): Promise<FiscalEvidence | null> {
  const rows = await getDb().select().from(invoiceEvidence).where(eq(invoiceEvidence.invoiceId, invoiceId)).execute();
  if (!rows.length) return null;
  const latest = [...new Map(rows.map((row) => [`${row.kind}`, row])).values()];
  for (const row of rows) {
    const current = latest.find((item) => item.kind === row.kind);
    if (current && row.version > current.version) latest[latest.indexOf(current)] = row;
  }
  const artifacts = await Promise.all(latest.map(async (row) => {
    const bytes = new Uint8Array(await readFile(safeStoragePath(row.storageKey)));
    const hash = createHash("sha256").update(bytes).digest("hex");
    if (hash !== row.sha256) throw new Error("FISCAL_EVIDENCE_HASH_MISMATCH");
    return { ...row, bytes };
  }));
  return { invoiceId, artifacts };
}

export async function getFiscalEvidenceArtifact(invoiceId: string, kind: SignedFiscalEvidence["kind"]): Promise<SignedFiscalEvidence | null> {
  const evidence = await getFiscalEvidence(invoiceId);
  return evidence?.artifacts.find((artifact) => artifact.kind === kind) ?? null;
}
