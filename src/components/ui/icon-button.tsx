import Link, { type LinkProps } from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";

type IconButtonBaseProps = {
  label: string;
  icon: ReactNode;
  variant?: "primary" | "secondary" | "danger";
  pending?: boolean;
  disabled?: boolean;
  disabledReason?: string;
  className?: string;
};

type IconButtonProps = IconButtonBaseProps & (
  (ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined })
  | (AnchorHTMLAttributes<HTMLAnchorElement> & Pick<LinkProps, "replace" | "scroll" | "prefetch"> & { href: LinkProps["href"] })
);

function buttonClass(variant: IconButtonBaseProps["variant"], className: string | undefined): string {
  return `icon-button btn-${variant ?? "secondary"} ${className ?? ""}`.trim();
}

export function IconButton({ label, icon, href, variant = "secondary", pending = false, disabled = false, disabledReason, className, ...props }: IconButtonProps) {
  if (!label.trim()) throw new Error("IconButton requires a non-empty label.");
  const unavailable = pending || disabled;
  const content = pending ? <LoaderCircle aria-hidden="true" className="animate-spin" size={18} /> : icon;
  const accessibleName = <span className="sr-only">{pending ? `${label}, procesando` : label}</span>;
  const shared = {
    "aria-label": label,
    "aria-description": unavailable ? disabledReason : undefined,
    "aria-busy": pending || undefined,
    "aria-disabled": unavailable || undefined,
    "data-tooltip": unavailable && disabledReason ? disabledReason : label,
    title: unavailable && disabledReason ? disabledReason : label,
    className: buttonClass(variant, className),
  };

  if (disabled) {
    return <span role={href !== undefined ? "link" : "button"} {...shared} tabIndex={0}>
      {content}<span aria-hidden="true" className="icon-button-tooltip">{label}</span>{accessibleName}
    </span>;
  }

  if (href !== undefined) {
    const anchorProps = props as AnchorHTMLAttributes<HTMLAnchorElement> & Pick<LinkProps, "replace" | "scroll" | "prefetch">;
    if (unavailable) {
      return <span role="link" {...shared} tabIndex={-1}>
        {content}<span aria-hidden="true" className="icon-button-tooltip">{label}</span>{accessibleName}
      </span>;
    }
    return <Link href={href} {...anchorProps} {...shared} tabIndex={unavailable ? -1 : anchorProps.tabIndex}>
      {content}<span aria-hidden="true" className="icon-button-tooltip">{label}</span>{accessibleName}
    </Link>;
  }

  const buttonProps = props as ButtonHTMLAttributes<HTMLButtonElement>;
  return <button type={buttonProps.type ?? "button"} {...buttonProps} {...shared} disabled={unavailable || buttonProps.disabled}>
    {content}<span aria-hidden="true" className="icon-button-tooltip">{label}</span>{accessibleName}
  </button>;
}
