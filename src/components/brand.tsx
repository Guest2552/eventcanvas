import Link from "next/link";
import { cn } from "@/lib/utils";

export function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-7", className)} aria-hidden>
      <rect x="1" y="1" width="30" height="30" rx="9" fill="var(--primary)" />
      <rect x="8" y="7" width="16" height="4" rx="1.5" fill="var(--marigold)" />
      {[10, 16, 22].map((cx) => (
        <circle key={`a${cx}`} cx={cx} cy="17" r="2.4" fill="white" />
      ))}
      {[10, 16, 22].map((cx) => (
        <circle key={`b${cx}`} cx={cx} cy="24" r="2.4" fill="white" opacity="0.65" />
      ))}
    </svg>
  );
}

export function Brand({ className, href = "/" }: { className?: string; href?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-heading text-lg font-semibold tracking-tight", className)}>
      <BrandMark />
      <span>
        Event<span className="text-primary">Canvas</span>
      </span>
    </Link>
  );
}
