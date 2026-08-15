"use client";

import { Download, FileDown, KeyRound, Pencil, Power, Upload, UserPlus } from "lucide-react";
import { ActionModal, Badge, EmptyState, Field, IconButton, Input, PageHeader, Pagination, TableShell, TableToolbar } from "@/components/ui";
import { createUserAction, importUsersAction, setUserStatusAction, updateUserAction } from "@/features/auth/admin-actions";
import { sendUserRecoveryAction } from "@/features/auth/password-reset-actions";
import type { PageQuery } from "@/lib/list-query";

type UserItem = { id: string; name: string; email: string; role: "admin" | "operator"; status: "active" | "disabled" | "locked" };

function UserFields({ item, errors }: { item?: UserItem; errors?: Record<string, string[]> }) {
  return <>
    {item ? <input type="hidden" name="id" value={item.id} /> : null}
    <Field label="Nombre" error={errors?.name?.[0]}><Input required name="name" defaultValue={item?.name ?? ""} placeholder="María González" /></Field>
    {!item ? <Field label="Correo" error={errors?.email?.[0]}><Input required type="email" name="email" placeholder="maria@intelly.cl" autoComplete="email" /></Field> : null}
    {!item ? <Field label="Contraseña temporal" error={errors?.password?.[0]} hint="Mínimo 12 caracteres; entrégala por un canal seguro."><Input required minLength={12} maxLength={128} type="password" name="password" placeholder="Una frase segura de 12+ caracteres" autoComplete="new-password" /></Field> : null}
    <Field label="Rol" error={errors?.role?.[0]}><select name="role" defaultValue={item?.role ?? "operator"} className="field"><option value="operator">Operador</option><option value="admin">Administrador</option></select></Field>
  </>;
}

export function UserManager({ items, currentUserId, query, page, pageSize, total }: { items: UserItem[]; currentUserId: string; query: PageQuery; page: number; pageSize: number; total: number }) {
  const create = <ActionModal iconOnly triggerLabel="Nuevo usuario" triggerIcon={<UserPlus size={18} />} title="Nueva cuenta" description="Crea acceso interno para un integrante del equipo." submitLabel="Crear cuenta" action={createUserAction}>{(state) => <UserFields errors={state.fieldErrors} />}</ActionModal>;
  const actions = <>{create}<ActionModal iconOnly triggerLabel="Importar usuarios" triggerIcon={<Upload size={18} />} variant="secondary" title="Importar usuarios" description="Las cuentas nuevas requieren una contraseña temporal en el CSV." submitLabel="Importar usuarios" action={importUsersAction}>{() => <Field label="Archivo CSV" hint="Las contraseñas nunca se incluyen en la exportación."><Input required name="file" type="file" accept=".csv,text/csv" /></Field>}</ActionModal><IconButton href="/api/export/usuarios" label="Exportar usuarios" icon={<Download size={18} />} /><IconButton href="/api/export/usuarios?template=1" label="Descargar plantilla de usuarios" icon={<FileDown size={18} />} /></>;
  return <div className="space-y-6">
    <PageHeader title="Usuarios" description="Administra cuentas internas, roles, accesos y recuperación de contraseña." action={actions} />
    <TableToolbar query={query} filters={[{ name: "status", label: "Estado", options: [{ value: "", label: "Todos" }, { value: "active", label: "Activos" }, { value: "disabled", label: "Desactivados" }, { value: "locked", label: "Bloqueados" }] }]} />
    <section className="min-w-0 space-y-4"><h2 className="text-lg font-bold text-[var(--brand-deep)]">Usuarios</h2>{items.length ? <TableShell mobileCards><thead><tr><th>Usuario</th><th>Rol</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
      <td data-label="Usuario"><strong className="text-[var(--brand-deep)]">{item.name}</strong><br/><span className="text-xs text-[var(--color-muted-foreground)]">{item.email}</span></td><td data-label="Rol" className="capitalize">{item.role === "admin" ? "Administrador" : "Operador"}</td><td data-label="Estado"><Badge status={item.status === "active" ? "paid" : item.status === "locked" ? "pending" : "rejected"}>{item.status === "active" ? "Activo" : item.status === "locked" ? "Bloqueado" : "Desactivado"}</Badge></td>
      <td data-label="Acciones"><div className="flex flex-wrap justify-end gap-2">
        <ActionModal iconOnly triggerLabel="Editar usuario" triggerIcon={<Pencil size={15} />} variant="secondary" title="Editar usuario" description={`Actualiza nombre y rol de ${item.email}.`} submitLabel="Guardar cambios" action={updateUserAction}>{(state) => <UserFields item={item} errors={state.fieldErrors} />}</ActionModal>
        {item.status === "active" ? <ActionModal iconOnly triggerLabel="Enviar recuperación" triggerIcon={<KeyRound size={15} />} variant="secondary" title="Enviar recuperación" description="Se enviará un enlace de un solo uso al correo registrado." submitLabel="Enviar enlace" action={sendUserRecoveryAction}>{() => <><input type="hidden" name="email" value={item.email}/><p className="text-sm text-[var(--color-muted-foreground)]">El enlace se enviará a <strong>{item.email}</strong> y vencerá en 30 minutos.</p></>}</ActionModal> : null}
        {item.id !== currentUserId ? <ActionModal iconOnly triggerLabel={item.status === "active" ? "Desactivar usuario" : "Activar usuario"} triggerIcon={<Power size={15} />} variant={item.status === "active" ? "danger" : "secondary"} title={item.status === "active" ? "Desactivar usuario" : "Activar usuario"} description="Al desactivar se revocarán todas las sesiones activas." submitLabel={item.status === "active" ? "Desactivar" : "Activar"} action={setUserStatusAction}>{() => <><input type="hidden" name="id" value={item.id}/><input type="hidden" name="status" value={item.status === "active" ? "disabled" : "active"}/><p className="text-sm text-[var(--color-muted-foreground)]">Confirma el cambio para <strong>{item.name}</strong>.</p></>}</ActionModal> : null}
       </div></td>
      </tr>)}</tbody></TableShell> : <EmptyState title="No hay usuarios" copy="No hay cuentas que coincidan con los filtros actuales." action={create} />}</section>
    <Pagination page={page} pageSize={pageSize} total={total} query={query} />
  </div>;
}
