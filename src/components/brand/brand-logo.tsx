import Image from "next/image";

type BrandLogoProps = {
  variant?: "full" | "mark";
  inverse?: boolean;
  priority?: boolean;
  className?: string;
};

export function BrandLogo({ variant = "full", inverse = false, priority = false, className = "" }: BrandLogoProps) {
  if (variant === "mark") {
    return <Image className={className} src="/intelly-isotipo.png" alt="Intelly" width={44} height={44} priority={priority} />;
  }

  if (inverse) {
    return <span className={`inline-flex items-center gap-3 ${className}`}>
      <Image src="/intelly-isotipo.png" alt="" width={42} height={42} priority={priority} />
      <span className="brand-wordmark">Intelly</span>
    </span>;
  }

  return <Image className={className} src="/intelly-logo.png" alt="Intelly" width={170} height={54} priority={priority} />;
}
