"use client";

import { CreditCard, Database, Download, KeyRound, Mail, PlugZap, ShieldCheck, TestTube2 } from "lucide-react";
import { ActionModal, Badge, Card, EmptyState, Field, IconButton, Input, PageHeader, Pagination, TableShell, TableToolbar } from "@/components/ui";
import {
  saveIntellyDteConfigAction,
  saveWebpayConfigAction,
  testDatabaseAction,
  testIntellyDteConfigAction,
  testSmtpConfigAction,
  testWebpayConfigAction,
} from "@/features/integrations/actions";
import { getOperationLabel, getStatusLabel } from "@/lib/presentation";
import type { PageQuery } from "@/lib/list-query";

type Attempt = { id: string; createdAt: string; operation: string; status: string; correlationId: string; safeMessage: string | null };

export function IntegrationManager({
  dbOk,
  dte,
  config,
  attempts,
  query,
  page,
  pageSize,
  total,
}: {
  dbOk: boolean;
  dte: { ok: boolean; safeMessage: string };
  config: { baseUrl: string; configured: boolean; apiKeyMask: string; updatedAt: string | null };
  attempts: Attempt[];
  query: PageQuery;
  page: number;
  pageSize: number;
  total: number;
}) {
  const actions = (
    <>
      <ActionModal
        iconOnly
        triggerLabel="Configurar IntellyDTE"
        triggerIcon={<KeyRound size={18} />}
        title="Configurar IntellyDTE"
        description="Las credenciales y el secreto webhook se cifran antes de guardarse."
        submitLabel="Guardar configuración"
        action={saveIntellyDteConfigAction}
      >
        {(state) => (
          <>
            <Field label="Base URL" error={state.fieldErrors?.baseUrl?.[0]}>
              <Input required type="url" name="baseUrl" defaultValue={config.baseUrl} placeholder="https://api.intellydte.cl" />
            </Field>
            <Field label="API Key del tenant" error={state.fieldErrors?.tenantApiKey?.[0]} hint={config.configured ? `Configurada como ${config.apiKeyMask}. Déjala vacía para conservarla.` : "Prefijo esperado: ik_."}>
              <Input name="tenantApiKey" type="password" autoComplete="off" placeholder="ik_..." />
            </Field>
            <Field label="API Key del sistema" error={state.fieldErrors?.systemApiKey?.[0]} hint="Necesaria para consultar estados. Prefijo esperado: isk_.">
              <Input name="systemApiKey" type="password" autoComplete="off" placeholder="isk_..." />
            </Field>
            <Field label="RUT del tenant" error={state.fieldErrors?.tenantRut?.[0]}>
              <Input name="tenantRut" placeholder="76.123.456-7" />
            </Field>
            <Field label="Secreto webhook" hint="Opcional. Déjalo vacío para conservarlo.">
              <Input name="webhookSecret" type="password" autoComplete="off" placeholder="Secreto X-Intelly-Signature" />
            </Field>
          </>
        )}
      </ActionModal>
      <IconButton href="/api/export/integraciones" label="Exportar historial de integraciones" icon={<Download size={18} />} />
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Integraciones"
        description="Gestiona conexiones con IntellyDTE, Transbank WebPay, correo SMTP y base de datos con pruebas de conectividad en tiempo real."
        action={actions}
      />

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* MySQL */}
        <Card className="brand-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[rgb(47_167_255_/_0.1)] text-[var(--brand-royal)]">
                <Database size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[var(--brand-deep)]">MySQL DB</h3>
                <p className="text-xs text-[var(--color-muted-foreground)]">Persistencia</p>
              </div>
            </div>
            <Badge status={dbOk ? "paid" : "rejected"}>{dbOk ? "Operativo" : "Error"}</Badge>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
            <ActionModal
              triggerLabel="Probar conexión"
              triggerIcon={<TestTube2 size={14} className="mr-1 inline" />}
              variant="secondary"
              title="Test de Conexión a Base de Datos"
              description="Verifica la conectividad y latencia del pool MySQL."
              submitLabel="Ejecutar prueba"
              action={testDatabaseAction}
            >
              {() => <p className="text-sm text-[var(--color-muted-foreground)]">Se enviará una consulta ping al pool de conexiones MySQL.</p>}
            </ActionModal>
          </div>
        </Card>

        {/* IntellyDTE */}
        <Card className="brand-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[rgb(20_208_246_/_0.1)] text-[var(--brand-navy)]">
                <PlugZap size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[var(--brand-deep)]">IntellyDTE</h3>
                <p className="text-xs text-[var(--color-muted-foreground)] truncate max-w-[120px]" title={dte.safeMessage}>{dte.safeMessage}</p>
              </div>
            </div>
            <Badge status={dte.ok ? "paid" : "pending"}>{dte.ok ? "Operativo" : config.configured ? "Revisar" : "Sin config"}</Badge>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
            <ActionModal
              triggerLabel="Probar DTE"
              triggerIcon={<TestTube2 size={14} className="mr-1 inline" />}
              variant="secondary"
              title="Test de Conexión a IntellyDTE"
              description="Verifica la API Key y conexión con el backend de facturación electrónica."
              submitLabel="Iniciar prueba"
              action={testIntellyDteConfigAction}
            >
              {() => <p className="text-sm text-[var(--color-muted-foreground)]">La prueba verifica el endpoint de salud de IntellyDTE sin emitir DTEs.</p>}
            </ActionModal>
          </div>
        </Card>

        {/* Transbank WebPay Plus */}
        <Card className="brand-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[rgb(230_0_0_/_0.08)] text-[#e60000]">
                <CreditCard size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[var(--brand-deep)]">WebPay Plus</h3>
                <p className="text-xs text-[var(--color-muted-foreground)]">Transbank REST</p>
              </div>
            </div>
            <Badge status="paid">Activo</Badge>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--color-border)] pt-3">
            <ActionModal
              triggerLabel="Configurar"
              triggerIcon={<KeyRound size={14} className="mr-1 inline" />}
              variant="secondary"
              title="Configurar Transbank WebPay Plus"
              description="Ingresa tu Código de Comercio y API Key proporcionados por Transbank."
              submitLabel="Guardar credenciales"
              action={saveWebpayConfigAction}
            >
              {(state) => (
                <>
                  <Field label="Código de Comercio" error={state.fieldErrors?.commerceCode?.[0]} hint="Para pruebas usa: 597055555532">
                    <Input required name="commerceCode" placeholder="597055555532" defaultValue="597055555532" />
                  </Field>
                  <Field label="API Key (Secret)" error={state.fieldErrors?.apiKey?.[0]} hint="Para pruebas usa la llave pública de integración o tu llave privada de producción.">
                    <Input name="apiKey" type="password" autoComplete="off" placeholder="••••••••••••••••••••••••••••••••" />
                  </Field>
                  <Field label="Ambiente" error={state.fieldErrors?.environment?.[0]}>
                    <select name="environment" defaultValue="integration" className="field">
                      <option value="integration">Integración / Sandbox (Pruebas)</option>
                      <option value="production">Producción (Transbank Real)</option>
                    </select>
                  </Field>
                </>
              )}
            </ActionModal>
            <ActionModal
              triggerLabel="Probar"
              triggerIcon={<TestTube2 size={14} className="mr-1 inline" />}
              variant="secondary"
              title="Test de Conexión a Transbank WebPay"
              description="Verifica las credenciales y la conectividad con el servidor REST de Transbank."
              submitLabel="Probar Transbank"
              action={testWebpayConfigAction}
            >
              {() => <p className="text-sm text-[var(--color-muted-foreground)]">Se iniciará una verificación de token con el servidor de Transbank WebPay Plus.</p>}
            </ActionModal>
          </div>
        </Card>

        {/* Servidor SMTP */}
        <Card className="brand-card p-5 flex flex-col justify-between gap-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-[rgb(18_128_92_/_0.08)] text-[var(--color-success)]">
                <Mail size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-[var(--brand-deep)]">SMTP Mail</h3>
                <p className="text-xs text-[var(--color-muted-foreground)]">Hostinger / Mail</p>
              </div>
            </div>
            <Badge status="paid">Configurado</Badge>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--color-border)] pt-3">
            <ActionModal
              triggerLabel="Probar SMTP"
              triggerIcon={<TestTube2 size={14} className="mr-1 inline" />}
              variant="secondary"
              title="Test de Servidor de Correo SMTP"
              description="Verifica las credenciales y el handshake TLS con el servidor SMTP."
              submitLabel="Probar conexión SMTP"
              action={testSmtpConfigAction}
            >
              {() => <p className="text-sm text-[var(--color-muted-foreground)]">Se verificará el handshake con el servidor SMTP de Hostinger.</p>}
            </ActionModal>
          </div>
        </Card>
      </section>

      <TableToolbar
        query={query}
        filters={[
          {
            name: "status",
            label: "Resultado",
            options: [
              { value: "", label: "Todos" },
              { value: "issued", label: "Emitidos" },
              { value: "pending", label: "Pendientes" },
              { value: "processing", label: "Procesando" },
              { value: "rejected", label: "Rechazados" },
            ],
          },
          {
            name: "integration",
            label: "Integración",
            options: [
              { value: "", label: "Todas" },
              { value: "intellydte", label: "IntellyDTE" },
              { value: "webpay", label: "WebPay" },
            ],
          },
        ]}
      />

      <section className="min-w-0 space-y-4">
        <div className="flex items-center gap-2 text-[var(--brand-royal)]">
          <ShieldCheck size={20} />
          <h2 className="text-lg font-bold text-[var(--brand-deep)]">Actividad de integración</h2>
        </div>
        {attempts.length ? (
          <TableShell>
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Operación</th>
                <th>Estado</th>
                <th>Correlación</th>
                <th>Mensaje seguro</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt) => (
                <tr key={attempt.id}>
                  <td>{new Date(attempt.createdAt).toLocaleString("es-CL")}</td>
                  <td className="font-medium">{getOperationLabel(attempt.operation)}</td>
                  <td>
                    <Badge status={attempt.status}>{getStatusLabel(attempt.status)}</Badge>
                  </td>
                  <td className="font-mono text-xs">{attempt.correlationId}</td>
                  <td>{attempt.safeMessage ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </TableShell>
        ) : (
          <EmptyState title="Sin actividad externa" copy="Los intentos de emisión aparecerán aquí con información redactada." />
        )}
      </section>

      <Pagination page={page} pageSize={pageSize} total={total} query={query} />
    </div>
  );
}
