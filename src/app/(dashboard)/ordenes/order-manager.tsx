"use client";

import Link from "next/link";
import { Banknote, Download, FileDown, Plus, Send, Upload } from "lucide-react";
import { ActionModal, Alert, Badge, Card, EmptyState, Field, Input, PageHeader, TableShell } from "@/components/ui";
import { createOrderAction, importDraftOrdersAction, issueOrderAction, markPaidAction } from "@/features/orders/actions";
import { formatClpAmount } from "@/lib/money";
import { getStatusLabel } from "@/lib/presentation";

type SelectItem = { id: string; name: string; detail?: string };
type OrderItem = { id: string; number: string; clientName: string; status: string; total: string };

export function OrderManager({ publicLink, orders, clients, catalog, canImport }: { publicLink?: string; orders: OrderItem[]; clients: SelectItem[]; catalog: SelectItem[]; canImport: boolean }) {
  const canCreate = clients.length > 0 && catalog.length > 0;
  const create = canCreate ? <ActionModal triggerLabel="Nueva orden" triggerIcon={<Plus size={18} />} title="Nueva orden de pago" description="Crea un borrador a partir de un cliente y un concepto activo." submitLabel="Crear borrador" action={createOrderAction}>{(state) => <>
    <Field label="Cliente" error={state.fieldErrors?.clientId?.[0]}><select required name="clientId" className="field" defaultValue=""><option value="" disabled>Selecciona un cliente</option>{clients.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
    <Field label="Producto o servicio" error={state.fieldErrors?.catalogItemId?.[0]}><select required name="catalogItemId" className="field" defaultValue=""><option value="" disabled>Selecciona un concepto</option>{catalog.map((item) => <option key={item.id} value={item.id}>{item.name}{item.detail ? ` · ${item.detail}` : ""}</option>)}</select></Field>
    <Field label="Cantidad" error={state.fieldErrors?.quantity?.[0]}><Input required name="quantity" type="number" min="1" max="999" defaultValue="1" placeholder="1" /></Field>
  </>}</ActionModal> : <Link href="/clientes" className="btn-primary"><Plus size={18} />Completar datos base</Link>;
  const actions = <>{create}{canImport ? <ActionModal triggerLabel="Importar borradores" triggerIcon={<Upload size={18} />} variant="secondary" title="Importar órdenes en borrador" description="Cada fila debe indicar un RUT activo, código activo y cantidad." submitLabel="Importar borradores" action={importDraftOrdersAction}>{() => <Field label="Archivo CSV" hint="No sobrescribe órdenes existentes."><Input required name="file" type="file" accept=".csv,text/csv" /></Field>}</ActionModal> : null}<Link href="/api/export/ordenes" className="btn-secondary"><Download size={18} />Exportar</Link><Link href="/api/export/ordenes?template=1" className="btn-secondary"><FileDown size={18} />Plantilla</Link></>;
  return <div className="space-y-6">
    <PageHeader title="Órdenes de Pago" description="Crea solicitudes de cobro, emítelas y registra su pago con trazabilidad." action={actions} />
    {publicLink ? <Alert tone="success">Orden emitida. Copia ahora su enlace seguro: <Link className="font-bold underline" href={publicLink}>{publicLink}</Link></Alert> : null}
    {!canCreate ? <EmptyState title="Completa los datos base" copy="Necesitas al menos un cliente y un producto o servicio activo." action={<div className="flex flex-wrap justify-center gap-2"><Link href="/clientes" className="btn-secondary">Clientes</Link><Link href="/productos-servicios" className="btn-primary">Catálogo</Link></div>} /> : null}
    <Card className="min-w-0"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Órdenes recientes</h2>{orders.length ? <TableShell mobileCards><thead><tr><th>Número</th><th>Cliente</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Acción</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}>
      <td data-label="Número" className="font-mono text-xs font-semibold">{order.number}</td><td data-label="Cliente" className="font-medium">{order.clientName}</td><td data-label="Estado"><Badge status={order.status}>{getStatusLabel(order.status)}</Badge></td><td data-label="Total" className="text-right font-semibold">{formatClpAmount(Number(order.total))}</td>
      <td data-label="Acción"><div className="flex justify-end">{order.status === "draft" ? <ActionModal triggerLabel="Emitir" triggerIcon={<Send size={15} />} variant="secondary" title="Emitir orden" description="Se generará un enlace público seguro para el cliente." submitLabel="Emitir orden" action={issueOrderAction}>{() => <><input type="hidden" name="id" value={order.id} /><p className="text-sm text-[var(--color-muted-foreground)]">Confirma la emisión de <strong>{order.number}</strong>.</p></>}</ActionModal> : order.status === "issued" ? <ActionModal triggerLabel="Registrar pago" triggerIcon={<Banknote size={15} />} title="Registrar pago" description="Esta acción cambia el estado financiero de la orden." submitLabel="Confirmar pago" action={markPaidAction}>{() => <><input type="hidden" name="id" value={order.id} /><input type="hidden" name="idempotencyKey" value={`payment:${order.id}`} /><p className="text-sm text-[var(--color-muted-foreground)]">Confirma el pago de <strong>{formatClpAmount(Number(order.total))}</strong>.</p></>}</ActionModal> : <span className="text-[var(--color-muted-foreground)]">Sin acciones</span>}</div></td>
    </tr>)}</tbody></TableShell> : <EmptyState title="No hay órdenes" copy="Crea tu primera orden de pago desde el botón superior." />}</Card>
  </div>;
}
