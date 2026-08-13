import Link from "next/link";
import { Banknote, Clock3, FileCheck2, ReceiptText, Plus } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/charts";
import { getDashboardData } from "@/features/dashboard/service";

const currency = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default async function DashboardPage() {
  const { metrics, trend } = await getDashboardData();
  const empty = Number(metrics.orders) === 0;
  return <div className="space-y-6">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold uppercase tracking-[.16em] text-emerald-700">Últimos 30 días</p><h1 className="page-title mt-1">Resumen del negocio</h1><p className="page-copy mt-1">Cobros, órdenes y facturación en una sola vista.</p></div><Link href="/ordenes" className="btn-primary"><Plus size={18} />Nueva orden</Link></header>
    <section aria-label="Indicadores principales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Ingresos cobrados" value={currency.format(Number(metrics.collected))} note="Órdenes pagadas y facturadas" icon={Banknote} tone="green" />
      <MetricCard label="Monto pendiente" value={currency.format(Number(metrics.pending))} note="Órdenes emitidas" icon={Clock3} tone="amber" />
      <MetricCard label="Órdenes creadas" value={String(metrics.orders)} note="En el período" icon={ReceiptText} tone="blue" />
      <MetricCard label="Facturas emitidas" value={String(metrics.invoices ?? 0)} note="Documentos completados" icon={FileCheck2} />
    </section>
    {empty ? <EmptyState title="Empieza con los datos esenciales" copy="Crea un cliente y un producto o servicio; después podrás emitir tu primera orden de pago." action={<div className="flex flex-wrap justify-center gap-2"><Link href="/clientes" className="btn-secondary">Crear cliente</Link><Link href="/productos-servicios" className="btn-primary">Crear concepto</Link></div>} /> : <Card><div className="mb-4"><h2 className="text-lg font-bold">Ingresos cobrados</h2><p className="text-sm text-slate-500">Evolución diaria del período seleccionado.</p></div><RevenueChart data={trend} /></Card>}
  </div>;
}
