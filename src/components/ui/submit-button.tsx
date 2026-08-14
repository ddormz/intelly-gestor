"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, pendingLabel = "Guardando…", variant = "primary", className = "" }: { children: ReactNode; pendingLabel?: string; variant?: "primary" | "secondary" | "danger"; className?: string }) {
  const { pending } = useFormStatus();
  return <button type="submit" disabled={pending} aria-disabled={pending} className={`btn-${variant} ${className}`}>
    {pending ? <span aria-hidden="true" className="button-spinner" /> : null}
    <span>{pending ? pendingLabel : children}</span>
  </button>;
}
