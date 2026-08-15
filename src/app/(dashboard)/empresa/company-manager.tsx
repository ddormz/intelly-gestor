"use client";

import { useActionState } from "react";
import { Building2, Landmark, Save } from "lucide-react";
import { Alert, Card, Field, Input, PageHeader, SubmitButton } from "@/components/ui";
import { saveCompanySettingsAction } from "@/features/company/actions";
import type { CompanyProfile } from "@/features/company/service";
import type { ActionState } from "@/lib/action-state";

const initialState: ActionState = { status: "idle" };

export function CompanyManager({ company }: { company: CompanyProfile }) {
  const [state, formAction] = useActionState(saveCompanySettingsAction, initialState);

  return <div className="space-y-6">
    <PageHeader
      title="Configuración de la Empresa"
      description="Define los datos institucionales, tributarios y bancarios que aparecen en órdenes de pago, PDFs y facturas."
    />

    {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
    {state.status === "success" && state.message ? <Alert tone="success">{state.message}</Alert> : null}

    <form action={formAction} className="space-y-6">
      <Card className="brand-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-[var(--brand-royal)] pb-2 border-b border-[var(--color-border)]">
          <Building2 size={20} />
          <h2 className="text-lg font-bold text-[var(--brand-deep)]">1. Identificación y Ubicación</h2>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="RUT Emisor" error={state.fieldErrors?.rut?.[0]} hint="Formato con puntos y guión.">
            <Input required name="rut" defaultValue={company.rut} placeholder="76.123.456-7" />
          </Field>
          <Field label="Razón Social" error={state.fieldErrors?.legalName?.[0]}>
            <Input required name="legalName" defaultValue={company.legalName} placeholder="Intelly SpA" />
          </Field>
          <Field label="Nombre de Fantasía" error={state.fieldErrors?.tradeName?.[0]}>
            <Input name="tradeName" defaultValue={company.tradeName ?? ""} placeholder="Intelly" />
          </Field>
          <Field label="Giro Comercial" error={state.fieldErrors?.giro?.[0]}>
            <Input name="giro" defaultValue={company.giro ?? ""} placeholder="Servicios Informáticos y Desarrollo" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <Field label="Dirección" error={state.fieldErrors?.addressLine?.[0]}>
            <Input name="addressLine" defaultValue={company.addressLine ?? ""} placeholder="Av. Providencia 1234, Of. 501" />
          </Field>
          <Field label="Comuna" error={state.fieldErrors?.commune?.[0]}>
            <Input name="commune" defaultValue={company.commune ?? ""} placeholder="Providencia" />
          </Field>
          <Field label="Ciudad y Región" error={state.fieldErrors?.city?.[0]}>
            <Input name="city" defaultValue={company.city ?? ""} placeholder="Santiago, RM" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <Field label="Correo de Contacto" error={state.fieldErrors?.email?.[0]}>
            <Input type="email" name="email" defaultValue={company.email ?? ""} placeholder="contacto@intelly.cl" />
          </Field>
          <Field label="Teléfono" error={state.fieldErrors?.phone?.[0]}>
            <Input name="phone" defaultValue={company.phone ?? ""} placeholder="+56 9 1234 5678" />
          </Field>
          <Field label="Sitio Web" error={state.fieldErrors?.website?.[0]}>
            <Input name="website" defaultValue={company.website ?? ""} placeholder="https://intelly.cl" />
          </Field>
        </div>
      </Card>

      <Card className="brand-card p-6 space-y-4">
        <div className="flex items-center gap-2 text-[var(--brand-royal)] pb-2 border-b border-[var(--color-border)]">
          <Landmark size={20} />
          <h2 className="text-lg font-bold text-[var(--brand-deep)]">2. Datos Bancarios para Transferencias</h2>
        </div>
        <p className="text-xs text-[var(--color-muted-foreground)]">Estos datos se muestran en la orden de pago pública y en los correos para que el cliente pueda transferir directamente.</p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Banco" error={state.fieldErrors?.bankName?.[0]}>
            <Input name="bankName" defaultValue={company.bankName ?? ""} placeholder="Banco Santander" />
          </Field>
          <Field label="Tipo de Cuenta" error={state.fieldErrors?.bankAccountType?.[0]}>
            <Input name="bankAccountType" defaultValue={company.bankAccountType ?? ""} placeholder="Cuenta Corriente" />
          </Field>
          <Field label="Número de Cuenta" error={state.fieldErrors?.bankAccountNumber?.[0]}>
            <Input name="bankAccountNumber" defaultValue={company.bankAccountNumber ?? ""} placeholder="12345678" />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 pt-2">
          <Field label="Titular de la Cuenta" error={state.fieldErrors?.bankAccountHolder?.[0]}>
            <Input name="bankAccountHolder" defaultValue={company.bankAccountHolder ?? ""} placeholder="Intelly SpA" />
          </Field>
          <Field label="RUT del Titular" error={state.fieldErrors?.bankAccountRut?.[0]}>
            <Input name="bankAccountRut" defaultValue={company.bankAccountRut ?? ""} placeholder="76.123.456-7" />
          </Field>
          <Field label="Correo para Comprobantes" error={state.fieldErrors?.bankAccountEmail?.[0]}>
            <Input type="email" name="bankAccountEmail" defaultValue={company.bankAccountEmail ?? ""} placeholder="pagos@intelly.cl" />
          </Field>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <SubmitButton
          label="Guardar configuración"
          icon={<Save size={18} />}
          pendingLabel="Guardando cambios…"
        />
      </div>
    </form>
  </div>;
}
