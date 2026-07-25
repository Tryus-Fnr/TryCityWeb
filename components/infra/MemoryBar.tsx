import { MEMORY_SEGMENTS } from "@/lib/infraTypes";
import { formatBytes, formatPercent, usageTextColor } from "./utils";

/**
 * Die vier Kategorien eines Speicherbalkens, jeweils in Bytes.
 * Entspricht 1:1 dem, was htop im Mem-Balken einfärbt.
 */
export type MemoryParts = {
  total: number;
  used: number;
  buffers: number;
  cached: number;
  shared: number;
};

type Props = {
  node?: MemoryParts | NodeLike;
  parts?: MemoryParts;
  /** Legende mit Werten unter dem Balken zeigen. */
  detailed?: boolean;
};

type NodeLike = {
  ramTotal: number;
  ramUsed: number;
  ramBuffers: number;
  ramCached: number;
  ramShared: number;
};

function toParts(input: MemoryParts | NodeLike): MemoryParts {
  if ("ramTotal" in input) {
    return {
      total: input.ramTotal,
      used: input.ramUsed,
      buffers: input.ramBuffers,
      cached: input.ramCached,
      shared: input.ramShared,
    };
  }
  return input;
}

/**
 * Gestapelter Speicherbalken in den Farben von htop.
 *
 * <p><b>Warum das nicht ein einzelner Balken ist:</b> "total − frei" zählt
 * Datei-Cache und Puffer als belegt. Linux füllt aber grundsätzlich jeden
 * ungenutzten Block mit Cache und gibt ihn beim ersten Bedarf sofort wieder her.
 * Ein einzelner Balken behauptet deshalb eine Auslastung, die es nicht gibt –
 * erst die Aufteilung zeigt, wie viel wirklich weg ist.</p>
 *
 * <p>Meldet das Plugin keine Aufschlüsselung (ältere Version oder kein Linux),
 * bleiben Puffer/Cache/Shared auf 0 und der Balken sieht wie vorher aus.</p>
 */
export default function MemoryBar({ node, parts, detailed = false }: Props) {
  const source = parts ?? (node ? toParts(node) : null);
  if (!source || source.total <= 0) return null;

  const values: Record<string, number> = {
    used: source.used,
    buffers: source.buffers,
    shared: source.shared,
    cached: source.cached,
  };

  const usedRatio = source.used / source.total;
  const accounted = source.used + source.buffers + source.shared + source.cached;
  const free = Math.max(0, source.total - accounted);
  const hasBreakdown = source.buffers + source.cached + source.shared > 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-neutral-400">RAM</span>
        <span className={`font-medium tabular-nums ${usageTextColor(usedRatio)}`}>
          {formatPercent(usedRatio)}
          <span className="ml-1 text-neutral-500">
            {formatBytes(source.used)} / {formatBytes(source.total)}
          </span>
        </span>
      </div>

      <div className="mt-1 flex h-1.5 w-full overflow-hidden rounded-full bg-white/10">
        {MEMORY_SEGMENTS.map((segment) => {
          const value = values[segment.key] ?? 0;
          if (value <= 0) return null;
          return (
            <div
              key={segment.key}
              className="h-full transition-all duration-500"
              style={{
                width: `${(value / source.total) * 100}%`,
                backgroundColor: segment.color,
              }}
              title={`${segment.label}: ${formatBytes(value)} – ${segment.hint}`}
            />
          );
        })}
      </div>

      {detailed && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {MEMORY_SEGMENTS.map((segment) => {
            const value = values[segment.key] ?? 0;
            if (value <= 0 && segment.key !== "used") return null;
            return (
              <span key={segment.key} className="flex items-center gap-1.5 text-neutral-400">
                <span
                  className="inline-block h-2 w-2 rounded-sm"
                  style={{ backgroundColor: segment.color }}
                />
                {segment.label}
                <span className="tabular-nums text-neutral-300">{formatBytes(value)}</span>
              </span>
            );
          })}
          <span className="flex items-center gap-1.5 text-neutral-400">
            <span className="inline-block h-2 w-2 rounded-sm bg-white/15" />
            Frei
            <span className="tabular-nums text-neutral-300">{formatBytes(free)}</span>
          </span>
        </div>
      )}

      {detailed && hasBreakdown && (
        <p className="mt-2 text-xs text-neutral-500">
          Cache, Puffer und Shared gibt der Kernel sofort wieder her, sobald ein Programm Speicher
          braucht – sie zählen hier nicht als belegt. Tatsächlich noch vergebbar:{" "}
          <span className="text-neutral-300">{formatBytes(source.total - source.used)}</span>.
        </p>
      )}
    </div>
  );
}
