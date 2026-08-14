"use client";

import Link from "next/link";
import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { loginAction, type LoginState } from "@/features/auth/actions";
import { Alert, Field, Input } from "@/components/ui";

const initialState: LoginState = { status: "idle" };

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return <form action={action} className="grid gap-5" noValidate>
    {state.status === "error" && state.message ? <Alert>{state.message}</Alert> : null}
    <Field label="Correo electrónico"><Input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="tu@empresa.cl" /></Field>
    <Field label="Contraseña" hint="Entre 12 y 128 caracteres."><Input name="password" type="password" autoComplete="current-password" required maxLength={128} placeholder="Ingresa tu contraseña" /></Field>
    <div className="-mt-2 text-right"><Link href="/recuperar-contrasena" className="text-sm font-semibold text-[var(--brand-royal)] hover:underline">¿Olvidaste tu contraseña?</Link></div>
    <button disabled={pending} type="submit" className="btn-primary w-full"><LockKeyhole size={18} aria-hidden="true" />{pending ? <span className="button-spinner" aria-hidden="true" /> : null}{pending ? "Verificando…" : "Iniciar sesión"}</button>
  </form>;
}
