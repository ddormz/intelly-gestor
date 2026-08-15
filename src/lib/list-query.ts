import { z } from "zod";

export const PAGE_SIZES = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZES)[number];

export type QueryValue = string | string[] | number | undefined;
export type QueryInput = Record<string, QueryValue>;

export type PageQuery = {
  page: number;
  pageSize: PageSize;
  q?: string;
  status?: string;
  tab?: string;
  [key: string]: string | number | undefined;
};

export type PageQueryOptions = {
  allowedTabs?: readonly string[];
  defaultTab?: string;
};

export type PageResult<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

const MAX_SEARCH_LENGTH = 120;
const QUERY_KEY = /^[a-zA-Z][a-zA-Z0-9_]*$/;
const rawValueSchema = z.union([z.string(), z.number()]);
const positiveIntegerSchema = z.string().trim().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(1));
const pageSizeSchema = z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)]);
const pageSizeInputSchema = positiveIntegerSchema.transform((value) => Math.min(value, 100)).pipe(pageSizeSchema);
const queryTextSchema = z.string().trim().transform((value) => value.slice(0, MAX_SEARCH_LENGTH)).pipe(z.string().min(1).max(MAX_SEARCH_LENGTH));

function firstValue(value: QueryValue): string | undefined {
  const selected = Array.isArray(value) ? value[0] : value;
  if (selected === undefined) return undefined;
  const parsed = rawValueSchema.safeParse(selected);
  return parsed.success ? String(parsed.data) : undefined;
}

function parsePage(value: QueryValue): number {
  const parsed = positiveIntegerSchema.safeParse(firstValue(value));
  return parsed.success ? parsed.data : 1;
}

function parsePageSize(value: QueryValue): PageSize {
  const parsed = pageSizeInputSchema.safeParse(firstValue(value));
  return parsed.success ? parsed.data : 25;
}

function parseQueryText(value: QueryValue): string | undefined {
  const parsed = queryTextSchema.safeParse(firstValue(value));
  return parsed.success ? parsed.data : undefined;
}

export function parsePageQuery(input: QueryInput, options: PageQueryOptions = {}): PageQuery {
  const query: PageQuery = {
    page: parsePage(input.page),
    pageSize: parsePageSize(input.pageSize),
  };

  for (const [key, value] of Object.entries(input)) {
    if (key === "page" || key === "pageSize" || !QUERY_KEY.test(key)) continue;
    const normalized = parseQueryText(value);
    if (!normalized) continue;
    query[key] = normalized;
  }

  if (options.allowedTabs?.length) {
    const fallback = options.defaultTab && options.allowedTabs.includes(options.defaultTab) ? options.defaultTab : options.allowedTabs[0];
    query.tab = query.tab && options.allowedTabs.includes(query.tab) ? query.tab : fallback;
  }

  return query;
}

function toSearchValue(value: QueryValue): string | undefined {
  return parseQueryText(value);
}

export function withPageQuery(base: QueryInput, patch: QueryInput): Record<string, string> {
  const next = new Map<string, string>();
  for (const [key, value] of Object.entries(base)) {
    const normalized = toSearchValue(value);
    if (normalized) next.set(key, normalized);
  }

  let resetsPage = false;
  for (const [key, value] of Object.entries(patch)) {
    if (key !== "page") resetsPage = true;
    const normalized = toSearchValue(value);
    if (normalized) next.set(key, normalized);
    else next.delete(key);
  }

  if (resetsPage) next.set("page", "1");
  else if (!next.has("page")) next.set("page", "1");

  return Object.fromEntries(next);
}
