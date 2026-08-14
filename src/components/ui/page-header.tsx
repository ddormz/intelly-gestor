import type { ReactNode } from "react";

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <header className="page-header">
    <div className="min-w-0">
      {eyebrow ? <p className="page-eyebrow">{eyebrow}</p> : null}
      <h1 className="page-title">{title}</h1>
      <p className="page-copy">{description}</p>
    </div>
    {action ? <div className="page-header-action">{action}</div> : null}
  </header>;
}
