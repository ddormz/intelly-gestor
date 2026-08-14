"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { Alert, Field, Input } from "@/components/ui";
import { resetPasswordAction } from "@/features/auth/password-reset-actions";
import { initialActionState } from "@/lib/action-state";

export function ResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, initialActionState);
  if (state.status === "success") return <div className="grid gap-5"><Alert tone="success">{state.message}</Alert><Link className="btn-primary" href="/login">Iniciar sesión</Link></div>;
  if (!token) return <div className="grid gap-5"><Alert>El enlace de recuperación no contiene un token válido.</Alert><Link className="btn-secondary" href="/recuperar-contrasena">Solicitar otro enlace</Link></div>;
  return <form action={action} className="grid gap-5" noValidate>
    <input type="hidden" name="token" value={token} />
    {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
    <Field label="Nueva contraseña" error={state.fieldErrors?.password?.[0]} hint="Entre 12 y 128 caracteres."><Input required minLength={12} maxLength={128} type="password" name="password" autoComplete="new-password" placeholder="Una frase segura de 12+ caracteres" /></Field>
    <Field label="Repite la contraseña" error={state.fieldErrors?.confirmation?.[0]}><Input required minLength={12} maxLength={128} type="password" name="confirmation" autoComplete="new-password" placeholder="Escribe la misma contraseña" /></Field>
    <button disabled={pending} className="btn-primary w-full" type="submit"><LockKeyhole size={18} />{pending ? "Actualizando…" : "Guardar nueva contraseña"}</button>
  </form>;
}
