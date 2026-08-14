"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  pending?: boolean;
  children: ReactNode;
};

export function Modal({ open, onClose, title, description, pending = false, children }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return <dialog
    ref={dialogRef}
    aria-modal="true"
    aria-labelledby={titleId}
    aria-describedby={description ? descriptionId : undefined}
    className="app-modal"
    onCancel={(event) => {
      event.preventDefault();
      if (!pending) onClose();
    }}
    onClick={(event) => {
      if (event.target === event.currentTarget) event.preventDefault();
    }}
  >
    <div className="app-modal-panel">
      <header className="app-modal-header">
        <div>
          <h2 id={titleId} className="text-xl font-bold text-[var(--brand-deep)]">{title}</h2>
          {description ? <p id={descriptionId} className="mt-1 text-sm text-[var(--color-muted-foreground)]">{description}</p> : null}
        </div>
        <button type="button" disabled={pending} aria-label="Cerrar modal" onClick={onClose} className="app-modal-close"><X size={20} /></button>
      </header>
      <div className="app-modal-body">{children}</div>
    </div>
  </dialog>;
}
