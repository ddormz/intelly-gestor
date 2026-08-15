"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({ children, pendingLabel = "Guardando…", variant = "primary", className = "", icon, iconOnly = false, label }: { children?: ReactNode; pendingLabel?: string; variant?: "primary" | "secondary" | "danger"; className?: string; icon?: ReactNode; iconOnly?: boolean; label?: string }) {
  const { pending } = useFormStatus();
  const accessibleLabel = label ?? (typeof children === "string" ? children : undefined);
  return <button type="submit" disabled={pending} aria-disabled={pending} aria-label={iconOnly ? accessibleLabel : undefined} aria-busy={pending || undefined} data-tooltip={iconOnly ? accessibleLabel : undefined} title={iconOnly ? accessibleLabel : undefined} className={`${iconOnly ? `icon-button btn-${variant}` : `btn-${variant}`} ${className}`}>
    {pending ? <span aria-hidden="true" className="button-spinner" /> : iconOnly ? icon : null}
    <span className={iconOnly ? "sr-only" : ""}>{pending ? pendingLabel : iconOnly ? accessibleLabel : children}</span>
  </button>;
}
