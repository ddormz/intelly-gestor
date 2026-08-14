import Link from "next/link";
import { Banknote, Clock3, FileCheck2, Plus, ReceiptText } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { MetricCard } from "@/components/dashboard/metric-card";
import { RevenueChart } from "@/components/dashboard/charts";
import { getDashboardData } from "@/features/dashboard/service";
import { formatClpAmount } from "@/lib/money";

export default async function DashboardPage() {
  const { metrics, trend } = await getDashboardData();
  const empty = Number(metrics.orders) === 0;
  return <div className="space-y-6">
    <PageHeader eyebrow="Últimos 30 días" title="Resumen del negocio" description="Cobros, órdenes y facturación en una sola vista." action={<Link href="/ordenes" className="btn-primary"><Plus size={18} />Nueva orden</Link>} />
    <section aria-label="Indicadores principales" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="Ingresos cobrados" value={formatClpAmount(Number(metrics.collected))} note="Órdenes pagadas y facturadas" icon={Banknote} tone="green" />
      <MetricCard label="Monto pendiente" value={formatClpAmount(Number(metrics.pending))} note="Órdenes emitidas" icon={Clock3} tone="amber" />
      <MetricCard label="Órdenes creadas" value={String(metrics.orders)} note="En el período" icon={ReceiptText} tone="blue" />
      <MetricCard label="Facturas emitidas" value={String(metrics.invoices ?? 0)} note="Documentos completados" icon={FileCheck2} />
    </section>
    {empty ? <EmptyState title="Empieza con los datos esenciales" copy="Crea un cliente y un producto o servicio; después podrás emitir tu primera orden de pago." action={<div className="flex flex-wrap justify-center gap-2"><Link href="/clientes" className="btn-secondary">Crear cliente</Link><Link href="/productos-servicios" className="btn-primary">Crear concepto</Link></div>} /> : <Card className="brand-card"><div className="mb-5"><h2 className="text-lg font-bold text-[var(--brand-deep)]">Ingresos cobrados</h2><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">Evolución diaria del período seleccionado.</p></div><RevenueChart data={trend} /></Card>}
  </div>;
}
