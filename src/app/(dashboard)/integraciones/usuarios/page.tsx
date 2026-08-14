import { asc } from "drizzle-orm";
import { UserPlus } from "lucide-react";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { Badge, Card, Field, FormPanel, Input, PageHeader, SubmitButton, TableShell } from "@/components/ui";
import { createUserAction, disableUserAction } from "@/features/auth/admin-actions";
import { requireUser } from "@/features/auth/session";

export default async function UsersPage() {
  await requireUser("admin");
  const items = await getDb().select().from(users).orderBy(asc(users.name));
  return <div className="space-y-6">
    <PageHeader title="Usuarios y sesiones" description="Crea cuentas internas y revoca de inmediato el acceso de una cuenta desactivada." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="min-w-0"><TableShell mobileCards><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th className="text-right">Acción</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td data-label="Usuario"><strong className="text-[var(--brand-deep)]">{item.name}</strong><br/><span className="text-xs text-[var(--color-muted-foreground)]">{item.email}</span></td><td data-label="Rol" className="capitalize">{item.role}</td><td data-label="Estado"><Badge status={item.status === "active" ? "paid" : "rejected"}>{item.status === "active" ? "Activo" : "Desactivado"}</Badge></td><td data-label="Acción" className="text-right">{item.status === "active" ? <form action={disableUserAction}><input type="hidden" name="id" value={item.id}/><SubmitButton variant="danger" pendingLabel="Desactivando…">Desactivar</SubmitButton></form> : "—"}</td></tr>)}</tbody></TableShell></Card>
      <FormPanel title="Nueva cuenta" icon={<UserPlus size={20} />}><form action={createUserAction} className="grid gap-3.5"><Field label="Nombre"><Input required name="name" /></Field><Field label="Correo"><Input required type="email" name="email" /></Field><Field label="Contraseña temporal" hint="Mínimo 12 caracteres."><Input required minLength={12} type="password" name="password" /></Field><Field label="Rol"><select name="role" className="field"><option value="operator">Operador</option><option value="admin">Administrador</option></select></Field><SubmitButton className="mt-2 w-full" pendingLabel="Creando cuenta…">Crear cuenta</SubmitButton></form></FormPanel>
    </div>
  </div>;
}
