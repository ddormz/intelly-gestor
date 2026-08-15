"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/features/auth/session";
import { writeAudit } from "@/features/audit/service";
import { enforceSameOrigin } from "@/lib/security";
import { formObject } from "@/lib/validation";
import { safeError } from "@/lib/errors";
import type { ActionState } from "@/lib/action-state";
import { saveCompanySettings } from "./service";

const companySchema = z.object({
  rut: z.string().trim().min(3).max(20),
  legalName: z.string().trim().min(2).max(200),
  tradeName: z.string().trim().max(200).optional().nullable(),
  giro: z.string().trim().max(200).optional().nullable(),
  addressLine: z.string().trim().max(250).optional().nullable(),
  commune: z.string().trim().max(100).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  region: z.string().trim().max(100).optional().nullable(),
  email: z.string().trim().email().max(254).optional().nullable().or(z.literal("")),
  phone: z.string().trim().max(50).optional().nullable(),
  website: z.string().trim().max(200).optional().nullable(),
  bankName: z.string().trim().max(100).optional().nullable(),
  bankAccountType: z.string().trim().max(50).optional().nullable(),
  bankAccountNumber: z.string().trim().max(50).optional().nullable(),
  bankAccountHolder: z.string().trim().max(200).optional().nullable(),
  bankAccountRut: z.string().trim().max(20).optional().nullable(),
  bankAccountEmail: z.string().trim().email().max(254).optional().nullable().or(z.literal("")),
});

export async function saveCompanySettingsAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await enforceSameOrigin();
    const user = await requireUser("admin");
    const values = formObject(formData);
    const parsed = companySchema.safeParse(values);
    if (!parsed.success) {
      return {
        status: "error",
        message: "Revisa los campos del formulario.",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    await saveCompanySettings(
      {
        rut: parsed.data.rut,
        legalName: parsed.data.legalName,
        tradeName: parsed.data.tradeName || null,
        giro: parsed.data.giro || null,
        addressLine: parsed.data.addressLine || null,
        commune: parsed.data.commune || null,
        city: parsed.data.city || null,
        region: parsed.data.region || null,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        website: parsed.data.website || null,
        bankName: parsed.data.bankName || null,
        bankAccountType: parsed.data.bankAccountType || null,
        bankAccountNumber: parsed.data.bankAccountNumber || null,
        bankAccountHolder: parsed.data.bankAccountHolder || null,
        bankAccountRut: parsed.data.bankAccountRut || null,
        bankAccountEmail: parsed.data.bankAccountEmail || null,
      },
      user.userId
    );

    await writeAudit({
      actorUserId: user.userId,
      actorType: "user",
      action: "company.updated",
      entityType: "company",
      entityId: "default",
      metadata: { legalName: parsed.data.legalName, rut: parsed.data.rut },
    });

    revalidatePath("/empresa");
    revalidatePath("/ordenes");
    revalidatePath("/facturacion");
    return { status: "success", message: "Datos de la empresa actualizados correctamente." };
  } catch (error) {
    return { status: "error", message: safeError(error).message };
  }
}
