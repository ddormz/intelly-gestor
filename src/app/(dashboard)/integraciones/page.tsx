import { desc } from "drizzle-orm";
import Link from "next/link";
import { Database, PlugZap, ShieldCheck, Users } from "lucide-react";
import { getDb, databaseHealth } from "@/db";
import { integrationAttempts } from "@/db/schema";
import { Badge, Card, EmptyState } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { getIntellyDteGateway } from "@/features/integrations/intellydte";

export default async function IntegrationsPage() {
  await requireUser("admin");
  const [dbOk, dte, attempts] = await Promise.all([databaseHealth(), getIntellyDteGateway().health(), getDb().select().from(integrationAttempts).orderBy(desc(integrationAttempts.createdAt)).limit(25)]);
  return <div className="space-y-6"><header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><h1 className="page-title">Integraciones</h1><p className="page-copy mt-1">Estado operativo y trazabilidad sin exponer credenciales ni cargas sensibles.</p></div><Link href="/integraciones/usuarios" className="btn-secondary"><Users size={18}/>Usuarios y sesiones</Link></header>
    <section className="grid gap-4 md:grid-cols-2"><Card><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-blue-50 text-blue-700"><Database /></div><div><h2 className="font-bold">MySQL</h2><p className="text-sm text-slate-500">Pool de persistencia</p></div></div><Badge status={dbOk ? "paid" : "rejected"}>{dbOk ? "Operativo" : "No disponible"}</Badge></div></Card><Card><div className="flex items-center justify-between"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-emerald-50 text-emerald-700"><PlugZap /></div><div><h2 className="font-bold">IntellyDTE</h2><p className="text-sm text-slate-500">{dte.safeMessage}</p></div></div><Badge status={dte.ok ? "paid" : "pending"}>{dte.ok ? "Operativo" : "Pendiente"}</Badge></div></Card></section>
    <Card><div className="mb-4 flex items-center gap-2"><ShieldCheck size={20} className="text-emerald-700" /><h2 className="text-lg font-bold">Actividad de integración</h2></div>{attempts.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="pb-3">Fecha</th><th className="pb-3">Operación</th><th className="pb-3">Estado</th><th className="pb-3">Correlación</th><th className="pb-3">Mensaje seguro</th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.id} className="border-b border-slate-100"><td className="py-3">{attempt.createdAt.toLocaleString("es-CL")}</td><td>{attempt.operation}</td><td><Badge status={attempt.status}>{attempt.status}</Badge></td><td className="font-mono text-xs">{attempt.correlationId}</td><td>{attempt.safeMessage ?? "—"}</td></tr>)}</tbody></table></div> : <EmptyState title="Sin actividad externa" copy="Los intentos de emisión aparecerán aquí con información redactada." />}</Card>
  </div>;
}
