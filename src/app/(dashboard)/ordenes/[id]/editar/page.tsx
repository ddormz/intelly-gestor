import { notFound } from "next/navigation";
import { requireUser } from "@/features/auth/session";
import { updateOrderFromCartAction } from "@/features/orders/actions";
import { findOrderForEdit } from "@/features/orders/service";
import { OrderPos, type OrderPosInitial } from "../../nueva/order-pos";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const order = await findOrderForEdit(id);
  if (!order) notFound();
  const initial: OrderPosInitial = {
    id: order.id,
    number: order.number,
    status: order.status,
    version: order.version,
    clientId: order.clientId,
    clientName: order.clientName,
    clientEmail: order.clientEmail,
    discountPercent: Number(order.discountPercent),
    discountReason: order.discountReason,
    dueAt: order.dueAt?.toISOString().slice(0, 10) ?? "",
    notes: order.notes,
    lines: order.lines,
  };
  return <OrderPos action={updateOrderFromCartAction} initial={initial} />;
}
