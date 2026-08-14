"use client";

import Link from "next/link";
import { Download, FileDown, ReceiptText, Upload } from "lucide-react";
import { ActionModal, Badge, Card, EmptyState, Field, Input, PageHeader, TableShell } from "@/components/ui";
import { importHistoricalInvoicesAction, issueInvoiceAction } from "@/features/billing/actions";
import { formatClpAmount } from "@/lib/money";
import { getStatusLabel } from "@/lib/presentation";

type InvoiceItem = { id: string; orderNumber: string; clientName: string; total: string; status: string; folio: string | null };
type ReadyOrder = { id: string; number: string; clientName: string; total: string };

export function BillingManager({ items, ready, canImport }: { items: InvoiceItem[]; ready: ReadyOrder[]; canImport: boolean }) {
  const actions = <>{canImport ? <ActionModal triggerLabel="Importar históricas" triggerIcon={<Upload size={18} />} variant="secondary" title="Importar facturas históricas" description="Sólo acepta documentos emitidos vinculados a órdenes pagadas." submitLabel="Importar facturas" action={importHistoricalInvoicesAction}>{() => <Field label="Archivo CSV" hint="Folio e ID externo son obligatorios."><Input required name="file" type="file" accept=".csv,text/csv" /></Field>}</ActionModal> : null}<Link href="/api/export/facturacion" className="btn-secondary"><Download size={18} />Exportar</Link><Link href="/api/export/facturacion?template=1" className="btn-secondary"><FileDown size={18} />Plantilla</Link></>;
  return <div className="space-y-6">
    <PageHeader title="Facturación" description="Emite una factura por orden pagada y revisa el resultado normalizado de IntellyDTE." action={actions} />
    {ready.length ? <Card className="brand-card"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Listas para facturar</h2><div className="grid gap-3">{ready.map((order) => <div key={order.id} className="flex flex-col justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background-soft)] p-4 sm:flex-row sm:items-center"><div><p className="font-mono text-xs text-[var(--color-muted-foreground)]">{order.number}</p><p className="mt-1 font-semibold text-[var(--brand-deep)]">{order.clientName}</p><p className="mt-1 text-sm text-[var(--color-muted-foreground)]">{formatClpAmount(Number(order.total))}</p></div><ActionModal triggerLabel="Emitir factura" triggerIcon={<ReceiptText size={16} />} title="Emitir factura" description="Se enviará la orden pagada a IntellyDTE." submitLabel="Confirmar emisión" pendingLabel="Emitiendo factura…" action={issueInvoiceAction}>{() => <><input type="hidden" name="orderId" value={order.id} /><p className="text-sm text-[var(--color-muted-foreground)]">Confirma la facturación de <strong>{order.number}</strong> por <strong>{formatClpAmount(Number(order.total))}</strong>.</p></>}</ActionModal></div>)}</div></Card> : null}
    <Card className="min-w-0"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Documentos</h2>{items.length ? <TableShell mobileCards><thead><tr><th>Orden</th><th>Cliente</th><th>Estado</th><th>Folio</th><th className="text-right">Total</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td data-label="Orden" className="font-mono text-xs">{item.orderNumber}</td><td data-label="Cliente" className="font-medium">{item.clientName}</td><td data-label="Estado"><Badge status={item.status}>{getStatusLabel(item.status)}</Badge></td><td data-label="Folio">{item.folio ?? "—"}</td><td data-label="Total" className="text-right font-semibold">{formatClpAmount(Number(item.total))}</td></tr>)}</tbody></TableShell> : <EmptyState title="Aún no hay facturas" copy="Las órdenes pagadas aparecerán aquí listas para emitir." />}</Card>
  </div>;
}
