import { PackagePlus } from "lucide-react";
import { Badge, Card, EmptyState, Field, FormPanel, Input, PageHeader, SubmitButton, TableShell } from "@/components/ui";
import { createCatalogItemAction } from "@/features/catalog/actions";
import { listCatalogItems } from "@/features/catalog/service";
import { formatClpAmount } from "@/lib/money";

export default async function CatalogPage() {
  const items = await listCatalogItems();
  return <div className="space-y-6">
    <PageHeader title="Productos o Servicios" description="Define conceptos reutilizables con precio e IVA consistente." />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
      <Card className="min-w-0"><h2 className="mb-5 text-lg font-bold text-[var(--brand-deep)]">Catálogo activo</h2>{items.length ? <TableShell mobileCards><thead><tr><th>Código</th><th>Concepto</th><th>Tipo</th><th className="text-right">Precio</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td data-label="Código" className="font-mono text-xs">{item.code}</td><td data-label="Concepto" className="font-semibold text-[var(--brand-deep)]">{item.name}</td><td data-label="Tipo"><Badge status="draft">{item.type === "service" ? "Servicio" : "Producto"}</Badge></td><td data-label="Precio" className="text-right font-semibold">{formatClpAmount(Number(item.unitPrice))}</td></tr>)}</tbody></TableShell> : <EmptyState title="Tu catálogo está vacío" copy="Agrega un producto o servicio para usarlo en nuevas órdenes." />}</Card>
      <FormPanel title="Nuevo concepto" icon={<PackagePlus size={20} />}><form action={createCatalogItemAction} className="grid gap-3.5">
        <Field label="Tipo"><select name="type" className="field"><option value="service">Servicio</option><option value="product">Producto</option></select></Field>
        <Field label="Código"><Input required name="code" placeholder="SERV-001" /></Field>
        <Field label="Nombre"><Input required name="name" /></Field>
        <Field label="Descripción"><textarea name="description" className="field min-h-24" /></Field>
        <Field label="Precio CLP"><Input required name="unitPrice" type="number" min="1" step="1" /></Field>
        <Field label="Tratamiento tributario"><select name="taxCategory" className="field"><option value="taxable">Afecto a IVA (19%)</option><option value="exempt">Exento</option></select></Field>
        <SubmitButton className="mt-2 w-full" pendingLabel="Guardando concepto…">Guardar concepto</SubmitButton>
      </form></FormPanel>
    </div>
  </div>;
}
