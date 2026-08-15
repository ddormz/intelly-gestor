import { notFound } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  CreditCard,
  Download,
  Landmark,
  LockKeyhole,
  Receipt,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import { BrandLogo } from "@/components/brand/brand-logo";
import { Alert, Badge, Card } from "@/components/ui";
import { findPublicOrder } from "@/features/orders/service";
import { getCompanySettings } from "@/features/company/service";
import { formatClpAmount } from "@/lib/money";
import { getStatusLabel } from "@/lib/presentation";

export default async function PublicOrderPage({
  params,
  searchParams,
}: {
  params: Promise<{ publicToken: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { publicToken } = await params;
  if (publicToken.length < 40 || publicToken.length > 128) notFound();

  const [order, company, queryObj] = await Promise.all([
    findPublicOrder(publicToken),
    getCompanySettings(),
    searchParams ? searchParams : Promise.resolve({} as Record<string, string | string[] | undefined>),
  ]);

  if (!order) notFound();

  const paymentStatus = typeof queryObj?.status === "string" ? queryObj.status : null;
  const authCode = typeof queryObj?.auth === "string" ? queryObj.auth : null;
  const errorMessage = typeof queryObj?.message === "string" ? queryObj.message : typeof queryObj?.error === "string" ? queryObj.error : null;

  const isPayable = order.status === "issued" || order.status === "draft";
  const isPaid = order.status === "paid" || order.status === "invoiced" || paymentStatus === "paid";

  return (
    <main className="min-h-screen bg-[var(--color-background)] p-3 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Top brand header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <BrandLogo priority />
          <div className="flex items-center gap-3">
            <span className="secure-link-badge">
              <LockKeyhole size={14} />
              Enlace seguro
            </span>
            <a
              href={`/api/public/orders/${publicToken}/pdf`}
              className="btn-secondary !h-9 !px-3 text-xs inline-flex items-center gap-1.5"
            >
              <Download size={14} />
              Descargar PDF
            </a>
          </div>
        </div>

        {/* WebPay Status Alerts */}
        {paymentStatus === "paid" && (
          <Alert tone="success">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-5 shrink-0 text-[var(--color-success)]" />
              <div>
                <p className="font-bold">¡Pago recibido con éxito mediante WebPay Plus!</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Tu transacción fue autorizada {authCode ? `(Código: ${authCode})` : ""}. Tu comprobante está listo.
                </p>
              </div>
            </div>
          </Alert>
        )}

        {paymentStatus === "rejected" && (
          <Alert tone="error">
            <div className="flex items-center gap-2">
              <XCircle className="size-5 shrink-0 text-[var(--color-danger)]" />
              <div>
                <p className="font-bold">El pago fue rechazado por el banco o emisor de la tarjeta.</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">Puedes intentar nuevamente o pagar mediante transferencia bancaria.</p>
              </div>
            </div>
          </Alert>
        )}

        {paymentStatus === "cancelled" && (
          <Alert tone="info">
            <div className="flex items-center gap-2">
              <AlertCircle className="size-5 shrink-0 text-[var(--brand-royal)]" />
              <div>
                <p className="font-bold">El proceso de pago en WebPay fue cancelado.</p>
                <p className="text-xs text-[var(--color-muted-foreground)]">La orden permanece activa y pendiente de pago.</p>
              </div>
            </div>
          </Alert>
        )}

        {errorMessage && (
          <Alert tone="error">
            <p className="font-bold">Ocurrió un error al procesar el pago:</p>
            <p className="text-xs">{errorMessage}</p>
          </Alert>
        )}

        {/* Document Card: PDF Style */}
        <Card className="brand-card overflow-hidden bg-white shadow-xl border border-[var(--color-border)] p-6 sm:p-10 space-y-8">
          {/* Header of the PDF document */}
          <div className="flex flex-col justify-between gap-6 border-b border-[var(--color-border)] pb-8 md:flex-row md:items-start">
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--brand-cyan)]">Emisor</span>
              <h2 className="text-2xl font-black text-[var(--brand-navy)]">{company.legalName}</h2>
              <p className="text-xs text-[var(--color-muted-foreground)] font-mono">RUT: {company.rut}</p>
              {company.giro && <p className="text-xs text-[var(--color-muted-foreground)]">{company.giro}</p>}
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {company.addressLine ? `${company.addressLine}, ` : ""}{company.commune ? `${company.commune}, ` : ""}{company.city ?? ""}
              </p>
              {company.email && <p className="text-xs text-[var(--brand-royal)]">{company.email}</p>}
            </div>

            <div className="flex flex-col items-start md:items-end gap-2 text-left md:text-right">
              <div className="rounded-xl border-2 border-[var(--brand-royal)] bg-[rgb(27_75_224_/_0.04)] px-5 py-3 text-center md:text-right">
                <p className="text-[11px] font-extrabold uppercase tracking-wider text-[var(--brand-royal)]">Orden de Pago</p>
                <p className="font-mono text-xl font-bold text-[var(--brand-deep)]">{order.number}</p>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-xs text-[var(--color-muted-foreground)]">Estado:</span>
                <Badge status={order.status}>{getStatusLabel(order.status)}</Badge>
              </div>
              {order.dueAt && (
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  Vence: <strong className="text-[var(--brand-deep)]">{new Date(order.dueAt).toLocaleDateString("es-CL")}</strong>
                </p>
              )}
            </div>
          </div>

          {/* Client Info Block */}
          <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background-soft)] p-5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-[var(--brand-royal)]">Cliente Receptor</span>
            <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <p className="text-xs text-[var(--color-muted-foreground)]">Razón Social o Nombre</p>
                <p className="font-bold text-sm text-[var(--brand-deep)]">{order.clientName}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted-foreground)]">RUT / Identificación</p>
                <p className="font-mono font-semibold text-sm text-[var(--brand-deep)]">{order.clientTaxId ?? "Sin RUT"}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--color-muted-foreground)]">Correo Electrónico</p>
                <p className="font-semibold text-sm text-[var(--brand-royal)]">{order.clientEmail}</p>
              </div>
              {order.clientAddress && (
                <div className="sm:col-span-2">
                  <p className="text-xs text-[var(--color-muted-foreground)]">Dirección</p>
                  <p className="text-sm text-[var(--brand-deep)]">{order.clientAddress}, {order.clientCommune ?? ""}</p>
                </div>
              )}
            </div>
          </div>

          {/* Items Table */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Receipt size={18} className="text-[var(--brand-royal)]" />
              <h3 className="text-base font-bold text-[var(--brand-deep)]">Detalle de Conceptos</h3>
            </div>
            <div className="overflow-x-auto rounded-xl border border-[var(--color-border)]">
              <table className="w-full text-left text-sm">
                <thead className="bg-[var(--color-background-soft)] border-b border-[var(--color-border)] text-xs font-bold text-[var(--brand-navy)] uppercase tracking-wider">
                  <tr>
                    <th className="p-3.5">Descripción</th>
                    <th className="p-3.5 text-center">Cant.</th>
                    <th className="p-3.5 text-right">Precio Unitario</th>
                    <th className="p-3.5 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-border)]">
                  {order.lines.map((line) => (
                    <tr key={line.id} className="hover:bg-[var(--color-background-soft)]/50">
                      <td className="p-3.5">
                        <p className="font-semibold text-[var(--brand-deep)]">{line.description}</p>
                        {line.code && <p className="text-xs text-[var(--color-muted-foreground)] font-mono">{line.code}</p>}
                      </td>
                      <td className="p-3.5 text-center font-medium">{line.quantity}</td>
                      <td className="p-3.5 text-right font-mono">{formatClpAmount(line.unitPrice)}</td>
                      <td className="p-3.5 text-right font-mono font-bold text-[var(--brand-navy)]">{formatClpAmount(line.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Bottom Grid: Bank Details + Totals Summary */}
          <div className="grid gap-6 md:grid-cols-[1.3fr_1fr] pt-2">
            {/* Bank Transfer Instructions */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background-soft)] p-5 space-y-3">
              <div className="flex items-center gap-2 text-[var(--brand-royal)]">
                <Landmark size={18} />
                <h4 className="text-xs font-bold uppercase tracking-wider">Datos para Transferencia</h4>
              </div>
              <div className="space-y-1.5 text-xs text-[var(--brand-deep)]">
                <p><span className="text-[var(--color-muted-foreground)]">Banco:</span> <strong>{company.bankName}</strong></p>
                <p><span className="text-[var(--color-muted-foreground)]">Tipo de Cuenta:</span> <strong>{company.bankAccountType}</strong></p>
                <p><span className="text-[var(--color-muted-foreground)]">Nº de Cuenta:</span> <strong className="font-mono">{company.bankAccountNumber}</strong></p>
                <p><span className="text-[var(--color-muted-foreground)]">Titular:</span> <strong>{company.bankAccountHolder}</strong></p>
                <p><span className="text-[var(--color-muted-foreground)]">RUT:</span> <strong className="font-mono">{company.bankAccountRut}</strong></p>
                {company.bankAccountEmail && (
                  <p><span className="text-[var(--color-muted-foreground)]">Correo comprobantes:</span> <strong>{company.bankAccountEmail}</strong></p>
                )}
              </div>
              {order.notes && (
                <div className="border-t border-[var(--color-border)] pt-2 mt-2">
                  <p className="text-[11px] text-[var(--color-muted-foreground)] italic">{order.notes}</p>
                </div>
              )}
            </div>

            {/* Financial Totals */}
            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background-soft)] p-5 space-y-2.5">
              <div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
                <span>Subtotal neto</span>
                <span className="font-mono font-medium">{formatClpAmount(Number(order.subtotal))}</span>
              </div>
              {Number(order.discountTotal) > 0 && (
                <div className="flex justify-between text-sm text-[var(--color-danger)]">
                  <span>Descuento {order.discountPercent ? `(${order.discountPercent}%)` : ""}</span>
                  <span className="font-mono font-medium">-{formatClpAmount(Number(order.discountTotal))}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-[var(--color-muted-foreground)]">
                <span>IVA (19%)</span>
                <span className="font-mono font-medium">{formatClpAmount(Number(order.taxTotal))}</span>
              </div>
              <div className="border-t-2 border-[var(--brand-royal)] pt-3 flex items-baseline justify-between">
                <span className="text-base font-bold text-[var(--brand-deep)]">Total a Pagar</span>
                <span className="text-2xl font-black text-[var(--brand-royal)] font-mono">{formatClpAmount(Number(order.total))}</span>
              </div>
            </div>
          </div>

          {/* Payment CTA: Transbank WebPay */}
          {isPayable && !isPaid && (
            <div className="rounded-2xl border-2 border-[var(--brand-cyan)] bg-gradient-to-br from-[rgb(20_208_246_/_0.08)] to-[rgb(27_75_224_/_0.05)] p-6 text-center space-y-4">
              <div>
                <h3 className="text-xl font-bold text-[var(--brand-deep)]">Paga en línea al instante</h3>
                <p className="text-xs text-[var(--color-muted-foreground)] mt-1">
                  Aceptamos tarjetas de Débito, Crédito y Prepago con Transbank WebPay Plus.
                </p>
              </div>

              <form action={`/api/public/orders/${publicToken}/webpay`} method="POST" className="inline-block">
                <button
                  type="submit"
                  className="btn-primary !h-14 !px-8 !text-base !font-extrabold shadow-lg hover:scale-[1.02] transition-transform inline-flex items-center gap-3 bg-[#e60000] hover:bg-[#cc0000] text-white border-none"
                >
                  <CreditCard size={22} />
                  Pagar con Webpay Plus ({formatClpAmount(Number(order.total))})
                </button>
              </form>

              <div className="flex items-center justify-center gap-4 text-xs text-[var(--color-muted-foreground)] pt-1">
                <span className="flex items-center gap-1"><ShieldCheck size={14} className="text-[var(--color-success)]" /> Transacción encriptada</span>
                <span className="flex items-center gap-1"><Clock3 size={14} className="text-[var(--brand-blue)]" /> Aprobación inmediata</span>
              </div>
            </div>
          )}

          {isPaid && (
            <div className="rounded-2xl border-2 border-[var(--color-success)] bg-[rgb(18_128_92_/_0.06)] p-6 text-center space-y-2">
              <div className="grid size-12 place-items-center rounded-full bg-[rgb(18_128_92_/_0.15)] text-[var(--color-success)] mx-auto">
                <CheckCircle2 size={28} />
              </div>
              <h3 className="text-lg font-bold text-[var(--color-success)]">Esta orden ya fue pagada</h3>
              <p className="text-xs text-[var(--color-muted-foreground)]">
                Gracias por tu pago. Puedes descargar tu comprobante comercial en PDF usando el botón superior.
              </p>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-[var(--color-muted-foreground)]">
          Gestión comercial, emisión y pagos conectados por <strong>Intelly</strong>.
        </p>
      </div>
    </main>
  );
}
