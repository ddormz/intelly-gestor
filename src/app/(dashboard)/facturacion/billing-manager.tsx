"use client";

import { useState } from "react";
import {
  Download,
  FileCheck,
  FileDown,
  FileMinus,
  FileText,
  Mail,
  PlusCircle,
  Receipt,
  ReceiptText,
  RefreshCw,
  Upload,
} from "lucide-react";
import {
  ActionModal,
  Badge,
  Card,
  EmptyState,
  Field,
  IconButton,
  Input,
  PageHeader,
  Pagination,
  TableShell,
  TableToolbar,
} from "@/components/ui";
import {
  importHistoricalInvoicesAction,
  issueInvoiceAction,
  refreshInvoiceStatusAction,
  requestFoliosAction,
  sendInvoiceEmailAction,
} from "@/features/billing/actions";
import { formatClpAmount } from "@/lib/money";
import { getStatusLabel } from "@/lib/presentation";
import type { PageQuery } from "@/lib/list-query";
import type { FolioStatusItem } from "@/features/integrations/intellydte-contract";

type InvoiceItem = {
  id: string;
  orderNumber: string;
  clientName: string;
  clientEmail: string;
  total: string;
  status: string;
  folio: string | null;
  siiStatus: string | null;
  siiGlosa: string | null;
  hasPdf: boolean;
  hasXml: boolean;
};

type ReadyOrder = {
  id: string;
  number: string;
  clientName: string;
  total: string;
};

function EmailRecipientFields({
  registeredEmail,
  errors,
}: {
  registeredEmail: string;
  errors?: Record<string, string[]>;
}) {
  const [option, setOption] = useState<"registered" | "custom">("registered");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <label className="text-xs font-bold uppercase tracking-wider text-[var(--color-muted-foreground)]">
          Destinatario del correo
        </label>
        <div className="grid gap-2">
          <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-background-soft)]">
            <input
              type="radio"
              name="emailOption"
              value="registered"
              checked={option === "registered"}
              onChange={() => setOption("registered")}
              className="accent-[var(--brand-royal)]"
            />
            <div className="text-sm">
              <span className="font-semibold text-[var(--brand-deep)]">Correo registrado</span>
              <p className="text-xs text-[var(--color-muted-foreground)]">{registeredEmail}</p>
            </div>
          </label>

          <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--color-border)] cursor-pointer hover:bg-[var(--color-background-soft)]">
            <input
              type="radio"
              name="emailOption"
              value="custom"
              checked={option === "custom"}
              onChange={() => setOption("custom")}
              className="accent-[var(--brand-royal)]"
            />
            <div className="text-sm">
              <span className="font-semibold text-[var(--brand-deep)]">Otro correo</span>
              <p className="text-xs text-[var(--color-muted-foreground)]">Especificar una dirección diferente</p>
            </div>
          </label>
        </div>
      </div>

      {option === "custom" && (
        <Field label="Correo electrónico de destino" error={errors?.customEmail?.[0]}>
          <Input
            required
            type="email"
            name="customEmail"
            placeholder="ejemplo@empresa.cl"
            autoFocus
          />
        </Field>
      )}
    </div>
  );
}

function RequestFoliosFields({
  defaultTipoDte = 33,
  errors,
}: {
  defaultTipoDte?: number;
  errors?: Record<string, string[]>;
}) {
  return (
    <div className="space-y-4">
      <Field label="Tipo de Documento Tributario (DTE)" error={errors?.tipoDte?.[0]}>
        <select name="tipoDte" defaultValue={defaultTipoDte} className="field">
          <option value="33">Factura Electrónica (DTE 33)</option>
          <option value="39">Boleta Electrónica (DTE 39)</option>
          <option value="61">Nota de Crédito Electrónica (DTE 61)</option>
        </select>
      </Field>
      <Field
        label="Cantidad de folios a solicitar al SII"
        error={errors?.cantidad?.[0]}
        hint="IntellyDTE se autenticará con el SII para descargar un nuevo Código de Autorización de Folios (CAF)."
      >
        <Input
          required
          type="number"
          name="cantidad"
          min={1}
          max={10000}
          defaultValue={50}
          placeholder="Ej: 50"
        />
      </Field>
    </div>
  );
}

