import { Badge, Card, EmptyState } from "@/components/ui";
import { issueInvoiceAction } from "@/features/billing/actions";
import { listInvoices, listPaidOrdersWithoutInvoice } from "@/features/billing/service";

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default async function BillingPage() {
  const [items, ready] = await Promise.all([listInvoices(), listPaidOrdersWithoutInvoice()]);
  return <div className="space-y-6"><header><h1 className="page-title">Facturación</h1><p className="page-copy mt-1">Emite una factura por orden pagada y revisa el resultado normalizado de IntellyDTE.</p></header>
    {ready.length ? <Card><h2 className="mb-4 text-lg font-bold">Listas para facturar</h2><div className="grid gap-3">{ready.map((order) => <div key={order.id} className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 p-4 sm:flex-row sm:items-center"><div><p className="font-mono text-xs text-slate-500">{order.number}</p><p className="font-semibold">{order.clientName}</p><p className="text-sm text-slate-600">{money.format(Number(order.total))}</p></div><form action={issueInvoiceAction}><input type="hidden" name="orderId" value={order.id} /><button className="btn-primary">Emitir factura</button></form></div>)}</div></Card> : null}
    <Card><h2 className="mb-4 text-lg font-bold">Documentos</h2>{items.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="pb-3">Orden</th><th className="pb-3">Cliente</th><th className="pb-3">Estado</th><th className="pb-3">Folio</th><th className="pb-3 text-right">Total</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 font-mono text-xs">{item.orderNumber}</td><td>{item.clientName}</td><td><Badge status={item.status}>{item.status}</Badge></td><td>{item.folio ?? "—"}</td><td className="text-right font-semibold">{money.format(Number(item.total))}</td></tr>)}</tbody></table></div> : <EmptyState title="Aún no hay facturas" copy="Las órdenes pagadas aparecerán aquí listas para emitir." />}</Card>
  </div>;
}
