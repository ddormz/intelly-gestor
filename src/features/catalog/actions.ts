"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { catalogItems } from "@/db/schema";
import { writeAudit } from "@/features/audit/service";
import { requireUser } from "@/features/auth/session";
import { enforceSameOrigin } from "@/lib/security";
import { formObject, parseInput } from "@/lib/validation";
import { catalogItemSchema } from "./validation";

export async function createCatalogItemAction(formData: FormData): Promise<void> {
  await enforceSameOrigin();
  const user = await requireUser();
  const input = parseInput(catalogItemSchema, formObject(formData));
  const id = randomUUID();
  await getDb().insert(catalogItems).values({
    id, type: input.type, code: input.code, name: input.name, description: input.description,
    unitPrice: String(input.unitPrice), currency: "CLP", taxCategory: input.taxCategory,
    taxRate: input.taxCategory === "taxable" ? "19.00" : "0.00",
  });
  await writeAudit({ actorUserId: user.userId, actorType: "user", action: "catalog.created", entityType: "catalog_item", entityId: id });
  revalidatePath("/productos-servicios");
}
