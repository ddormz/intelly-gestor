"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { Search, Trash2, UserRoundPlus } from "lucide-react";
import { Alert, Badge, EmptyState, Field, IconButton, Input, PageHeader, TableShell } from "@/components/ui";
import { searchActiveCatalogAction, searchActiveClientsAction } from "@/features/orders/actions";
import { calculateOrder } from "@/features/orders/domain";
import { buildOrderCartPayload, type PosDraftLine } from "@/features/orders/pos";
import { formatClpAmount, clp } from "@/lib/money";
import { getStatusLabel } from "@/lib/presentation";
import type { ActionState } from "@/lib/action-state";

type ClientResult = { id: string; legalName: string; taxId: string | null; email: string };
type CatalogResult = { id: string; code: string; name: string; type: "product" | "service" | "project"; unitPrice: string; taxCategory: "taxable" | "exempt"; taxRate: string };
type PosLine = PosDraftLine & { code: string; taxRate: number; taxCategory: "taxable" | "exempt" };

export type OrderPosInitial = {
  id?: string;
  number?: string;
  status?: "draft" | "issued" | "paid" | "expired" | "cancelled" | "invoiced";
  version?: number;
  clientId?: string;
  clientName?: string;
  clientTaxId?: string | null;
  clientEmail?: string;
  discountPercent?: number;
  discountReason?: string | null;
  dueAt?: string | null;
  notes?: string | null;
  lines?: Array<{ catalogItemId: string | null; code: string | null; description: string; quantity: number; unitPrice: number; taxRate: number }>;
};

const initialState: ActionState = { status: "idle" };

function typeLabel(type: CatalogResult["type"]): string {
  return type === "project" ? "Proyecto" : type === "service" ? "Servicio" : "Producto";
}

