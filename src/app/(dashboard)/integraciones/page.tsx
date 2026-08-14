import { desc } from "drizzle-orm";
import Link from "next/link";
import { Database, PlugZap, ShieldCheck, Users } from "lucide-react";
import { getDb, databaseHealth } from "@/db";
import { integrationAttempts } from "@/db/schema";
import { Badge, Card, EmptyState, PageHeader, TableShell } from "@/components/ui";
import { requireUser } from "@/features/auth/session";
import { getIntellyDteGateway } from "@/features/integrations/intellydte";
import { getStatusLabel } from "@/lib/presentation";

export default async function IntegrationsPage() {
  await requireUser("admin");
  const [dbOk, dte, attempts] = await Promise.all([databaseHealth(), getIntellyDteGateway().health(), getDb().select().from(integrationAttempts).orderBy(desc(integrationAttempts.createdAt)).limit(25)]);
  return <div className="space-y-6">
    <PageHeader title="Integraciones" description="Estado operativo y trazabilidad sin exponer credenciales ni cargas sensibles." action={<Link href="/integraciones/usuarios" className="btn-secondary"><Users size={18}/>Usuarios y sesiones</Link>} />
    <section className="grid gap-4 md:grid-cols-2">
      <Card className="brand-card"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[rgb(47_167_255_/_0.1)] text-[var(--brand-royal)]"><Database /></div><div><h2 className="font-bold text-[var(--brand-deep)]">MySQL</h2><p className="text-sm text-[var(--color-muted-foreground)]">Pool de persistencia</p></div></div><Badge status={dbOk ? "paid" : "rejected"}>{dbOk ? "Operativo" : "No disponible"}</Badge></div></Card>
      <Card className="brand-card"><div className="flex items-center justify-between gap-4"><div className="flex items-center gap-3"><div className="grid size-11 place-items-center rounded-xl bg-[rgb(20_208_246_/_0.1)] text-[var(--brand-navy)]"><PlugZap /></div><div><h2 className="font-bold text-[var(--brand-deep)]">IntellyDTE</h2><p className="text-sm text-[var(--color-muted-foreground)]">{dte.safeMessage}</p></div></div><Badge status={dte.ok ? "paid" : "pending"}>{dte.ok ? "Operativo" : "Pendiente"}</Badge></div></Card>
    </section>
    <Card className="min-w-0"><div className="mb-5 flex items-center gap-2 text-[var(--brand-royal)]"><ShieldCheck size={20} /><h2 className="text-lg font-bold text-[var(--brand-deep)]">Actividad de integración</h2></div>{attempts.length ? <TableShell><thead><tr><th>Fecha</th><th>Operación</th><th>Estado</th><th>Correlación</th><th>Mensaje seguro</th></tr></thead><tbody>{attempts.map((attempt) => <tr key={attempt.id}><td>{attempt.createdAt.toLocaleString("es-CL")}</td><td>{attempt.operation}</td><td><Badge status={attempt.status}>{getStatusLabel(attempt.status)}</Badge></td><td className="font-mono text-xs">{attempt.correlationId}</td><td>{attempt.safeMessage ?? "—"}</td></tr>)}</tbody></TableShell> : <EmptyState title="Sin actividad externa" copy="Los intentos de emisión aparecerán aquí con información redactada." />}</Card>
  </div>;
}
