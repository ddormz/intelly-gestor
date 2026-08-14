import { z } from "zod";

export const catalogItemSchema = z.object({
  type: z.enum(["product", "service"]),
  code: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2, "Ingresa un nombre.").max(160),
  description: z.string().trim().max(500).optional(),
  unitPrice: z.coerce.number().int().positive("El precio debe ser mayor que cero."),
  taxCategory: z.enum(["taxable", "exempt"]),
});

export const catalogItemUpdateSchema = catalogItemSchema.extend({ id: z.string().uuid() });
export const catalogItemStatusSchema = z.object({ id: z.string().uuid(), status: z.enum(["active", "inactive"]) });
