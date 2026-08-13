import { PackagePlus } from "lucide-react";
import { Card, EmptyState, Badge } from "@/components/ui";
import { createCatalogItemAction } from "@/features/catalog/actions";
import { listCatalogItems } from "@/features/catalog/service";

const money = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

export default async function CatalogPage() {
  const items = await listCatalogItems();
  return <div className="space-y-6"><header><h1 className="page-title">Productos o Servicios</h1><p className="page-copy mt-1">Define conceptos reutilizables con precio e IVA consistente.</p></header>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <Card><h2 className="mb-4 text-lg font-bold">Catálogo activo</h2>{items.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="pb-3">Código</th><th className="pb-3">Concepto</th><th className="pb-3">Tipo</th><th className="pb-3 text-right">Precio</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 font-mono text-xs">{item.code}</td><td className="py-3 font-semibold">{item.name}</td><td className="py-3"><Badge status="draft">{item.type === "service" ? "Servicio" : "Producto"}</Badge></td><td className="py-3 text-right font-semibold">{money.format(Number(item.unitPrice))}</td></tr>)}</tbody></table></div> : <EmptyState title="Tu catálogo está vacío" copy="Agrega un producto o servicio para usarlo en nuevas órdenes." />}</Card>
      <Card><div className="mb-4 flex items-center gap-2"><PackagePlus className="text-emerald-700" size={20} /><h2 className="text-lg font-bold">Nuevo concepto</h2></div><form action={createCatalogItemAction} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Tipo<select name="type" className="field"><option value="service">Servicio</option><option value="product">Producto</option></select></label>
        <label className="grid gap-1 text-sm font-semibold">Código<input required name="code" className="field" placeholder="SERV-001" /></label>
        <label className="grid gap-1 text-sm font-semibold">Nombre<input required name="name" className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold">Descripción<textarea name="description" className="field min-h-24" /></label>
        <label className="grid gap-1 text-sm font-semibold">Precio CLP<input required name="unitPrice" type="number" min="1" step="1" className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold">Tratamiento tributario<select name="taxCategory" className="field"><option value="taxable">Afecto a IVA (19%)</option><option value="exempt">Exento</option></select></label>
        <button className="btn-primary mt-2">Guardar concepto</button>
      </form></Card>
    </div>
  </div>;
}
