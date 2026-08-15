"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { writeAudit } from "@/features/audit/service";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { safeError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";
import { saveIntellyDteConfig } from "./config-service";
import { getIntellyDteGateway } from "./intellydte";

const schema = z.object({ baseUrl: z.string().trim().url(), apiKey: z.string().trim().max(500).optional(), tenantApiKey: z.string().trim().max(500).optional(), systemApiKey: z.string().trim().max(500).optional(), tenantRut: z.string().trim().max(20).optional(), webhookSecret: z.string().trim().max(500).optional() });

export async function saveIntellyDteConfigAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); const user = await requireUser("admin");
    const parsed = schema.safeParse(formObject(formData));
    if (!parsed.success) return { status: "error", message: "Revisa la Base URL y la API Key.", fieldErrors: parsed.error.flatten().fieldErrors };
    await saveIntellyDteConfig({ ...parsed.data, userId: user.userId });
    await writeAudit({ actorUserId: user.userId, actorType: "user", action: "integration.configured", entityType: "integration", entityId: "intellydte", metadata: { baseUrl: parsed.data.baseUrl } });
    revalidatePath("/integraciones");
    return { status: "success", message: "Configuración guardada." };
  } catch (error) { return { status: "error", message: safeError(error).message }; }
}

export async function testIntellyDteConfigAction(_: ActionState, _formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin(); await requireUser("admin");
    const result = await (await getIntellyDteGateway()).health();
    return { status: result.ok ? "success" : "error", message: result.safeMessage };
  } catch (error) { return { status: "error", message: safeError(error).message }; }
}