export function BillingManager({
  items,
  ready,
  canImport,
  query,
  page,
  pageSize,
  total,
  folios = [],
}: {
  items: InvoiceItem[];
  ready: ReadyOrder[];
  canImport: boolean;
  query: PageQuery;
  page: number;
  pageSize: number;
  total: number;
  folios?: FolioStatusItem[];
}) {
  const actions = (
    <>
      <ActionModal
        triggerLabel="Solicitar folios al SII"
        triggerIcon={<PlusCircle size={18} />}
        variant="primary"
        title="Solicitud de Folios y CAF"
        description="Solicita una nueva autorización de folios al Servicio de Impuestos Internos a través de IntellyDTE."
        submitLabel="Solicitar folios"
        pendingLabel="Descargando CAF del SII…"
        action={requestFoliosAction}
      >
        {(state) => <RequestFoliosFields errors={state.fieldErrors} />}
      </ActionModal>
      {canImport ? (
        <ActionModal
          iconOnly
          triggerLabel="Importar facturas históricas"
          triggerIcon={<Upload size={18} />}
          variant="secondary"
          title="Importar facturas históricas"
          description="Sólo acepta documentos emitidos vinculados a órdenes pagadas."
          submitLabel="Importar facturas"
          action={importHistoricalInvoicesAction}
        >
          {() => (
            <Field label="Archivo CSV" hint="Folio e ID externo son obligatorios.">
              <Input required name="file" type="file" accept=".csv,text/csv" />
            </Field>
          )}
        </ActionModal>
      ) : null}
      <IconButton href="/api/export/facturacion" label="Exportar facturación" icon={<Download size={18} />} />
      <IconButton href="/api/export/facturacion?template=1" label="Descargar plantilla de facturación" icon={<FileDown size={18} />} />
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Facturación"
        description="Emite facturas electrónicas oficiales ante el SII, administra folios CAF y gestiona el envío de comprobantes fiscales."
        action={actions}
      />

      {/* Indicadores de Folios CAF (33, 39, 61) */}
      <section className="grid gap-4 sm:grid-cols-3">
        {folios.map((folio) => {
          const icon =
            folio.tipoDte === 33 ? (
              <FileCheck size={20} />
            ) : folio.tipoDte === 39 ? (
              <Receipt size={20} />
            ) : (
              <FileMinus size={20} />
            );

          const badgeStatus =
            folio.disponibles > 10 ? "paid" : folio.disponibles > 0 ? "pending" : "rejected";

          return (
            <Card key={folio.tipoDte} className="brand-card p-5 flex flex-col justify-between gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-[rgb(20_208_246_/_0.1)] text-[var(--brand-navy)]">
                    {icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-[var(--brand-deep)]">{folio.tipoNombre}</h3>
                    <p className="font-mono text-xs text-[var(--color-muted-foreground)]">DTE {folio.tipoDte}</p>
                  </div>
                </div>
                <Badge status={badgeStatus}>
                  {folio.disponibles > 0 ? `${folio.disponibles} disp.` : "Agotado"}
                </Badge>
              </div>

              <div className="text-xs text-[var(--color-muted-foreground)] border-t border-[var(--color-border)] pt-2 flex items-center justify-between">
                <span>
                  {folio.rangoDesde && folio.rangoHasta
                    ? `Rango: ${folio.rangoDesde} – ${folio.rangoHasta}`
                    : "Sin CAF activo"}
                </span>
                <ActionModal
                  triggerLabel="Solicitar"
                  triggerIcon={<PlusCircle size={13} className="mr-1 inline" />}
                  variant="secondary"
                  title={`Solicitar Folios: ${folio.tipoNombre}`}
                  description={`Descarga un nuevo archivo CAF para DTE ${folio.tipoDte} desde el SII.`}
                  submitLabel="Solicitar folios"
                  pendingLabel="Solicitando…"
                  action={requestFoliosAction}
                >
                  {(state) => (
                    <RequestFoliosFields defaultTipoDte={folio.tipoDte} errors={state.fieldErrors} />
                  )}
                </ActionModal>
              </div>
            </Card>
          );
        })}
      </section>

      {ready.length ? (
        <Card className="brand-card">
          <h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Listas para facturar</h2>
          <div className="grid gap-3">
            {ready.map((order) => (
              <div
                key={order.id}
                className="flex flex-col justify-between gap-4 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-background-soft)] p-4 sm:flex-row sm:items-center"
              >
                <div>
                  <p className="font-mono text-xs text-[var(--color-muted-foreground)]">{order.number}</p>
                  <p className="mt-1 font-semibold text-[var(--brand-deep)]">{order.clientName}</p>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                    {formatClpAmount(Number(order.total))}
                  </p>
                </div>
                <ActionModal
                  iconOnly
                  triggerLabel="Emitir factura"
                  triggerIcon={<ReceiptText size={16} />}
                  title="Emitir factura"
                  description="Se enviará la orden pagada a IntellyDTE."
                  submitLabel="Confirmar emisión"
                  pendingLabel="Emitiendo factura…"
                  action={issueInvoiceAction}
                >
                  {() => (
                    <>
                      <input type="hidden" name="orderId" value={order.id} />
                      <p className="text-sm text-[var(--color-muted-foreground)]">
                        Confirma la facturación de <strong>{order.number}</strong> por{" "}
                        <strong>{formatClpAmount(Number(order.total))}</strong>.
                      </p>
                    </>
                  )}
                </ActionModal>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      <TableToolbar
        query={query}
        tabs={[
          { value: "all", label: "Todas" },
          { value: "pending", label: "Pendientes" },
          { value: "processing", label: "Procesando" },
          { value: "issued", label: "Emitidas" },
          { value: "rejected", label: "Rechazadas" },
        ]}
      />

      <form method="get" className="flex flex-wrap items-end gap-3" aria-label="Filtros por fecha">
        <input type="hidden" name="q" value={typeof query.q === "string" ? query.q : ""} />
        <input type="hidden" name="status" value={typeof query.status === "string" ? query.status : ""} />
        <input type="hidden" name="tab" value={typeof query.tab === "string" ? query.tab : ""} />
        <label className="grid gap-1 text-sm font-semibold text-[var(--brand-deep)]">
          Desde
          <input
            className="field"
            type="date"
            name="from"
            defaultValue={typeof query.from === "string" ? query.from : ""}
          />
        </label>
        <label className="grid gap-1 text-sm font-semibold text-[var(--brand-deep)]">
          Hasta
          <input
            className="field"
            type="date"
            name="to"
            defaultValue={typeof query.to === "string" ? query.to : ""}
          />
        </label>
        <button className="btn-secondary" type="submit">
          Aplicar fechas
        </button>
      </form>

      <section className="min-w-0 space-y-4">
        <h2 className="text-lg font-bold text-[var(--brand-deep)]">Documentos</h2>
        {items.length ? (
          <TableShell mobileCards>
            <thead>
              <tr>
                <th>Orden</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th>Folio</th>
                <th className="text-right">Total</th>
                <th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Orden" className="font-mono text-xs">
                    {item.orderNumber}
                  </td>
                  <td data-label="Cliente" className="font-medium">
                    {item.clientName}
                  </td>
                  <td data-label="Estado">
                    <Badge status={item.status}>{getStatusLabel(item.status)}</Badge>
                    {item.siiGlosa ? (
                      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">{item.siiGlosa}</p>
                    ) : item.siiStatus ? (
                      <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">SII: {item.siiStatus}</p>
                    ) : null}
                  </td>
                  <td data-label="Folio">{item.folio ?? "—"}</td>
                  <td data-label="Total" className="text-right font-semibold">
                    {formatClpAmount(Number(item.total))}
                  </td>
                  <td data-label="Acciones">
                    <div className="flex flex-wrap justify-end gap-2">
                      {item.status !== "issued" || !item.hasPdf ? (
                        <ActionModal
                          iconOnly
                          triggerLabel="Actualizar estado fiscal"
                          triggerIcon={<RefreshCw size={17} />}
                          title="Actualizar estado fiscal"
                          description="Se consultará IntellyDTE sin volver a emitir la factura."
                          submitLabel="Consultar estado"
                          action={refreshInvoiceStatusAction}
                        >
                          {() => <input type="hidden" name="invoiceId" value={item.id} />}
                        </ActionModal>
                      ) : null}
                      {item.status === "issued" && item.hasPdf ? (
                        <>
                          <ActionModal
                            iconOnly
                            triggerLabel="Enviar factura por correo"
                            triggerIcon={<Mail size={17} />}
                            title={`Enviar Factura F${item.folio || ""} por Correo`}
                            description="Se enviará la factura con el PDF tributario y el XML firmado adjuntos."
                            submitLabel="Enviar factura"
                            pendingLabel="Enviando correo…"
                            action={sendInvoiceEmailAction}
                          >
                            {(state) => (
                              <>
                                <input type="hidden" name="invoiceId" value={item.id} />
                                <EmailRecipientFields
                                  registeredEmail={item.clientEmail}
                                  errors={state.fieldErrors}
                                />
                              </>
                            )}
                          </ActionModal>
                          <IconButton
                            href={`/api/invoices/${item.id}/pdf`}
                            label="Descargar PDF fiscal"
                            icon={<FileDown size={17} />}
                          />
                        </>
                      ) : null}
                      {item.status === "issued" && item.hasXml ? (
                        <IconButton
                          href={`/api/invoices/${item.id}/xml`}
                          label="Descargar XML firmado"
                          icon={<FileText size={17} />}
                        />
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState
            title="Aún no hay facturas"
            copy="Las órdenes pagadas aparecerán aquí listas para emitir."
          />
        )}
      </section>

      <Pagination page={page} pageSize={pageSize} total={total} query={query} />
    </div>
  );
}
