import { parse } from "csv-parse/sync";
import { stringify } from "csv-stringify/sync";
import { AppError } from "@/lib/errors";

export const CSV_MAX_BYTES = 2 * 1024 * 1024;
export const CSV_MAX_ROWS = 5_000;

export type ParsedCsvRow = Record<string, string> & { __row: number };

function safeCell(value: unknown): string {
  const text = value == null ? "" : String(value);
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

export function serializeCsv(headers: string[], rows: unknown[][]): string {
  const records = [headers, ...rows.map((row) => row.map(safeCell))];
  return `\uFEFF${stringify(records, { record_delimiter: "\r\n" })}`;
}

export function parseCsvText(text: string, expectedHeaders: string[], maxRows = CSV_MAX_ROWS): { rows: ParsedCsvRow[] } {
  const records = parse(text.replace(/^\uFEFF/, ""), {
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false,
    max_record_size: 100_000,
  }) as string[][];
  if (records.length === 0) throw new AppError("CSV_INVALID", "El CSV no contiene encabezados.");
  const headers = records[0].map((header) => header.trim().toLowerCase());
  const expected = expectedHeaders.map((header) => header.toLowerCase());
  if (headers.length !== expected.length || headers.some((header, index) => header !== expected[index])) {
    throw new AppError("CSV_HEADERS", `Los encabezados deben ser: ${expectedHeaders.join(", ")}.`);
  }
  const data = records.slice(1);
  if (data.length > maxRows) throw new AppError("CSV_LIMIT", `El archivo supera el máximo de ${maxRows} filas.`);
  return {
    rows: data.map((record, index) => Object.assign(
      Object.fromEntries(expectedHeaders.map((header, column) => [header, record[column] ?? ""])),
      { __row: index + 2 },
    ) as ParsedCsvRow),
  };
}

export async function readCsvFile(value: FormDataEntryValue | null): Promise<string> {
  if (!(value instanceof File) || value.size === 0) throw new AppError("CSV_REQUIRED", "Selecciona un archivo CSV.");
  if (value.size > CSV_MAX_BYTES) throw new AppError("CSV_LIMIT", "El archivo CSV no puede superar 2 MiB.");
  return value.text();
}
