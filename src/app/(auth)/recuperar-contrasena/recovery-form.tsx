"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Mail } from "lucide-react";
import { Alert, Field, Input } from "@/components/ui";
import { requestPasswordResetAction } from "@/features/auth/password-reset-actions";
import { initialActionState } from "@/lib/action-state";

export function RecoveryForm() {
  const [state, action, pending] = useActionState(requestPasswordResetAction, initialActionState);
  if (state.status === "success") return <div className="grid gap-5"><Alert tone="success">{state.message}</Alert><Link className="btn-secondary" href="/login">Volver al inicio de sesión</Link></div>;
  return <form action={action} className="grid gap-5" noValidate>
    {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
    <Field label="Correo electrónico" error={state.fieldErrors?.email?.[0]} hint="Usa el correo registrado en tu cuenta."><Input required type="email" name="email" autoComplete="email" placeholder="tu@empresa.cl" /></Field>
    <button disabled={pending} className="btn-primary w-full" type="submit"><Mail size={18} />{pending ? "Enviando…" : "Enviar enlace de recuperación"}</button>
    <Link className="text-center text-sm font-semibold text-[var(--brand-royal)] hover:underline" href="/login">Volver al inicio de sesión</Link>
  </form>;
}
