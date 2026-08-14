"use client";

import { Pencil, Power, UserRoundPlus } from "lucide-react";
import { ActionModal, Badge, Card, EmptyState, Field, Input, PageHeader, TableShell } from "@/components/ui";
import { createClientAction, setClientStatusAction, updateClientAction } from "@/features/clients/actions";

export type ClientListItem = {
  id: string;
  kind: "person" | "company";
  taxId: string | null;
  legalName: string;
  email: string;
  phone: string | null;
  addressLine: string | null;
  commune: string | null;
  city: string | null;
  status: "active" | "inactive";
};

function ClientFields({ item, errors }: { item?: ClientListItem; errors?: Record<string, string[]> }) {
  return <>
    {item ? <input type="hidden" name="id" value={item.id} /> : null}
    <Field label="Tipo" error={errors?.kind?.[0]}><select name="kind" defaultValue={item?.kind ?? "company"} className="field"><option value="company">Empresa</option><option value="person">Persona</option></select></Field>
    <Field label="RUT" error={errors?.taxId?.[0]}><Input required name="taxId" defaultValue={item?.taxId ?? ""} placeholder="76.123.456-7" /></Field>
    <Field label="Razón social o nombre" error={errors?.legalName?.[0]}><Input required name="legalName" defaultValue={item?.legalName ?? ""} placeholder="Comercial Intelly SpA" /></Field>
    <Field label="Correo" error={errors?.email?.[0]}><Input required name="email" type="email" defaultValue={item?.email ?? ""} placeholder="facturacion@empresa.cl" /></Field>
    <Field label="Teléfono" error={errors?.phone?.[0]}><Input name="phone" defaultValue={item?.phone ?? ""} placeholder="+56 9 1234 5678" /></Field>
    <Field label="Dirección" error={errors?.addressLine?.[0]}><Input name="addressLine" defaultValue={item?.addressLine ?? ""} placeholder="Av. Providencia 1234" /></Field>
    <div className="grid gap-3 sm:grid-cols-2"><Field label="Comuna" error={errors?.commune?.[0]}><Input name="commune" defaultValue={item?.commune ?? ""} placeholder="Providencia" /></Field><Field label="Ciudad" error={errors?.city?.[0]}><Input name="city" defaultValue={item?.city ?? ""} placeholder="Santiago" /></Field></div>
  </>;
}

export function ClientManager({ items }: { items: ClientListItem[] }) {
  const create = <ActionModal triggerLabel="Nuevo cliente" triggerIcon={<UserRoundPlus size={18} />} title="Nuevo cliente" description="Completa los datos comerciales y tributarios." submitLabel="Guardar cliente" pendingLabel="Guardando cliente…" action={createClientAction}>{(state) => <ClientFields errors={state.fieldErrors} />}</ActionModal>;

  return <div className="space-y-6">
    <PageHeader title="Clientes" description="Mantén los datos comerciales y tributarios usados en órdenes y facturas." action={create} />
    <Card className="min-w-0"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Clientes</h2>{items.length ? <TableShell mobileCards><thead><tr><th>Cliente</th><th>RUT</th><th>Contacto</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
      <td data-label="Cliente" className="font-semibold text-[var(--brand-deep)]">{item.legalName}</td><td data-label="RUT">{item.taxId}</td><td data-label="Contacto">{item.email}</td><td data-label="Estado"><Badge status={item.status}>{item.status === "active" ? "Activo" : "Inactivo"}</Badge></td>
      <td data-label="Acciones"><div className="flex flex-wrap justify-end gap-2"><ActionModal triggerLabel="Editar" triggerIcon={<Pencil size={15} />} variant="secondary" title="Editar cliente" description={`Actualiza los datos de ${item.legalName}.`} submitLabel="Guardar cambios" action={updateClientAction}>{(state) => <ClientFields item={item} errors={state.fieldErrors} />}</ActionModal><ActionModal triggerLabel={item.status === "active" ? "Desactivar" : "Activar"} triggerIcon={<Power size={15} />} variant={item.status === "active" ? "danger" : "secondary"} title={item.status === "active" ? "Desactivar cliente" : "Activar cliente"} description="El historial no se elimina y el cambio puede revertirse." submitLabel={item.status === "active" ? "Desactivar" : "Activar"} action={setClientStatusAction}>{() => <><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value={item.status === "active" ? "inactive" : "active"} /><p className="text-sm text-[var(--color-muted-foreground)]">Confirma el cambio de estado para <strong className="text-[var(--brand-deep)]">{item.legalName}</strong>.</p></>}</ActionModal></div></td>
    </tr>)}</tbody></TableShell> : <EmptyState title="Aún no hay clientes" copy="Agrega el primer cliente para poder crear una orden de pago." action={create} />}</Card>
  </div>;
}
