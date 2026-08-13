import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Alert, Badge, Card, EmptyState } from "@/components/ui";
import { listClients } from "@/features/clients/service";
import { listCatalogItems } from "@/features/catalog/service";
import { createOrderAction, issueOrderAction, markPaidAction } from "@/features/orders/actions";
import { listOrders } from "@/features/orders/service";

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const labels: Record<string, string> = { draft: "Borrador", issued: "Emitida", paid: "Pagada", invoiced: "Facturada", expired: "Vencida", cancelled: "Cancelada" };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<{ publicLink?: string }> }) {
  const [{ publicLink }, orders, clients, catalog] = await Promise.all([searchParams, listOrders(), listClients(), listCatalogItems()]);
  const canCreate = clients.length > 0 && catalog.length > 0;
  return <div className="space-y-6"><header><h1 className="page-title">Órdenes de Pago</h1><p className="page-copy mt-1">Crea solicitudes de cobro, emítelas y registra su pago con trazabilidad.</p></header>
    {publicLink ? <Alert tone="success">Orden emitida. Copia ahora su enlace seguro: <Link className="font-bold underline" href={publicLink}>{publicLink}</Link></Alert> : null}
    <Card><h2 className="mb-4 text-lg font-bold">Nueva orden</h2>{canCreate ? <form action={createOrderAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_110px_auto] sm:items-end"><label className="grid gap-1 text-sm font-semibold">Cliente<select name="clientId" className="field">{clients.map((client) => <option key={client.id} value={client.id}>{client.legalName}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Producto o servicio<select name="catalogItemId" className="field">{catalog.map((item) => <option key={item.id} value={item.id}>{item.name} · {money.format(Number(item.unitPrice))}</option>)}</select></label><label className="grid gap-1 text-sm font-semibold">Cantidad<input name="quantity" className="field" type="number" min="1" max="999" defaultValue="1" /></label><button className="btn-primary">Crear borrador</button></form> : <EmptyState title="Completa los datos base" copy="Necesitas al menos un cliente y un producto o servicio activo." action={<div className="flex gap-2"><Link href="/clientes" className="btn-secondary">Clientes</Link><Link href="/productos-servicios" className="btn-primary">Catálogo</Link></div>} />}</Card>
    <Card><h2 className="mb-4 text-lg font-bold">Órdenes recientes</h2>{orders.length ? <div className="overflow-x-auto"><table className="w-full min-w-[740px] text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="pb-3">Número</th><th className="pb-3">Cliente</th><th className="pb-3">Estado</th><th className="pb-3 text-right">Total</th><th className="pb-3 text-right">Acción</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id} className="border-b border-slate-100"><td className="py-3 font-mono text-xs font-semibold">{order.number}</td><td>{order.clientName}</td><td><Badge status={order.status}>{labels[order.status]}</Badge></td><td className="text-right font-semibold">{money.format(Number(order.total))}</td><td className="text-right">{order.status === "draft" ? <form action={issueOrderAction}><input type="hidden" name="id" value={order.id} /><button className="btn-secondary">Emitir</button></form> : order.status === "issued" ? <form action={markPaidAction}><input type="hidden" name="id" value={order.id} /><input type="hidden" name="idempotencyKey" value={randomUUID()} /><button className="btn-primary">Registrar pago</button></form> : <span className="text-slate-400">Sin acciones</span>}</td></tr>)}</tbody></table></div> : <EmptyState title="No hay órdenes" copy="Crea tu primera orden de pago desde el formulario superior." />}</Card>
  </div>;
}
