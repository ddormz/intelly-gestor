import { hashPassword } from "@/features/auth/password";
import type { BootstrapAdminConfig } from "./config";

export type ExistingBootstrapUser = {
  role: "admin" | "operator";
  status: "active" | "disabled" | "locked";
};

export type NewBootstrapAdmin = {
  email: string;
  name: string;
  passwordHash: string;
};

export interface BootstrapAdminRepository {
  findByEmail(email: string): Promise<ExistingBootstrapUser | null>;
  createAdmin(admin: NewBootstrapAdmin): Promise<void>;
}

export async function ensureBootstrapAdmin(
  config: Extract<BootstrapAdminConfig, { enabled: true }>,
  repository: BootstrapAdminRepository,
  hasher: (password: string) => Promise<string> = hashPassword,
): Promise<"created" | "existing"> {
  const existing = await repository.findByEmail(config.email);
  if (existing) {
    if (existing.role === "admin" && existing.status === "active") return "existing";
    throw new Error("Existing bootstrap account is incompatible.");
  }

  await repository.createAdmin({
    email: config.email,
    name: config.name,
    passwordHash: await hasher(config.password),
  });
  return "created";
}
