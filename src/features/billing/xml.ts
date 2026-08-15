import bwipjs from "bwip-js/node";
import { XMLParser } from "fast-xml-parser";
import { renderFiscalPdf } from "./fiscal-pdf";

export type ParsedDteDetail = {
  lineNumber: number;
  name: string;
  description: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  amount: number;
  exempt: boolean;
  discountPercent: number | null;
  discountAmount: number;
};

export type ParsedDteDocument = {
  type: string;
  folio: number;
  issueDate: string;
  dueDate: string | null;
  issuer: { rut: string; name: string; businessLine: string | null; activity: string | null; address: string | null; commune: string | null; city: string | null };
  receiver: { rut: string; name: string; businessLine: string | null; address: string | null; commune: string | null; city: string | null };
  details: ParsedDteDetail[];
  totals: { net: number; exempt: number; ivaRate: number; iva: number; total: number };
  references: Array<{ type: string; folio: string; date: string | null; reason: string | null; code: string | null }>;
  resolution: { date: string | null; number: string | null };
  tedXml: string;
  sourceXml: string;
};

export class FiscalXmlError extends Error {
  constructor(public readonly code: string, message = code) {
    super(message);
  }
}

const parser = new XMLParser({ ignoreAttributes: false, removeNSPrefix: true, parseTagValue: false, trimValues: false, isArray: (name) => ["Detalle", "Referencia"].includes(name) });

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {};
}

function text(value: unknown, code: string): string {
  const raw = typeof value === "object" && value !== null && "#text" in value ? (value as Record<string, unknown>)["#text"] : value;
  if (typeof raw !== "string" && typeof raw !== "number") throw new FiscalXmlError(code);
  const result = String(raw).trim();
  if (!result) throw new FiscalXmlError(code);
  return result;
}

function optionalText(value: unknown): string | null {
  try { return text(value, "OPTIONAL"); } catch { return null; }
}

function integer(value: unknown, code: string): number {
  const raw = text(value, code);
  if (!/^\d+$/.test(raw)) throw new FiscalXmlError(code);
  const result = Number(raw);
  if (!Number.isSafeInteger(result)) throw new FiscalXmlError(code);
  return result;
}

function decimal(value: unknown, code: string): number {
  const raw = text(value, code);
  if (!/^\d+(?:\.\d+)?$/.test(raw)) throw new FiscalXmlError(code);
  const result = Number(raw);
  if (!Number.isFinite(result) || !Number.isSafeInteger(Math.round(result))) throw new FiscalXmlError(code);
  return result;
}

function arrayValue(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.map(objectValue) : value ? [objectValue(value)] : [];
}

function findTedXml(xml: string): string {
  const match = xml.match(/<(?:[A-Za-z_][\w.-]*:)?TED\b[^>]*>[\s\S]*?<\/(?:[A-Za-z_][\w.-]*:)?TED\s*>/i);
  if (!match) throw new FiscalXmlError("DTE_XML_MISSING_TED");
  return match[0];
}

