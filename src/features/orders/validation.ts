import { z } from "zod";

const cartLineSchema = z.object({
  catalogItemId: z.string().uuid(),
  quantity: z.coerce.number().int().min(1).max(999),
  unitPrice: z.coerce.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
});

export const orderCartSchema = z.object({
  clientId: z.string().uuid(),
  lines: z.array(cartLineSchema).min(1, "Agrega al menos un concepto.").max(100),
  discountPercent: z.coerce.number().min(0).max(100).default(0),
  discountReason: z.string().trim().max(240).default(""),
  dueAt: z.preprocess((value) => value === "" || value === null ? undefined : value, z.coerce.date().optional()),
  notes: z.string().trim().max(2_000).optional(),
  expectedVersion: z.coerce.number().int().min(1).optional(),
}).superRefine((value, context) => {
  if (value.discountPercent > 0 && !value.discountReason) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["discountReason"], message: "Indica el motivo del descuento." });
  }
});

export type OrderCartInput = z.infer<typeof orderCartSchema>;
export type OrderCartLine = z.infer<typeof cartLineSchema>;
