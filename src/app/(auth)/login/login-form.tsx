"use client";

import { useActionState } from "react";
import { LockKeyhole } from "lucide-react";
import { loginAction, type LoginState } from "@/features/auth/actions";
import { Alert, Button, Field, Input } from "@/components/ui";

const initialState: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(loginAction, initialState);
  return <form action={action} className="grid gap-5" noValidate>
    {state.error ? <Alert>{state.error}</Alert> : null}
    <Field label="Correo electrónico"><Input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="tu@empresa.cl" /></Field>
    <Field label="Contraseña" hint="Entre 12 y 128 caracteres."><Input name="password" type="password" autoComplete="current-password" required maxLength={128} /></Field>
    <Button disabled={pending} type="submit"><LockKeyhole size={18} aria-hidden="true" />{pending ? "Verificando…" : "Iniciar sesión"}</Button>
  </form>;
}
