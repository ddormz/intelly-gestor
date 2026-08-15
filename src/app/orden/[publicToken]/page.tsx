import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, Download, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Badge, Card } from "@/components/ui";
import { findPublicOrder } from "@/features/orders/service";
import { formatClpAmount } from "@/lib/money";
import { getStatusLabel } from "@/lib/presentation";

export default async function PublicOrderPage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  if (publicToken.length < 40 || publicToken.length > 128) notFound();
  const order = await findPublicOrder(publicToken);
  if (!order) notFound();

  return <main className="min-h-screen bg-[var(--color-background)] p-4 sm:p-8">
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between gap-4"><BrandLogo priority /><span className="secure-link-badge"><LockKeyhole size={14} />Enlace seguro</span></div>
      <Card className="brand-card p-6 sm:p-8">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--color-border)] pb-6 sm:flex-row sm:items-start"><div><p className="font-mono text-xs text-[var(--color-muted-foreground)]">{order.number}</p><h1 className="mt-2 text-2xl font-bold text-[var(--brand-deep)]">Orden de pago</h1><p className="mt-1 text-[var(--color-muted-foreground)]">Emitida para {order.clientName}</p></div><div className="grid size-12 place-items-center rounded-full bg-[rgb(18_128_92_/_0.08)] text-[var(--color-success)]"><CheckCircle2 /></div></div>
        <div className="py-8 text-center"><p className="text-sm font-semibold text-[var(--color-muted-foreground)]">Total a pagar</p><p className="mt-2 text-4xl font-bold text-[var(--brand-royal)] sm:text-5xl">{formatClpAmount(Number(order.total))}</p><div className="mt-4"><Badge status={order.status}>{getStatusLabel(order.status)}</Badge></div></div>
        <a href={`/api/public/orders/${publicToken}/pdf`} className="btn-primary mx-auto mb-6 w-fit"><Download size={18} />Descargar orden en PDF</a>
        <div className="grid gap-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background-soft)] p-4 text-sm sm:grid-cols-2"><div className="flex gap-2"><Clock3 size={18} className="shrink-0 text-[var(--brand-blue)]" /><span>Estado actualizado y verificable</span></div><div className="flex gap-2"><ShieldCheck size={18} className="shrink-0 text-[var(--brand-blue)]" /><span>Token privado de acceso</span></div></div>
        <p className="mt-6 text-xs leading-relaxed text-[var(--color-muted-foreground)]">Para coordinar el pago, usa las instrucciones entregadas directamente por el emisor. Intelly Gestor nunca solicitará tu contraseña en esta página.</p>
      </Card>
      <p className="mt-5 text-center text-xs text-[var(--color-muted-foreground)]">Gestión y facturación conectada por Intelly</p>
    </div>
  </main>;
}
