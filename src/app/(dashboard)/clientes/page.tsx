import { UserRoundPlus } from "lucide-react";
import { Card, EmptyState, Field, FormPanel, Input, PageHeader, SubmitButton, TableShell } from "@/components/ui";
import { createClientAction } from "@/features/clients/actions";
import { listClients } from "@/features/clients/service";

export default async function ClientsPage() {
  const items = await listClients();
  return <div className="space-y-6">
    <PageHeader title="Clientes" description="Mantén los datos comerciales y tributarios usados en órdenes y facturas." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="min-w-0"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Clientes activos</h2>{items.length ? <TableShell mobileCards><thead><tr><th>Cliente</th><th>RUT</th><th>Contacto</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td data-label="Cliente" className="font-semibold text-[var(--brand-deep)]">{item.legalName}</td><td data-label="RUT">{item.taxId}</td><td data-label="Contacto">{item.email}</td></tr>)}</tbody></TableShell> : <EmptyState title="Aún no hay clientes" copy="Agrega el primer cliente para poder crear una orden de pago." />}</Card>
      <FormPanel title="Nuevo cliente" icon={<UserRoundPlus size={20} />}><form action={createClientAction} className="grid gap-3.5">
        <Field label="Tipo"><select name="kind" className="field"><option value="company">Empresa</option><option value="person">Persona</option></select></Field>
        <Field label="RUT"><Input required name="taxId" placeholder="76.123.456-7" /></Field>
        <Field label="Razón social o nombre"><Input required name="legalName" /></Field>
        <Field label="Correo"><Input required name="email" type="email" /></Field>
        <Field label="Teléfono"><Input name="phone" /></Field>
        <Field label="Dirección"><Input name="addressLine" /></Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Field label="Comuna"><Input name="commune" /></Field><Field label="Ciudad"><Input name="city" /></Field></div>
        <SubmitButton className="mt-2 w-full" pendingLabel="Guardando cliente…">Guardar cliente</SubmitButton>
      </form></FormPanel>
    </div>
  </div>;
}
