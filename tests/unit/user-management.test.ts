import { describe, expect, it } from "vitest";
import { assertUserStatusChangeAllowed, userStatusSchema, userUpdateSchema } from "@/features/auth/admin-service";
import { parseUsersCsv, serializeUsersCsv } from "@/features/auth/users-csv";

const currentId = "4fc73a41-4f1f-4bd1-a775-21b93af922d4";
const otherId = "6271a644-7945-48d3-bb07-c7dcf4419b34";

describe("user management", () => {
  it("rejects self-deactivation but permits disabling another user", () => {
    expect(() => assertUserStatusChangeAllowed(currentId, currentId, "disabled")).toThrow(/propia cuenta/i);
    expect(() => assertUserStatusChangeAllowed(currentId, otherId, "disabled")).not.toThrow();
  });

  it("validates user updates and statuses", () => {
    expect(userUpdateSchema.parse({ id: otherId, name: "María González", role: "operator" }).role).toBe("operator");
    expect(userStatusSchema.safeParse({ id: otherId, status: "deleted" }).success).toBe(false);
  });

  it("normalizes user CSV without exporting passwords", () => {
    const csv = "nombre,correo,rol,estado,contrasena_temporal\nMaría, MARIA@INTELLY.CL ,operador,activo,UnaClaveTemporal123";
    expect(parseUsersCsv(csv)[0]).toMatchObject({ email: "maria@intelly.cl", role: "operator", status: "active" });
    expect(serializeUsersCsv([{ name: "María", email: "maria@intelly.cl", role: "operator", status: "active" }])).not.toContain("contrasena");
    expect(serializeUsersCsv([{ name: "María", email: "maria@intelly.cl", role: "operator", status: "active" }])).not.toContain("UnaClaveTemporal123");
  });
});
