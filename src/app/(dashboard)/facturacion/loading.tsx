import { Card } from "@/components/ui";

function Block({ className }: { className: string }) {
  return <div aria-hidden="true" className={`animate-pulse rounded bg-[var(--color-muted)] ${className}`} />;
}

export default function BillingLoading() {
  return (
    <div aria-label="Cargando facturación" aria-busy="true" className="space-y-6">
      <header className="page-header">
        <div className="min-w-0 space-y-3">
          <Block className="h-8 w-48" />
          <Block className="h-4 w-[min(42rem,90vw)]" />
        </div>
        <div className="flex gap-2">
          <Block className="h-9 w-32" />
          <Block className="h-9 w-28" />
        </div>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }, (_, index) => (
          <Card key={index} className="brand-card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <Block className="size-10 rounded-xl" />
              <div className="space-y-2"><Block className="h-3 w-28" /><Block className="h-2.5 w-14" /></div>
            </div>
            <Block className="h-3 w-full" />
          </Card>
        ))}
      </section>

      <Card className="brand-card p-5 space-y-5">
        <Block className="h-6 w-48" />
        {Array.from({ length: 4 }, (_, index) => <Block key={index} className="h-12 w-full" />)}
      </Card>

      <Card className="brand-card p-5 space-y-4">
        <Block className="h-6 w-36" />
        {Array.from({ length: 6 }, (_, index) => <Block key={index} className="h-10 w-full" />)}
      </Card>
    </div>
  );
}
