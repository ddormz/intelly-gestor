"use client";

import { useState } from "react";
import { Download, FileDown, Pencil, Power, Search, Upload, UserRoundPlus } from "lucide-react";
import { ActionModal, Alert, Badge, ComboBox, EmptyState, Field, IconButton, Input, PageHeader, Pagination, TableShell, TableToolbar } from "@/components/ui";
import { createClientAction, importClientsAction, setClientStatusAction, updateClientAction } from "@/features/clients/actions";
import { cityForCommune, listCommunes, listRegions } from "@/features/clients/geography";
import type { PageQuery } from "@/lib/list-query";

export type ClientListItem = {
  id: string;
  kind: "person" | "company";
  taxId: string | null;
  legalName: string;
  giro: string | null;
  email: string;
  phone: string | null;
  addressLine: string | null;
  region: string | null;
  commune: string | null;
  city: string | null;
  status: "active" | "inactive";
};

function ClientFields({ item, errors }: { item?: ClientListItem; errors?: Record<string, string[]> }) {
  const [kind, setKind] = useState(item?.kind ?? "company");
  const [taxId, setTaxId] = useState(item?.taxId ?? "");
  const [legalName, setLegalName] = useState(item?.legalName ?? "");
  const [region, setRegion] = useState(item?.region ?? "");
  const [commune, setCommune] = useState(item?.commune ?? "");
  const [lookup, setLookup] = useState<{ status: "idle" | "loading" | "success" | "error"; message?: string }>({ status: "idle" });
  const communes = listCommunes(region);
  const city = cityForCommune(region, commune) ?? "";

  function changeRegion(value: string) {
    setRegion(value);
    setCommune("");
  }

  function changeCommune(value: string) {
    setCommune(value);
  }

  async function lookupRut() {
    setLookup({ status: "loading" });
    try {
      const response = await fetch(`/api/clients/rut/${encodeURIComponent(taxId.trim())}`, { headers: { Accept: "application/json" }, cache: "no-store" });
      const payload = await response.json() as { success?: boolean; data?: { razonSocial: string | null; autorizado: boolean | null }; message?: string };
      if (!response.ok || !payload.success || !payload.data) {
        setLookup({ status: "error", message: payload.message ?? "No fue posible consultar el RUT." });
        return;
      }
      if (payload.data.razonSocial) setLegalName(payload.data.razonSocial);
      const authorization = payload.data.autorizado === true ? "RUT autorizado." : payload.data.autorizado === false ? "RUT no autorizado." : "Autorización no informada.";
      setLookup({ status: "success", message: payload.data.razonSocial ? `${authorization} Revisa el nombre antes de guardar.` : `${authorization} IntellyDTE no informó razón social; ingrésala manualmente.` });
    } catch {
      setLookup({ status: "error", message: "No fue posible conectar con el servicio de consulta." });
    }
  }

  return <>
    {item ? <input type="hidden" name="id" value={item.id} /> : null}
    <ComboBox name="kind" label="Tipo" options={[{ value: "company", label: "Empresa" }, { value: "person", label: "Persona" }]} value={kind} onChange={(value) => setKind(value as ClientListItem["kind"])} required />
    <Field label="RUT" error={errors?.taxId?.[0]}><div className="flex items-end gap-2"><Input required name="taxId" value={taxId} onChange={(event) => setTaxId(event.target.value)} placeholder="76.123.456-0" /><IconButton type="button" label="Consultar RUT" icon={<Search size={18} />} pending={lookup.status === "loading"} disabled={!taxId.trim()} onClick={lookupRut} /></div></Field>
    <Field label="Razón social o nombre" error={errors?.legalName?.[0]}><Input required name="legalName" value={legalName} onChange={(event) => setLegalName(event.target.value)} placeholder="Comercial Intelly SpA" /></Field>
    {lookup.status !== "idle" ? <Alert tone={lookup.status === "error" ? "error" : lookup.status === "success" ? "success" : "info"}>{lookup.status === "loading" ? "Consultando RUT…" : lookup.message}</Alert> : null}
    <Field label="Giro" error={errors?.giro?.[0]}><Input name="giro" defaultValue={item?.giro ?? ""} placeholder="Servicios informáticos" /></Field>
    <Field label="Correo" error={errors?.email?.[0]}><Input required name="email" type="email" defaultValue={item?.email ?? ""} placeholder="facturacion@empresa.cl" /></Field>
    <Field label="Teléfono" error={errors?.phone?.[0]}><Input name="phone" defaultValue={item?.phone ?? ""} placeholder="+56 9 1234 5678" /></Field>
    <Field label="Dirección" error={errors?.addressLine?.[0]}><Input required name="addressLine" defaultValue={item?.addressLine ?? ""} placeholder="Av. Providencia 1234" /></Field>
    <div className="grid gap-3 sm:grid-cols-3"><ComboBox name="region" label="Región" options={listRegions().map((option) => ({ value: option, label: option }))} value={region} onChange={changeRegion} required /><ComboBox name="commune" label="Comuna" options={communes.map((option) => ({ value: option, label: option }))} value={commune} onChange={changeCommune} required /><ComboBox name="city" label="Ciudad" options={city ? [{ value: city, label: city }] : []} value={city} onChange={() => undefined} required /></div>
  </>;
}

