"use client";

import { useState } from "react";
import Link from "next/link";
import { Banknote, Download, Edit, FileDown, Mail, Plus, Send, Upload } from "lucide-react";
import {
  ActionModal,
  Alert,
  Badge,
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
  importDraftOrdersAction,
  issueOrderAction,
  markPaidAction,
  sendOrderEmailAction,
} from "@/features/orders/actions";
import { formatClpAmount } from "@/lib/money";
import { getStatusLabel } from "@/lib/presentation";
import type { PageQuery } from "@/lib/list-query";

type OrderItem = {
  id: string;
  number: string;
  clientName: string;
  clientEmail: string;
  status: string;
  total: string;
};

export function orderCatalogTypeLabel(item: { type: "product" | "service" | "project" }): string {
  return item.type === "project" ? "Proyecto" : item.type === "service" ? "Servicio" : "Producto";
}

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

export function OrderManager({
  publicLink,
  orders,
  canCreate,
  canImport,
  query,
  page,
  pageSize,
  total,
}: {
  publicLink?: string;
  orders: OrderItem[];
  canCreate: boolean;
  canImport: boolean;
  query: PageQuery;
  page: number;
  pageSize: number;
  total: number;
}) {
  const [activeLink, setActiveLink] = useState(publicLink);
  const create = <IconButton href="/ordenes/nueva" label="Nueva orden" icon={<Plus size={18} />} variant="primary" />;
  const actions = (
    <>
      {create}
      {canImport ? (
        <ActionModal
          iconOnly
          triggerLabel="Importar borradores"
          triggerIcon={<Upload size={18} />}
          variant="secondary"
          title="Importar órdenes en borrador"
          description="Cada fila debe indicar un RUT activo, código activo y cantidad."
          submitLabel="Importar borradores"
          action={importDraftOrdersAction}
        >
          {() => (
            <Field label="Archivo CSV" hint="No sobrescribe órdenes existentes.">
              <Input required name="file" type="file" accept=".csv,text/csv" />
            </Field>
          )}
        </ActionModal>
      ) : null}
      <IconButton href="/api/export/ordenes" label="Exportar órdenes" icon={<Download size={18} />} />
      <IconButton href="/api/export/ordenes?template=1" label="Descargar plantilla de órdenes" icon={<FileDown size={18} />} />
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Órdenes de Pago"
        description="Crea solicitudes de cobro, emítelas y registra su pago con trazabilidad."
        action={actions}
      />
      {activeLink ? (
        <Alert tone="success">
          Orden emitida. Copia ahora su enlace seguro:{" "}
          <Link className="font-bold underline" href={activeLink}>
            {activeLink}
          </Link>
        </Alert>
      ) : null}
      {!canCreate && orders.length === 0 ? (
        <Alert tone="info">
          Para emitir tu primera orden puedes crear conceptos en el catálogo o agregar un nuevo cliente directamente desde la pantalla de la orden.
        </Alert>
      ) : null}
      <TableToolbar
        query={query}
        tabs={[
          { value: "all", label: "Todas" },
          { value: "draft", label: "Borradores" },
          { value: "issued", label: "Emitidas" },
          { value: "paid", label: "Pagadas" },
          { value: "invoiced", label: "Facturadas" },
          { value: "expired", label: "Vencidas" },
          { value: "cancelled", label: "Canceladas" },
        ]}
      />
      <section className="min-w-0 space-y-4">
        <h2 className="text-lg font-bold text-[var(--brand-deep)]">Órdenes recientes</h2>
        {orders.length ? (
          <TableShell mobileCards>
            <thead>
              <tr>
                <th>Número</th>
                <th>Cliente</th>
                <th>Estado</th>
                <th className="text-right">Total</th>
                <th className="text-right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id}>
                  <td data-label="Número" className="font-mono text-xs font-semibold">
                    {order.number}
                  </td>
                  <td data-label="Cliente" className="font-medium">
                    {order.clientName}
                  </td>
                  <td data-label="Estado">
                    <Badge status={order.status}>{getStatusLabel(order.status)}</Badge>
                  </td>
                  <td data-label="Total" className="text-right font-semibold">
                    {formatClpAmount(Number(order.total))}
                  </td>
                  <td data-label="Acción">
                    <div className="flex flex-wrap justify-end gap-2">
                      <IconButton
                        href={`/api/orders/${order.id}/pdf`}
                        label={`Descargar PDF de ${order.number}`}
                        icon={<Download size={15} />}
                      />
                      {order.status === "draft" || order.status === "issued" ? (
                        <IconButton
                          href={`/ordenes/${order.id}/editar`}
                          label={`Editar ${order.number}`}
                          icon={<Edit size={15} />}
                        />
                      ) : null}
                      {order.status === "draft" ? (
                        <ActionModal
                          iconOnly
                          triggerLabel="Emitir orden"
                          triggerIcon={<Send size={15} />}
                          variant="secondary"
                          title="Emitir orden"
                          description="Se generará un enlace público seguro para el cliente."
                          submitLabel="Emitir orden"
                          action={issueOrderAction}
                          onSuccess={(res) => {
                            if (typeof res.data?.publicLink === "string") setActiveLink(res.data.publicLink);
                          }}
                        >
                          {() => (
                            <>
                              <input type="hidden" name="id" value={order.id} />
                              <p className="text-sm text-[var(--color-muted-foreground)]">
                                Confirma la emisión de <strong>{order.number}</strong>.
                              </p>
                            </>
                          )}
                        </ActionModal>
                      ) : order.status === "issued" ? (
                        <ActionModal
                          iconOnly
                          triggerLabel="Registrar pago"
                          triggerIcon={<Banknote size={15} />}
                          title="Registrar pago"
                          description="Esta acción cambia el estado financiero de la orden."
                          submitLabel="Confirmar pago"
                          action={markPaidAction}
                        >
                          {() => (
                            <>
                              <input type="hidden" name="id" value={order.id} />
                              <input type="hidden" name="idempotencyKey" value={`payment:${order.id}`} />
                              <p className="text-sm text-[var(--color-muted-foreground)]">
                                Confirma el pago de <strong>{formatClpAmount(Number(order.total))}</strong>.
                              </p>
                            </>
                          )}
                        </ActionModal>
                      ) : null}
                      {order.status === "issued" || order.status === "paid" || order.status === "invoiced" ? (
                        <ActionModal
                          iconOnly
                          triggerLabel={`Enviar ${order.number} por correo`}
                          triggerIcon={<Mail size={15} />}
                          title={`Enviar ${order.number} por Correo`}
                          description="El mensaje incluye el enlace público seguro de pago y la orden comercial en PDF adjunta."
                          submitLabel="Enviar orden por correo"
                          pendingLabel="Enviando correo…"
                          action={sendOrderEmailAction}
                        >
                          {(state) => (
                            <>
                              <input type="hidden" name="id" value={order.id} />
                              <EmailRecipientFields
                                registeredEmail={order.clientEmail}
                                errors={state.fieldErrors}
                              />
                            </>
                          )}
                        </ActionModal>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState title="No hay órdenes" copy="Crea tu primera orden de pago desde el botón superior." />
        )}
      </section>
      <Pagination page={page} pageSize={pageSize} total={total} query={query} />
    </div>
  );
}
