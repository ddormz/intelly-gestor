"use client";

import Link from "next/link";
import { Download, FileDown, PackagePlus, Pencil, Power, Upload } from "lucide-react";
import { ActionModal, Badge, Card, EmptyState, Field, Input, PageHeader, TableShell } from "@/components/ui";
import { createCatalogItemAction, importCatalogAction, setCatalogItemStatusAction, updateCatalogItemAction } from "@/features/catalog/actions";
import { formatClpAmount } from "@/lib/money";

export type CatalogListItem = { id: string; type: "product" | "service"; code: string; name: string; description: string | null; unitPrice: string; taxCategory: "taxable" | "exempt"; status: "active" | "inactive" };

function CatalogFields({ item, errors }: { item?: CatalogListItem; errors?: Record<string, string[]> }) {
  return <>
    {item ? <input type="hidden" name="id" value={item.id} /> : null}
    <Field label="Tipo" error={errors?.type?.[0]}><select name="type" defaultValue={item?.type ?? "service"} className="field"><option value="service">Servicio</option><option value="product">Producto</option></select></Field>
    <Field label="Código" error={errors?.code?.[0]}><Input required name="code" defaultValue={item?.code ?? ""} placeholder="SERV-001" /></Field>
    <Field label="Nombre" error={errors?.name?.[0]}><Input required name="name" defaultValue={item?.name ?? ""} placeholder="Implementación mensual" /></Field>
    <Field label="Descripción" error={errors?.description?.[0]}><textarea name="description" defaultValue={item?.description ?? ""} className="field min-h-24" placeholder="Describe el alcance incluido para el cliente." /></Field>
    <Field label="Precio CLP" error={errors?.unitPrice?.[0]}><Input required name="unitPrice" type="number" min="1" step="1" defaultValue={item?.unitPrice ? Number(item.unitPrice) : undefined} placeholder="150000" /></Field>
    <Field label="Tratamiento tributario" error={errors?.taxCategory?.[0]}><select name="taxCategory" defaultValue={item?.taxCategory ?? "taxable"} className="field"><option value="taxable">Afecto a IVA (19%)</option><option value="exempt">Exento</option></select></Field>
  </>;
}

export function CatalogManager({ items, canImport }: { items: CatalogListItem[]; canImport: boolean }) {
  const create = <ActionModal triggerLabel="Nuevo concepto" triggerIcon={<PackagePlus size={18} />} title="Nuevo producto o servicio" description="Crea un concepto reutilizable para nuevas órdenes." submitLabel="Guardar concepto" action={createCatalogItemAction}>{(state) => <CatalogFields errors={state.fieldErrors} />}</ActionModal>;
  const actions = <>{create}{canImport ? <ActionModal triggerLabel="Importar" triggerIcon={<Upload size={18} />} variant="secondary" title="Importar catálogo" description="Los códigos existentes se actualizan sin reactivar conceptos inactivos." submitLabel="Importar archivo" pendingLabel="Importando…" action={importCatalogAction}>{() => <Field label="Archivo CSV" hint="Máximo 2 MiB y 5.000 filas."><Input required name="file" type="file" accept=".csv,text/csv" /></Field>}</ActionModal> : null}<Link className="btn-secondary" href="/api/export/productos-servicios"><Download size={18} />Exportar</Link><Link className="btn-secondary" href="/api/export/productos-servicios?template=1"><FileDown size={18} />Plantilla</Link></>;
  return <div className="space-y-6">
    <PageHeader title="Productos o Servicios" description="Define conceptos reutilizables con precio e IVA consistente." action={actions} />
    <Card className="min-w-0"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Catálogo</h2>{items.length ? <TableShell mobileCards><thead><tr><th>Código</th><th>Concepto</th><th>Tipo</th><th>Estado</th><th className="text-right">Precio</th><th className="text-right">Acciones</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}>
      <td data-label="Código" className="font-mono text-xs">{item.code}</td><td data-label="Concepto" className="font-semibold text-[var(--brand-deep)]">{item.name}</td><td data-label="Tipo"><Badge status="draft">{item.type === "service" ? "Servicio" : "Producto"}</Badge></td><td data-label="Estado"><Badge status={item.status}>{item.status === "active" ? "Activo" : "Inactivo"}</Badge></td><td data-label="Precio" className="text-right font-semibold">{formatClpAmount(Number(item.unitPrice))}</td>
      <td data-label="Acciones"><div className="flex flex-wrap justify-end gap-2"><ActionModal triggerLabel="Editar" triggerIcon={<Pencil size={15} />} variant="secondary" title="Editar concepto" description={`Actualiza ${item.name}.`} submitLabel="Guardar cambios" action={updateCatalogItemAction}>{(state) => <CatalogFields item={item} errors={state.fieldErrors} />}</ActionModal><ActionModal triggerLabel={item.status === "active" ? "Desactivar" : "Activar"} triggerIcon={<Power size={15} />} variant={item.status === "active" ? "danger" : "secondary"} title={item.status === "active" ? "Desactivar concepto" : "Activar concepto"} description="Las líneas históricas de órdenes no se modifican." submitLabel={item.status === "active" ? "Desactivar" : "Activar"} action={setCatalogItemStatusAction}>{() => <><input type="hidden" name="id" value={item.id} /><input type="hidden" name="status" value={item.status === "active" ? "inactive" : "active"} /><p className="text-sm text-[var(--color-muted-foreground)]">Confirma el cambio de estado para <strong className="text-[var(--brand-deep)]">{item.name}</strong>.</p></>}</ActionModal></div></td>
    </tr>)}</tbody></TableShell> : <EmptyState title="Tu catálogo está vacío" copy="Agrega un producto o servicio para usarlo en nuevas órdenes." action={create} />}</Card>
  </div>;
}