export function OrderPos({ action, initial }: { action: (state: ActionState, formData: FormData) => Promise<ActionState>; initial?: OrderPosInitial }) {
  const [client, setClient] = useState<ClientResult | null>(initial?.clientId ? { id: initial.clientId, legalName: initial.clientName ?? "Cliente", taxId: initial.clientTaxId ?? null, email: initial.clientEmail ?? "" } : null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<ClientResult[]>([]);
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogResult[]>([]);
  const [lines, setLines] = useState<PosLine[]>(() => (initial?.lines ?? []).filter((line): line is NonNullable<typeof line> & { catalogItemId: string } => Boolean(line.catalogItemId)).map((line) => ({
    catalogItemId: line.catalogItemId,
    code: line.code ?? "",
    name: line.description,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    taxRate: line.taxRate,
    taxCategory: line.taxRate > 0 ? "taxable" : "exempt",
  })));
  const [discountPercent, setDiscountPercent] = useState(initial?.discountPercent ?? 0);
  const [discountReason, setDiscountReason] = useState(initial?.discountReason ?? "");
  const [dueAt, setDueAt] = useState(initial?.dueAt ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [state, formAction, pending] = useActionState(action, initialState);
  const editable = !initial?.status || initial.status === "draft" || initial.status === "issued";
  const discountNeedsReason = discountPercent > 0 && !discountReason.trim();
  const settledStatus = initial?.status ? getStatusLabel(initial.status) : "";

  useEffect(() => {
    if (clientQuery.trim().length < 2) {
      setClientResults([]);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      void searchActiveClientsAction(clientQuery).then((result) => { if (current) setClientResults(result); }).catch(() => { if (current) setClientResults([]); });
    }, 180);
    return () => { current = false; window.clearTimeout(timer); };
  }, [clientQuery]);

  useEffect(() => {
    if (catalogQuery.trim().length < 2) {
      setCatalogResults([]);
      return;
    }
    let current = true;
    const timer = window.setTimeout(() => {
      void searchActiveCatalogAction(catalogQuery).then((result) => { if (current) setCatalogResults(result); }).catch(() => { if (current) setCatalogResults([]); });
    }, 180);
    return () => { current = false; window.clearTimeout(timer); };
  }, [catalogQuery]);

  const calculated = lines.length ? calculateOrder(lines.map((line) => ({ description: line.name ?? line.code, quantity: line.quantity, unitPrice: clp(line.unitPrice), taxRate: line.taxRate, taxCategory: line.taxCategory })), discountPercent, discountReason || "Descuento") : null;
  const draft = buildOrderCartPayload({ clientId: client?.id ?? "", lines, discountPercent, discountReason, dueAt, notes, expectedVersion: initial?.version });

  function addCatalog(item: CatalogResult) {
    setLines((current) => {
      const found = current.find((line) => line.catalogItemId === item.id);
      if (found) return current.map((line) => line.catalogItemId === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { catalogItemId: item.id, code: item.code, name: item.name, quantity: 1, unitPrice: Math.round(Number(item.unitPrice)), taxRate: Number(item.taxRate), taxCategory: item.taxCategory }];
    });
    setCatalogQuery("");
    setCatalogResults([]);
  }

  function removeLine(catalogItemId: string) {
    setLines((current) => current.filter((line) => line.catalogItemId !== catalogItemId));
  }

  return <div className="space-y-6">
    <PageHeader eyebrow={initial?.id ? initial.number : undefined} title={initial?.id ? "Editar orden de pago" : "Nueva orden de pago"} description="Busca el cliente, arma el carrito y deja que el servidor recalcule los totales antes de guardar." action={<Link className="btn-secondary" href="/ordenes">Volver a órdenes</Link>} />
    {!editable ? <Alert tone="info">La orden está {settledStatus} y no permite cambios financieros.</Alert> : null}
    {state.status === "error" ? <Alert>{state.message}</Alert> : null}
    {state.status === "success" ? <Alert tone="success">{state.message}</Alert> : null}
    {state.data?.publicLink ? <Alert tone="success">Enlace público reemplazado: <Link className="font-semibold underline" href={state.data.publicLink}>{state.data.publicLink}</Link></Alert> : null}
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-6">
        <section className="surface rounded-[var(--radius-lg)] p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-[var(--brand-deep)]">1. Cliente</h2>{editable ? <Link className="text-sm font-semibold text-[var(--brand-royal)] hover:underline" href={`/clientes?returnTo=${encodeURIComponent(initial?.id ? `/ordenes/${initial.id}/editar` : "/ordenes/nueva")}`}><UserRoundPlus aria-hidden="true" className="mr-1 inline" size={16} />Crear cliente</Link> : null}</div>
          <Field label="Buscar por RUT o nombre"><div className="relative"><Input disabled={!editable} value={clientQuery} onChange={(event) => setClientQuery(event.target.value)} placeholder="76.123.456-0 o nombre del cliente" aria-label="Buscar cliente" />{clientResults.length ? <ul className="absolute inset-x-0 top-full z-10 mt-1 rounded-md border border-[var(--color-border-strong)] bg-white p-1 shadow-lg">{clientResults.map((result) => <li key={result.id}><button disabled={!editable} type="button" className="w-full rounded px-3 py-2 text-left text-sm hover:bg-[var(--color-background-soft)]" onClick={() => { setClient(result); setClientQuery(""); setClientResults([]); }}>{result.legalName} · {result.taxId ?? "Sin RUT"}</button></li>)}</ul> : null}</div></Field>
          {client ? <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-[var(--color-border)] bg-[var(--color-background-soft)] p-3"><div><p className="font-semibold text-[var(--brand-deep)]">{client.legalName}</p><p className="text-sm text-[var(--color-muted-foreground)]">{client.taxId ?? "Sin RUT"} · {client.email}</p></div><IconButton disabled={!editable} type="button" label="Quitar cliente" icon={<Trash2 size={16} />} variant="danger" onClick={() => setClient(null)} /></div> : <p className="mt-3 text-sm text-[var(--color-muted-foreground)]">Selecciona un cliente activo para continuar.</p>}
        </section>
        <section className="surface rounded-[var(--radius-lg)] p-5 sm:p-6">
          <h2 className="mb-4 text-lg font-bold text-[var(--brand-deep)]">2. Conceptos</h2>
          <Field label="Buscar producto, servicio o proyecto"><div className="relative"><div className="flex gap-2"><Input disabled={!editable} value={catalogQuery} onChange={(event) => setCatalogQuery(event.target.value)} placeholder="Código o nombre" aria-label="Buscar concepto" /><IconButton disabled={!editable} type="button" label="Buscar conceptos" icon={<Search size={18} />} onClick={() => setCatalogQuery(catalogQuery.trim())} /></div>{catalogResults.length ? <ul className="absolute inset-x-0 top-full z-10 mt-1 rounded-md border border-[var(--color-border-strong)] bg-white p-1 shadow-lg">{catalogResults.map((item) => <li key={item.id}><button disabled={!editable} type="button" className="flex w-full items-center justify-between gap-3 rounded px-3 py-2 text-left text-sm hover:bg-[var(--color-background-soft)]" onClick={() => addCatalog(item)}><span><strong>{item.name}</strong><span className="ml-2 text-[var(--color-muted-foreground)]">{item.code} · {typeLabel(item.type)}</span></span><span className="font-semibold">{formatClpAmount(Number(item.unitPrice))}</span></button></li>)}</ul> : null}</div></Field>
          {lines.length ? <div className="mt-5"><TableShell mobileCards><thead><tr><th>Concepto</th><th className="w-28">Cantidad</th><th className="w-36">Precio unitario</th><th className="text-right">Total</th><th /></tr></thead><tbody>{lines.map((line) => { const lineTotal = Math.round(line.quantity * line.unitPrice); return <tr key={line.catalogItemId}><td data-label="Concepto"><strong>{line.name}</strong><span className="block text-xs text-[var(--color-muted-foreground)]">{line.code}</span></td><td data-label="Cantidad"><Input disabled={!editable} aria-label={`Cantidad de ${line.name}`} type="number" min="1" max="999" value={line.quantity} onChange={(event) => setLines((current) => current.map((item) => item.catalogItemId === line.catalogItemId ? { ...item, quantity: Math.max(1, Number(event.target.value) || 1) } : item))} /></td><td data-label="Precio unitario"><Input disabled={!editable} aria-label={`Precio de ${line.name}`} type="number" min="0" value={line.unitPrice} onChange={(event) => setLines((current) => current.map((item) => item.catalogItemId === line.catalogItemId ? { ...item, unitPrice: Math.max(0, Number(event.target.value) || 0) } : item))} /></td><td data-label="Total" className="text-right font-semibold">{formatClpAmount(lineTotal)}</td><td data-label="Quitar"><IconButton disabled={!editable} type="button" label={`Quitar ${line.name}`} icon={<Trash2 size={16} />} variant="danger" onClick={() => removeLine(line.catalogItemId)} /></td></tr>; })}</tbody></TableShell></div> : <EmptyState title="Carrito vacío" copy="Busca un concepto activo para agregar la primera línea." />}
        </section>
        <section className="surface rounded-[var(--radius-lg)] p-5 sm:p-6"><h2 className="mb-4 text-lg font-bold text-[var(--brand-deep)]">3. Condiciones</h2><div className="grid gap-4 sm:grid-cols-2"><Field label="Descuento (%)"><Input disabled={!editable} type="number" min="0" max="100" step="0.01" value={discountPercent} onChange={(event) => setDiscountPercent(Math.min(100, Math.max(0, Number(event.target.value) || 0)))} /></Field><Field label="Glosa del descuento" error={discountNeedsReason ? "Indica el motivo del descuento." : undefined}><Input disabled={!editable} aria-invalid={discountNeedsReason} value={discountReason} onChange={(event) => setDiscountReason(event.target.value)} placeholder="Descuento por volumen" /></Field><Field label="Vencimiento"><Input disabled={!editable} type="date" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></Field><Field label="Notas"><Input disabled={!editable} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observaciones para el cliente" /></Field></div></section>
      </div>
      <aside className="surface h-fit rounded-[var(--radius-lg)] p-5 sm:p-6"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Resumen</h2>{calculated ? <dl className="grid gap-3 text-sm"><div className="flex justify-between gap-4"><dt>Subtotal neto</dt><dd className="font-semibold">{formatClpAmount(Number(calculated.subtotal.minor))}</dd></div><div className="flex justify-between gap-4"><dt>Descuento</dt><dd className="font-semibold text-[var(--color-destructive)]">-{formatClpAmount(Number(calculated.discount.minor))}</dd></div><div className="flex justify-between gap-4"><dt>Base afecta</dt><dd className="font-semibold">{formatClpAmount(Number(calculated.taxableBase.minor))}</dd></div><div className="flex justify-between gap-4"><dt>Base exenta</dt><dd className="font-semibold">{formatClpAmount(Number(calculated.exemptBase.minor))}</dd></div><div className="flex justify-between gap-4"><dt>IVA</dt><dd className="font-semibold">{formatClpAmount(Number(calculated.tax.minor))}</dd></div><div className="mt-2 flex justify-between gap-4 border-t border-[var(--color-border)] pt-3 text-base"><dt className="font-bold">Total</dt><dd className="font-bold text-[var(--brand-royal)]">{formatClpAmount(Number(calculated.total.minor))}</dd></div></dl> : <p className="text-sm text-[var(--color-muted-foreground)]">Agrega líneas para ver el total.</p>}<form action={formAction} className="mt-6"><input type="hidden" name="clientId" value={draft.clientId} /><input type="hidden" name="cart" value={JSON.stringify(draft.lines)} /><input type="hidden" name="discountPercent" value={String(draft.discountPercent)} /><input type="hidden" name="discountReason" value={draft.discountReason} /><input type="hidden" name="dueAt" value={draft.dueAt ?? ""} /><input type="hidden" name="notes" value={draft.notes ?? ""} />{initial?.id ? <><input type="hidden" name="id" value={initial.id} /><input type="hidden" name="expectedVersion" value={String(initial.version ?? 1)} /></> : null}<button className="btn-primary w-full" type="submit" disabled={pending || !editable || discountNeedsReason || !draft.clientId || !draft.lines.length}>{pending ? "Guardando…" : initial?.id ? "Guardar cambios" : "Guardar borrador"}</button></form>{state.status === "error" && state.fieldErrors?.discountReason?.[0] ? <p className="mt-2 text-sm text-[var(--color-destructive)]">{state.fieldErrors.discountReason[0]}</p> : null}<div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--color-muted-foreground)]"><Badge status="draft">Cálculo preliminar</Badge><span>El servidor valida y recalcula al guardar.</span></div></aside>
    </div>
  </div>;
}
