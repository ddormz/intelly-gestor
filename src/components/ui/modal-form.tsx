"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { Modal } from "./modal";
import { Alert, Button } from "./primitives";
import type { ActionState } from "@/lib/action-state";

type ActionModalProps = {
  triggerLabel: string;
  triggerIcon?: ReactNode;
  title: string;
  description?: string;
  submitLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "danger";
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  children: (state: ActionState) => ReactNode;
};

const initialState: ActionState = { status: "idle" };

function ActionModalContent({ title, description, submitLabel, pendingLabel, action, children, onClose }: Omit<ActionModalProps, "triggerLabel" | "triggerIcon" | "variant"> & { onClose: () => void }) {
  const [state, formAction, pending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") onClose();
  }, [state.status, onClose]);

  return <Modal open onClose={onClose} title={title} description={description} pending={pending}>
    <form action={formAction} className="grid gap-4" noValidate>
      {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
      {children(state)}
      <div className="app-modal-actions">
        <Button type="button" variant="secondary" disabled={pending} onClick={onClose}>Cancelar</Button>
        <Button type="submit" disabled={pending}>{pending ? pendingLabel ?? "Guardando…" : submitLabel}</Button>
      </div>
    </form>
  </Modal>;
}

export function ActionModal({ triggerLabel, triggerIcon, variant = "primary", ...props }: ActionModalProps) {
  const [open, setOpen] = useState(false);
  return <>
    <Button type="button" variant={variant} onClick={() => setOpen(true)}>{triggerIcon}{triggerLabel}</Button>
    {open ? <ActionModalContent {...props} onClose={() => setOpen(false)} /> : null}
  </>;
}
