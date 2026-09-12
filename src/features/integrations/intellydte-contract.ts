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
  descripcion?: string;
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
  ready?: boolean;
  signedXmlBase64?: string;
  pdf?: { letterAvailable?: boolean; thermalAvailable?: boolean };
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

function providerEnvelope(payload: unknown): ProviderBody {
  const root = payload && typeof payload === "object" ? payload as ProviderBody : {};
  if (root.body && typeof root.body === "object") return root.body as ProviderBody;
  if (typeof root.body === "string") {
    try {
      const parsed = JSON.parse(root.body) as unknown;
      if (parsed && typeof parsed === "object") return parsed as ProviderBody;
    } catch {
      // Keep the original envelope when an API Gateway body is not JSON.
    }
  }
  return root;
}

export function providerHttpStatus(payload: unknown, fallbackStatus: number): number {
  const root = payload && typeof payload === "object" ? payload as ProviderBody : {};
  const body = providerEnvelope(payload);
  const candidate = Number(body.statusCode ?? root.statusCode);
  return Number.isInteger(candidate) && candidate >= 100 && candidate <= 599 ? candidate : fallbackStatus;
}

export function providerData(payload: unknown): NormalizedProviderData {
  const body = providerEnvelope(payload);
  const value = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : body;
  const printPayload = value.printPayload && typeof value.printPayload === "object" ? value.printPayload as Record<string, unknown> : undefined;
  const printPdf = printPayload?.pdf && typeof printPayload.pdf === "object" ? printPayload.pdf as Record<string, unknown> : undefined;
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
      ready: typeof printPayload.ready === "boolean" ? printPayload.ready : undefined,
      signedXmlBase64: stringValue(printPayload.signedXmlBase64 ?? printPayload.signed_xml_base64),
      pdf: printPdf ? {
        letterAvailable: typeof printPdf.letterAvailable === "boolean" ? printPdf.letterAvailable : undefined,
        thermalAvailable: typeof printPdf.thermalAvailable === "boolean" ? printPdf.thermalAvailable : undefined,
      } : undefined,
      timbre: timbre ? { tedXml: stringValue(timbre.tedXml ?? timbre.ted_xml), pdf417PngBase64: stringValue(timbre.pdf417PngBase64), pdf417PngDataUrl: stringValue(timbre.pdf417PngDataUrl) } : undefined,
    } : undefined,
  };
}

export function providerError(payload: unknown, fallbackCode: string, fallbackMessage: string): ProviderError {
  const root = providerEnvelope(payload);
  const data = root.error && typeof root.error === "object" ? root.error as ProviderBody : root.data && typeof root.data === "object" ? root.data as ProviderBody : root;
  const scalarError = stringValue(root.error);
  const violation = Array.isArray(root.violations)
    ? root.violations.find((value): value is ProviderBody => Boolean(value) && typeof value === "object")
    : undefined;
  const violationField = stringValue(violation?.field);
  const violationMessage = stringValue(violation?.message);
  const schemaMessage = violationMessage
    ? `IntellyDTE rechazó ${violationField ? `el campo ${violationField}` : "los datos de la factura"}: ${violationMessage}`
    : undefined;
  return {
    code: stringValue(data.code ?? data.errorCode ?? root.code) ?? scalarError ?? fallbackCode,
    message: stringValue(data.message ?? (typeof data.error === "string" && data.error !== scalarError ? data.error : undefined) ?? root.message) ?? schemaMessage ?? fallbackMessage,
  };
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : typeof value === "number" ? String(value) : undefined;
}

export type FolioStatusItem = {
  tipoDte: number;
  tipoNombre: string;
  disponibles: number;
  rangoDesde?: number;
  rangoHasta?: number;
  ultimoUtilizado?: number;
  vencimientoCaf?: string | null;
  alerta: "normal" | "low" | "critical";
};

export type RequestFoliosCommand = {
  tipoDte: number;
  cantidad: number;
};

export type RequestFoliosResult = {
  ok: boolean;
  tipoDte: number;
  cantidadOtorgada: number;
  rangoDesde?: number;
  rangoHasta?: number;
  message: string;
};
