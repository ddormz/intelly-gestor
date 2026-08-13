import { UserRoundPlus } from "lucide-react";
import { Card, EmptyState } from "@/components/ui";
import { createClientAction } from "@/features/clients/actions";
import { listClients } from "@/features/clients/service";

export default async function ClientsPage() {
  const items = await listClients();
  return <div className="space-y-6"><header><h1 className="page-title">Clientes</h1><p className="page-copy mt-1">Mantén los datos comerciales y tributarios usados en órdenes y facturas.</p></header>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
      <Card><h2 className="mb-4 text-lg font-bold">Clientes activos</h2>{items.length ? <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-slate-500"><th className="pb-3">Cliente</th><th className="pb-3">RUT</th><th className="pb-3">Contacto</th></tr></thead><tbody>{items.map((item) => <tr key={item.id} className="border-b border-slate-100"><td className="py-3 font-semibold">{item.legalName}</td><td className="py-3">{item.taxId}</td><td className="py-3">{item.email}</td></tr>)}</tbody></table></div> : <EmptyState title="Aún no hay clientes" copy="Agrega el primer cliente para poder crear una orden de pago." />}</Card>
      <Card><div className="mb-4 flex items-center gap-2"><UserRoundPlus className="text-emerald-700" size={20} /><h2 className="text-lg font-bold">Nuevo cliente</h2></div><form action={createClientAction} className="grid gap-3">
        <label className="grid gap-1 text-sm font-semibold">Tipo<select name="kind" className="field"><option value="company">Empresa</option><option value="person">Persona</option></select></label>
        <label className="grid gap-1 text-sm font-semibold">RUT<input required name="taxId" className="field" placeholder="76.123.456-7" /></label>
        <label className="grid gap-1 text-sm font-semibold">Razón social o nombre<input required name="legalName" className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold">Correo<input required name="email" type="email" className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold">Teléfono<input name="phone" className="field" /></label>
        <label className="grid gap-1 text-sm font-semibold">Dirección<input name="addressLine" className="field" /></label>
        <div className="grid grid-cols-2 gap-3"><label className="grid gap-1 text-sm font-semibold">Comuna<input name="commune" className="field" /></label><label className="grid gap-1 text-sm font-semibold">Ciudad<input name="city" className="field" /></label></div>
        <button className="btn-primary mt-2">Guardar cliente</button>
      </form></Card>
    </div>
  </div>;
}
