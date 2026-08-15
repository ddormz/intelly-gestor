export type IntellyDteReceptor = {
  rut: string;
  razonSocial: string;
  giro?: string;
  direccion?: string;
  comuna?: string;
  ciudad?: string;
  email?: string;
};

export type IntellyDteItem = {
  nombre: string;
  cantidad: number;
  precioUnitario: number;
  montoItem: number;
  exento?: boolean;
  unidadMedida?: string;
  descuentoPct?: number;
  descuentoMonto?: number;
};

export type IntellyDteFacturaPayload = {
  receptor: IntellyDteReceptor;
  items: IntellyDteItem[];
  montoNeto?: number;
  montoExento?: number;
  montoIva?: number;
  montoTotal: number;
  fechaEmision?: string;
  observaciones?: string;
};

export type ProviderPrintPayload = {
  signedXmlBase64?: string;
  timbre?: { tedXml?: string; pdf417PngBase64?: string; pdf417PngDataUrl?: string };
};

export type NormalizedProviderData = {
  dteRecordId?: string;
  tipoDte?: string;
  folio?: string;
  trackId?: string | null;
  siiStatus?: string | null;
  siiGlosa?: string | null;
  issuedAt?: string;
  printPayload?: ProviderPrintPayload;
};

export type ProviderBody = Record<string, unknown>;
export type ProviderError = { code: string; message: string };

export function providerData(payload: unknown): NormalizedProviderData {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const value = root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  const printPayload = value.printPayload && typeof value.printPayload === "object" ? value.printPayload as Record<string, unknown> : undefined;
  const timbre = printPayload?.timbre && typeof printPayload.timbre === "object" ? printPayload.timbre as Record<string, unknown> : undefined;
  return {
    dteRecordId: stringValue(value.dteRecordId ?? value.dte_record_id),
    tipoDte: stringValue(value.tipoDte ?? value.tipo_dte),
    folio: value.folio === undefined || value.folio === null ? undefined : String(value.folio),
    trackId: value.trackId === undefined && value.track_id === undefined ? undefined : stringValue(value.trackId ?? value.track_id) ?? null,
    siiStatus: value.siiStatus === undefined && value.sii_status === undefined ? undefined : stringValue(value.siiStatus ?? value.sii_status) ?? null,
    siiGlosa: value.siiGlosa === undefined && value.sii_glosa === undefined ? undefined : stringValue(value.siiGlosa ?? value.sii_glosa) ?? null,
    issuedAt: stringValue(value.issuedAt ?? value.issued_at),
    printPayload: printPayload ? {
      signedXmlBase64: stringValue(printPayload.signedXmlBase64 ?? printPayload.signed_xml_base64),
      timbre: timbre ? { tedXml: stringValue(timbre.tedXml ?? timbre.ted_xml), pdf417PngBase64: stringValue(timbre.pdf417PngBase64), pdf417PngDataUrl: stringValue(timbre.pdf417PngDataUrl) } : undefined,
    } : undefined,
  };
}

export function providerError(payload: unknown, fallbackCode: string, fallbackMessage: string): ProviderError {
  const root = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const data = root.error && typeof root.error === "object" ? root.error as Record<string, unknown> : root.data && typeof root.data === "object" ? root.data as Record<string, unknown> : root;
  return { code: stringValue(data.code ?? data.errorCode ?? root.code) ?? fallbackCode, message: stringValue(data.message ?? data.error ?? root.message) ?? fallbackMessage };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined;
}
