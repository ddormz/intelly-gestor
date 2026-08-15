"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, ScrollText } from "lucide-react";
import { Badge, EmptyState, PageHeader, Pagination, TableShell, TableToolbar } from "@/components/ui";
import { getOperationLabel } from "@/lib/presentation";
import type { PageQuery } from "@/lib/list-query";

type AuditManagerProps = {
  events: Array<{
    id: string;
    createdAt: string;
    actorUserId: string | null;
    actorName: string | null;
    actorType: "user" | "system" | "public";
    action: string;
    entityType: string;
    entityId: string | null;
    correlationId: string;
    metadata: Record<string, unknown>;
  }>;
  query: PageQuery;
  page: number;
  pageSize: number;
  total: number;
};

export function AuditManager({ events, query, page, pageSize, total }: AuditManagerProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return <div className="space-y-6">
    <PageHeader
      title="Logs del Sistema y Auditoría"
      description="Registro inmutable de acciones de usuarios, autenticación, integraciones y eventos del sistema con metadatos protegidos."
    />

    <TableToolbar
      query={query}
      filters={[
        {
          name: "status",
          label: "Entidad",
          options: [
            { value: "", label: "Todas" },
            { value: "payment_order", label: "Órdenes de Pago" },
            { value: "invoice", label: "Facturas" },
            { value: "client", label: "Clientes" },
            { value: "catalog_item", label: "Catálogo" },
            { value: "auth", label: "Autenticación" },
            { value: "company", label: "Empresa" },
            { value: "integration", label: "Integraciones" },
          ],
        },
      ]}
    />

    <section className="min-w-0 space-y-4">
      <div className="flex items-center gap-2 text-[var(--brand-royal)]">
        <ScrollText size={20} />
        <h2 className="text-lg font-bold text-[var(--brand-deep)]">Registro cronológico de actividad</h2>
      </div>

      {events.length ? (
        <TableShell>
          <thead>
            <tr>
              <th className="w-10"></th>
              <th>Fecha y Hora</th>
              <th>Actor</th>
              <th>Acción</th>
              <th>Entidad</th>
              <th>Correlación</th>
            </tr>
          </thead>
          <tbody>
            {events.map((event) => {
              const isExpanded = expandedId === event.id;
              const hasMetadata = event.metadata && Object.keys(event.metadata).length > 0;
              return (
                <>
                  <tr key={event.id} className={isExpanded ? "bg-[var(--color-background-soft)]" : ""}>
                    <td>
                      {hasMetadata ? (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : event.id)}
                          className="grid size-6 place-items-center rounded hover:bg-[var(--color-muted)] text-[var(--color-muted-foreground)]"
                          title={isExpanded ? "Ocultar detalles" : "Ver detalles"}
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      ) : null}
                    </td>
                    <td className="text-xs font-mono">{new Date(event.createdAt).toLocaleString("es-CL")}</td>
                    <td>
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block size-2 rounded-full ${event.actorType === "user" ? "bg-[var(--brand-royal)]" : event.actorType === "public" ? "bg-[var(--brand-cyan)]" : "bg-gray-400"}`} />
                        <span className="font-semibold text-xs">{event.actorName || event.actorType}</span>
                      </div>
                    </td>
                    <td>
                      <Badge status="draft">{getOperationLabel(event.action)}</Badge>
                    </td>
                    <td className="text-xs font-medium text-[var(--color-muted-foreground)]">
                      {event.entityType} {event.entityId ? `(#${event.entityId.slice(0, 8)})` : ""}
                    </td>
                    <td className="font-mono text-[11px] text-[var(--color-muted-foreground)]">{event.correlationId.slice(0, 16)}…</td>
                  </tr>
                  {isExpanded && hasMetadata ? (
                    <tr key={`${event.id}-detail`} className="bg-[var(--color-background-soft)]">
                      <td colSpan={6} className="p-4">
                        <div className="rounded-xl border border-[var(--color-border)] bg-white p-3 shadow-xs">
                          <p className="text-xs font-bold text-[var(--brand-deep)] mb-1.5">Metadatos sanitizados:</p>
                          <pre className="overflow-x-auto text-[11px] font-mono text-[var(--brand-navy)] bg-[var(--color-background)] p-3 rounded-lg">
                            {JSON.stringify(event.metadata, null, 2)}
                          </pre>
                        </div>
                      </td>
                    </tr>
                  ) : null}
                </>
              );
            })}
          </tbody>
        </TableShell>
      ) : (
        <EmptyState title="Sin registros de auditoría" copy="Las acciones de los usuarios y procesos aparecerán aquí automáticamente." />
      )}
    </section>

    <Pagination page={page} pageSize={pageSize} total={total} query={query} />
  </div>;
}
