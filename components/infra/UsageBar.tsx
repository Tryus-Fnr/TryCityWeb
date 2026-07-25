import { formatPercent, usageColor, usageTextColor } from "./utils";

type Props = {
  label: string;
  /** Auslastung 0..1. Negative Werte werden als "unbekannt" dargestellt. */
  ratio: number;
  /** Zusatztext rechts, z.B. "12,4 / 32,0 GiB". */
  detail?: string;
};

/** Beschrifteter Auslastungsbalken mit Ampelfarbe. */
export default function UsageBar({ label, ratio, detail }: Props) {
  const clamped = ratio < 0 ? 0 : Math.max(0, Math.min(1, ratio));

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-neutral-400">{label}</span>
        <span className={`font-medium tabular-nums ${usageTextColor(ratio)}`}>
          {formatPercent(ratio)}
          {detail && <span className="ml-1 text-neutral-500">{detail}</span>}
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        <div
          className={`h-full rounded-full transition-all duration-500 ${usageColor(ratio)}`}
          style={{ width: `${clamped * 100}%` }}
        />
      </div>
    </div>
  );
}
