import { getDb } from "@/db";
import { companySettings } from "@/db/schema";
import { eq } from "drizzle-orm";

export type CompanyProfile = {
  id: string;
  rut: string;
  legalName: string;
  tradeName: string | null;
  giro: string | null;
  addressLine: string | null;
  commune: string | null;
  city: string | null;
  region: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  bankName: string | null;
  bankAccountType: string | null;
  bankAccountNumber: string | null;
  bankAccountHolder: string | null;
  bankAccountRut: string | null;
  bankAccountEmail: string | null;
};

export const DEFAULT_COMPANY_SETTINGS: CompanyProfile = {
  id: "default",
  rut: "76.123.456-7",
  legalName: "Intelly SpA",
  tradeName: "Intelly",
  giro: "Servicios Informáticos y Desarrollo de Software",
  addressLine: "Av. Providencia 1234, Of. 501",
  commune: "Providencia",
  city: "Santiago",
  region: "Región Metropolitana",
  email: "contacto@intelly.cl",
  phone: "+56 9 1234 5678",
  website: "https://intelly.cl",
  bankName: "Banco Santander",
  bankAccountType: "Cuenta Corriente",
  bankAccountNumber: "12345678",
  bankAccountHolder: "Intelly SpA",
  bankAccountRut: "76.123.456-7",
  bankAccountEmail: "pagos@intelly.cl",
};

export async function getCompanySettings(): Promise<CompanyProfile> {
  try {
    const [row] = await getDb()
      .select()
      .from(companySettings)
      .where(eq(companySettings.id, "default"))
      .limit(1)
      .execute();

    if (!row) return DEFAULT_COMPANY_SETTINGS;
    return {
      id: row.id,
      rut: row.rut,
      legalName: row.legalName,
      tradeName: row.tradeName,
      giro: row.giro,
      addressLine: row.addressLine,
      commune: row.commune,
      city: row.city,
      region: row.region,
      email: row.email,
      phone: row.phone,
      website: row.website,
      bankName: row.bankName,
      bankAccountType: row.bankAccountType,
      bankAccountNumber: row.bankAccountNumber,
      bankAccountHolder: row.bankAccountHolder,
      bankAccountRut: row.bankAccountRut,
      bankAccountEmail: row.bankAccountEmail,
    };
  } catch {
    return DEFAULT_COMPANY_SETTINGS;
  }
}

export async function saveCompanySettings(
  input: Omit<CompanyProfile, "id">,
  userId: string
): Promise<void> {
  const db = getDb();
  const existing = await getCompanySettings();

  if (existing.id === "default" && existing !== DEFAULT_COMPANY_SETTINGS) {
    await db
      .update(companySettings)
      .set({
        ...input,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(companySettings.id, "default"))
      .execute();
  } else {
    await db
      .insert(companySettings)
      .values({
        id: "default",
        ...input,
        updatedBy: userId,
      })
      .onDuplicateKeyUpdate({
        set: {
          ...input,
          updatedBy: userId,
          updatedAt: new Date(),
        },
      })
      .execute();
  }
}
