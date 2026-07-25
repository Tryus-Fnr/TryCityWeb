"use client";

import { METRIC_RANGES, type MetricRange } from "@/lib/infraTypes";

type Props = {
  value: MetricRange;
  onChange: (range: MetricRange) => void;
};

/**
 * Zeitraum-Auswahl für die Verlaufsdiagramme.
 *
 * Die Auflösung wählt der Server passend zum Zeitraum (30 s bis 24 h, danach
 * 5- bzw. 30-Minuten-Mittel) – hier zählt nur das Fenster.
 */
export default function RangePicker({ value, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {METRIC_RANGES.map((r) => (
        <button
          key={r.key}
          onClick={() => onChange(r.key)}
          className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
            value === r.key
              ? "bg-sky-500/15 text-sky-300"
              : "border border-white/10 text-neutral-400 hover:bg-white/5"
          }`}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
