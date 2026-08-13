import { notFound } from "next/navigation";
import { CheckCircle2, Clock3, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui";
import { findPublicOrder } from "@/features/orders/service";

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default async function PublicOrderPage({ params }: { params: Promise<{ publicToken: string }> }) {
  const { publicToken } = await params;
  if (publicToken.length < 40 || publicToken.length > 128) notFound();
  const order = await findPublicOrder(publicToken); if (!order) notFound();
  return <main className="min-h-screen bg-slate-100 p-4 sm:p-8"><div className="mx-auto max-w-2xl"><div className="mb-6 flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-[#142b48] font-bold text-white">IG</div><div><p className="font-bold">Intelly Gestor</p><p className="text-xs text-slate-500">Orden de pago segura</p></div></div><Card className="p-6 sm:p-8"><div className="flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row"><div><p className="font-mono text-xs text-slate-500">{order.number}</p><h1 className="mt-2 text-2xl font-bold">Orden de pago</h1><p className="mt-1 text-slate-600">Emitida para {order.clientName}</p></div><div className="grid size-12 place-items-center rounded-full bg-emerald-50 text-emerald-700"><CheckCircle2 /></div></div><div className="py-8 text-center"><p className="text-sm font-semibold text-slate-500">Total a pagar</p><p className="mt-2 text-4xl font-bold text-[#142b48]">{money.format(Number(order.total))}</p></div><div className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div className="flex gap-2"><Clock3 size={18} className="text-slate-500" /><span>Estado: <strong>{order.status}</strong></span></div><div className="flex gap-2"><ShieldCheck size={18} className="text-slate-500" /><span>Enlace privado y verificable</span></div></div><p className="mt-6 text-xs text-slate-500">Para coordinar el pago, usa las instrucciones entregadas directamente por el emisor. Intelly Gestor nunca solicitará tu contraseña en esta página.</p></Card></div></main>;
}