export function ClientManager({ items, canImport, returnTo, query, page, pageSize, total }: { items: ClientListItem[]; canImport: boolean; returnTo?: string; query: PageQuery; page: number; pageSize: number; total: number }) {
  const create = <ActionModal iconOnly triggerLabel="Nuevo cliente" triggerIcon={<UserRoundPlus size={18} />} title="Nuevo cliente" description="Completa los datos comerciales y tributarios." submitLabel="Guardar cliente" pendingLabel="Guardando cliente…" action={createClientAction}>{(state) => <>{returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}<ClientFields errors={state.fieldErrors} /></>}</ActionModal>;
  const actions = <>{create}{canImport ? <ActionModal iconOnly triggerLabel="Importar clientes" triggerIcon={<Upload size={18} />} variant="secondary" title="Importar clientes" description="Usa la plantilla CSV. El archivo completo se valida antes de guardar." submitLabel="Importar archivo" pendingLabel="Importando…" action={importClientsAction}>{() => <Field label="Archivo CSV" hint="Máximo 2 MiB y 5.000 filas."><Input required name="file" type="file" accept=".csv,text/csv" /></Field>}</ActionModal> : null}<IconButton href="/api/export/clientes" label="Exportar clientes" icon={<Download size={18} />} /><IconButton href="/api/export/clientes?template=1" label="Descargar plantilla de clientes" icon={<FileDown size={18} />} /></>;

  return <div className="space-y-6">
    <PageHeader title="Clientes" description="Mantén los datos comerciales y tributarios usados en órdenes y facturas." action={actions} />
    <TableToolbar query={query} tabs={[{ value: "active", label: "Activos" }, { value: "inactive", label: "Inactivos" }, { value: "all", label: "Todos" }]} filters={[{ name: "kind", label: "Tipo", options: [{ value: "", label: "Todos" }, { value: "company", label: "Empresas" }, { value: "person", label: "Personas" }] }]} />
    <section className="min-w-0 space-y-4"><h2 className="text-lg font-bold text-[var(--brand-deep)]">Clientes</h2>{items.length ? <TableShell mobileCards><thead><tr><th>Cliente</th><th>RUT</th><th>Contacto</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
      <td data-label="Cliente" className="font-semibold text-[var(--brand-deep)]">{item.legalName}</td><td data-label="RUT">{item.taxId}</td><td data-label="Contacto">{item.email}</td><td data-label="Estado"><Badge status={item.status}>{item.status === "active" ? "Activo" : "Inactivo"}</Badge></td>
      <td data-label="Acciones"><div className="flex flex-wrap justify-end gap-2"><ActionModal iconOnly triggerLabel="Editar cliente" triggerIcon={<Pencil size={15} />} variant="secondary" title="Editar cliente" description={`Actualiza los datos de ${item.legalName}.`} submitLabel="Guardar cambios" action={updateClientAction}>{(state) => <ClientFields item={item} errors={state.fieldErrors} />}</ActionModal><ActionModal iconOnly triggerLabel={item.status === "active" ? "Desactivar cliente" : "Activar cliente"} triggerIcon={<Power size={15} />} variant={item.status === "active" ? "danger" : "secondary"} title={item.status === "active" ? "Desactivar cliente" : "Activar cliente"} description="El historial no se elimina y el cambio puede revertirse." submitLabel={item.status === "active" ? "Desactivar" : "Activar"} action={setClientStatusAction}>{() => <><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value={item.status === "active" ? "inactive" : "active"} /><p className="text-sm text-[var(--color-muted-foreground)]">Confirma el cambio de estado para <strong className="text-[var(--brand-deep)]">{item.legalName}</strong>.</p></>}</ActionModal></div></td>
    </tr>)}</tbody></TableShell> : <EmptyState title="Aún no hay clientes" copy="Agrega el primer cliente para poder crear una orden de pago." action={create} />}</section>
    <Pagination page={page} pageSize={pageSize} total={total} query={query} />
  </div>;
}
