import { z } from "zod";

export const catalogItemSchema = z.object({
  type: z.enum(["product", "service", "project"]),
  name: z.string().trim().min(2, "Ingresa un nombre.").max(160),
  description: z.string().trim().max(500).optional(),
  unitPrice: z.coerce.number().int().positive("El precio debe ser mayor que cero.").max(Number.MAX_SAFE_INTEGER),
  taxCategory: z.enum(["taxable", "exempt"]),
});

const catalogCodeSchema = z.string().trim().min(2).max(50).transform((value) => value.toUpperCase());

export const catalogItemUpdateSchema = catalogItemSchema.extend({ id: z.string().uuid() });
export const catalogItemImportSchema = catalogItemSchema.extend({ code: catalogCodeSchema, status: z.enum(["active", "inactive"]) });
export const catalogItemStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) });
