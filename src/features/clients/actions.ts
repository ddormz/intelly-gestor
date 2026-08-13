"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { clients } from "@/db/schema";
import { getDb } from "@/db";
import { requireUser } from "@/features/auth/session";
import { writeAudit } from "@/features/audit/service";
import { clientSchema } from "./validation";
import { enforceSameOrigin } from "@/lib/security";
import { formObject, parseInput } from "@/lib/validation";

export async function createClientAction(formData: FormData): Promise<void> {
  await enforceSameOrigin();
  const user = await requireUser();
  const input = parseInput(clientSchema, formObject(formData));
  const id = randomUUID();
  await getDb().insert(clients).values({ id, ...input, countryCode: "CL" });
  await writeAudit({ actorUserId: user.userId, actorType: "user", action: "client.created", entityType: "client", entityId: id });
  revalidatePath("/clientes");
}
