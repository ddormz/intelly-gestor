"use client";
import { ErrorState } from "@/components/ui";
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorState copy="Revisa la conexión e intenta nuevamente." action={<button className="btn-primary" onClick={reset}>Reintentar</button>} />; }
