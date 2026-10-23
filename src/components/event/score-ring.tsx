import { cn } from "@/lib/utils";

export function ScoreRing({ value, size = 64, label, className }: { value: number; size?: number; label?: string; className?: string }) {
  const r = size / 2 - 5;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const color = pct >= 85 ? "var(--success)" : pct >= 60 ? "var(--warning)" : "var(--destructive)";
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--muted)" strokeWidth="6" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-center leading-none">
        <span className="block font-semibold tabular-nums" style={{ fontSize: size * 0.28 }}>
          {Math.round(pct)}
        </span>
        {label && <span className="block text-[9px] text-muted-foreground">{label}</span>}
      </span>
    </div>
  );
}

export function StatTile({
  label,
  value,
  sub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-3", className)}>
      <p className="text-[11px] font-medium text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