export function parseSignedDteXml(xml: string): ParsedDteDocument {
  if (!xml.trim()) throw new FiscalXmlError("DTE_XML_EMPTY");
  let root: Record<string, unknown>;
  try { root = parser.parse(xml) as Record<string, unknown>; } catch { throw new FiscalXmlError("DTE_XML_INVALID"); }
  const dte = objectValue(root.DTE ?? root["ns0:DTE"]);
  const documento = objectValue(dte.Documento);
  if (!Object.keys(documento).length) throw new FiscalXmlError("DTE_XML_MISSING_DOCUMENTO");
  const encabezado = objectValue(documento.Encabezado);
  const idDoc = objectValue(encabezado.IdDoc);
  const emisor = objectValue(encabezado.Emisor);
  const receptor = objectValue(encabezado.Receptor);
  const totales = objectValue(encabezado.Totales);
  for (const [value, code] of [[idDoc, "IDDOC"], [emisor, "EMISOR"], [receptor, "RECEPTOR"], [totales, "TOTALES"]] as const) if (!Object.keys(value).length) throw new FiscalXmlError(`DTE_XML_MISSING_${code}`);
  const tedXml = findTedXml(xml);
  const type = text(idDoc.TipoDTE, "DTE_XML_MISSING_TYPE");
  const folio = integer(idDoc.Folio, "DTE_XML_MISSING_FOLIO");
  const issueDate = text(idDoc.FchEmis, "DTE_XML_MISSING_ISSUE_DATE");
  const dueDate = optionalText(idDoc.FchVenc);
  const issuer = { rut: text(emisor.RUTEmisor, "DTE_XML_MISSING_ISSUER_RUT"), name: text(emisor.RznSoc, "DTE_XML_MISSING_ISSUER_NAME"), businessLine: optionalText(emisor.GiroEmis), activity: optionalText(emisor.Acteco), address: optionalText(emisor.DirOrigen), commune: optionalText(emisor.CmnaOrigen), city: optionalText(emisor.CiudadOrigen) };
  const receiver = { rut: text(receptor.RUTRecep, "DTE_XML_MISSING_RECEIVER_RUT"), name: text(receptor.RznSocRecep, "DTE_XML_MISSING_RECEIVER_NAME"), businessLine: optionalText(receptor.GiroRecep), address: optionalText(receptor.DirRecep), commune: optionalText(receptor.CmnaRecep), city: optionalText(receptor.CiudadRecep) };
  const totals = { net: integer(totales.MntNeto, "DTE_XML_INVALID_NET"), exempt: totales.MntExe === undefined ? 0 : integer(totales.MntExe, "DTE_XML_INVALID_EXEMPT"), ivaRate: totales.TasaIVA === undefined ? 0 : decimal(totales.TasaIVA, "DTE_XML_INVALID_IVA_RATE"), iva: totales.IVA === undefined ? 0 : integer(totales.IVA, "DTE_XML_INVALID_IVA"), total: integer(totales.MntTotal, "DTE_XML_INVALID_TOTAL") };
  if (totals.net < 0 || totals.exempt < 0 || totals.iva < 0 || totals.total < 0) throw new FiscalXmlError("DTE_XML_INVALID_NET");
  const detalleNodes = arrayValue(documento.Detalle);
  const details = detalleNodes.map((item, index) => ({
    lineNumber: item.NroLinDet === undefined ? index + 1 : integer(item.NroLinDet, "DTE_XML_INVALID_LINE"),
    name: text(item.NmbItem, "DTE_XML_INVALID_LINE_NAME"),
    description: optionalText(item.DscItem),
    quantity: decimal(item.QtyItem ?? "1", "DTE_XML_INVALID_LINE_QUANTITY"),
    unit: optionalText(item.UnmdItem),
    unitPrice: integer(item.PrcItem, "DTE_XML_INVALID_LINE_PRICE"),
    amount: integer(item.MontoItem, "DTE_XML_INVALID_LINE_AMOUNT"),
    exempt: optionalText(item.IndExe) === "1",
    discountPercent: item.DescuentoPct === undefined ? null : decimal(item.DescuentoPct, "DTE_XML_INVALID_DISCOUNT"),
    discountAmount: item.DescuentoMonto === undefined ? 0 : integer(item.DescuentoMonto, "DTE_XML_INVALID_DISCOUNT"),
  })).map((detail) => {
    if (detail.quantity <= 0 || detail.unitPrice < 0 || detail.amount < 0 || detail.discountAmount < 0 || detail.discountAmount > detail.unitPrice * detail.quantity || detail.discountPercent !== null && (detail.discountPercent < 0 || detail.discountPercent > 100)) throw new FiscalXmlError("DTE_XML_INVALID_DISCOUNT");
    if (detail.amount !== Math.round(detail.unitPrice * detail.quantity - detail.discountAmount)) throw new FiscalXmlError("DTE_XML_LINE_TOTAL_MISMATCH");
    return detail;
  });
  const resolution = objectValue(encabezado.Resolucion ?? documento.Resolucion);
  return {
    type,
    folio,
    issueDate,
    dueDate,
    issuer,
    receiver,
    details,
    totals,
    references: arrayValue(documento.Referencia).map((reference) => ({ type: text(reference.TpoDocRef, "DTE_XML_INVALID_REFERENCE"), folio: text(reference.FolioRef, "DTE_XML_INVALID_REFERENCE"), date: optionalText(reference.FchRef), reason: optionalText(reference.RazonRef), code: optionalText(reference.CodRef) })),
    resolution: { date: optionalText(resolution.FchResol), number: optionalText(resolution.NroResol) },
    tedXml,
    sourceXml: xml,
  };
}

export function decodeSignedDteXml(bytes: Uint8Array): string {
  if (bytes.byteLength === 0) throw new FiscalXmlError("DTE_XML_EMPTY");
  const prefix = Buffer.from(bytes.slice(0, 512)).toString("latin1");
  const declaration = prefix.match(/encoding\s*=\s*["']([^"']+)["']/i)?.[1]?.toLowerCase();
  if (declaration === "iso-8859-1" || declaration === "latin1" || declaration === "windows-1252") return Buffer.from(bytes).toString("latin1");
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new FiscalXmlError("DTE_XML_ENCODING_INVALID"); }
}

export function parseSignedDteXmlBytes(bytes: Uint8Array): ParsedDteDocument {
  return parseSignedDteXml(decodeSignedDteXml(bytes));
}

export async function renderTedPdf417(tedXml: string): Promise<string> {
  const latin1Text = Buffer.from(tedXml, "latin1").toString("latin1");
  if (latin1Text !== tedXml) throw new FiscalXmlError("TED_PDF417_NON_LATIN1_TEXT");
  try {
    const png = await bwipjs.toBuffer({ bcid: "pdf417", text: latin1Text, binarytext: true, scale: 2, height: 12, paddingwidth: 0, paddingheight: 0, includetext: false });
    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    throw new FiscalXmlError("TED_PDF417_ENCODE_FAILED");
  }
}

export { renderFiscalPdf };
