import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState, Field, PageHeader, SubmitButton, TableShell } from "@/components/ui";
import { listClients } from "@/features/clients/service";
import { listCatalogItems } from "@/features/catalog/service";
import { createOrderAction, issueOrderAction, markPaidAction } from "@/features/orders/actions";
import { listOrders } from "@/features/orders/service";
import { formatClpAmount } from "@/lib/money";
import { getStatusLabel } from "@/lib/presentation";

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ publicLink?: string }> }) {
  const [{ publicLink }, orders, clients, catalog] = await Promise.all([searchParams, listOrders(), listClients(), listCatalogItems()]);
  const canCreate = clients.length > 0 && catalog.length > 0;
  return <div className="space-y-6">
    <PageHeader title="Órdenes de Pago" description="Crea solicitudes de cobro, emítelas y registra su pago con trazabilidad." />
    {publicLink ? <Alert tone="success">Orden emitida. Copia ahora su enlace seguro: <Link className="font-bold underline" href={publicLink}>{publicLink}</Link></Alert> : null}
    <Card className="brand-card"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Nueva orden</h2>{canCreate ? <form action={createOrderAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end">
      <Field label="Cliente"><select name="clientId" className="field">{clients.map((client) => <option key={client.id} value={client.id}>{client.legalName}</option>)}</select></Field>
      <Field label="Producto o servicio"><select name="catalogItemId" className="field">{catalog.map((item) => <option key={item.id} value={item.id}>{item.name} · {formatClpAmount(Number(item.unitPrice))}</option>)}</select></Field>
      <Field label="Cantidad"><input name="quantity" className="field" type="number" min="1" max="999" defaultValue="1" /></Field>
      <SubmitButton pendingLabel="Creando…">Crear borrador</SubmitButton>
    </form> : <EmptyState title="Completa los datos base" copy="Necesitas al menos un cliente y un producto o servicio activo." action={<div className="flex flex-wrap justify-center gap-2"><Link href="/clientes" className="btn-secondary">Clientes</Link><Link href="/productos-servicios" className="btn-primary">Catálogo</Link></div>} />}</Card>
    <Card className="min-w-0"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Órdenes recientes</h2>{orders.length ? <TableShell mobileCards><thead><tr><th>Número</th><th>Cliente</th><th>Estado</th><th className="text-right">Total</th><th className="text-right">Acción</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}>
      <td data-label="Número" className="font-mono text-xs font-semibold">{order.number}</td><td data-label="Cliente" className="font-medium">{order.clientName}</td><td data-label="Estado"><Badge status={order.status}>{getStatusLabel(order.status)}</Badge></td><td data-label="Total" className="text-right font-semibold">{formatClpAmount(Number(order.total))}</td><td data-label="Acción" className="text-right">{order.status === "draft" ? <form action={issueOrderAction}><input type="hidden" name="id" value={order.id} /><SubmitButton variant="secondary" pendingLabel="Emitiendo…">Emitir</SubmitButton></form> : order.status === "issued" ? <form action={markPaidAction}><input type="hidden" name="id" value={order.id} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><SubmitButton pendingLabel="Registrando…">Registrar pago</SubmitButton></form> : <span className="text-[var(--color-muted-foreground)]">Sin acciones</span>}</td>
    </tr>)}</tbody></TableShell> : <EmptyState title="No hay órdenes" copy="Crea tu primera orden de pago desde el formulario superior." />}</Card>
  </div>;
}
