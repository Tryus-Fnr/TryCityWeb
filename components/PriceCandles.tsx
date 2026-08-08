import type { SparklinePoint } from "@/lib/queries";

const UP = "#34d399";
const DOWN = "#f87171";
const FLAT = "#6b7280";

/** Eine Tageskerze: Eröffnung, Hoch, Tief, Schluss. */
type Candle = { day: string; open: number; high: number; low: number; close: number };

/**
 * Fasst die einzelnen Anpassungsläufe zu Tageskerzen zusammen.
 *
 * Eröffnung ist der Preis des ersten Laufs des Tages, Schluss der des letzten;
 * Hoch und Tief die Spannweite dazwischen. Bei den üblichen zwei Läufen pro Tag
 * fallen Docht und Körper zusammen – ein Docht wird nur sichtbar, wenn an dem
 * Tag zusätzlich von Hand angepasst wurde.
 */
export function toCandles(points: SparklinePoint[]): Candle[] {
  const byDay = new Map<string, number[]>();
  for (const p of points) {
    const day = p.ts.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(p.price);
    else byDay.set(day, [p.price]);
  }
  const all = [...byDay.entries()].map(([day, prices]) => ({
    day,
    open: prices[0],
    close: prices[prices.length - 1],
    high: Math.max(...prices),
    low: Math.min(...prices),
  }));
  // 14 Läufe verteilen sich über 8 Kalendertage, weil der älteste angebrochen
  // ist. Der wird abgeschnitten – sonst stünden acht Kerzen unter „7 Tage".
  return all.slice(-7);
}

/**
 * Kerzenchart der letzten 7 Tage – eine Kerze je Tag.
 *
 * Grün, wenn der Tag höher geschlossen hat als er eröffnet wurde, sonst rot;
 * ein Tag ohne Bewegung bleibt grau. Wird auf der Item-Übersicht und unter
 * „Ähnliche Items" verwendet, damit beide dasselbe zeigen.
 *
 * Enthält keine Hooks und läuft deshalb auch in Server-Komponenten.
 */
export default function PriceCandles({
  points,
  className = "",
  label = "7 Tage",
}: {
  points: SparklinePoint[];
  className?: string;
  label?: string;
}) {
  const candles = toCandles(points);
  if (candles.length === 0) return null;

  const W = 160;
  const H = 36;
  const PAD = 3;

  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const range = max - min || 1;
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - 2 * PAD);

  // Feste Breite je Tag: fehlt ein Tag, bleibt seine Lücke sichtbar, statt dass
  // die übrigen Kerzen auseinandergezogen werden.
  const slot = W / Math.max(candles.length, 7);
  const bodyW = Math.max(4, slot * 0.7);

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        role="img"
        aria-label={`Preisverlauf der letzten ${candles.length} Tage als Tageskerzen`}
      >
        {candles.map((c, i) => {
          const cx = i * slot + slot / 2;
          const moved = Math.abs(c.close - c.open) > 1e-9;
          const color = !moved ? FLAT : c.close > c.open ? UP : DOWN;

          const yOpen = y(c.open);
          const yClose = y(c.close);
          const top = Math.min(yOpen, yClose);
          // Ein Tag ohne Bewegung bekommt einen flachen Strich, sonst wäre er
          // gar nicht zu sehen und die Lücke sähe aus wie fehlende Daten.
          const height = moved ? Math.abs(yClose - yOpen) : 2;

          // Docht nur zeichnen, wenn er über den Körper hinausragt – bei zwei
          // Läufen am Tag ist das nie der Fall, bei Handanpassungen schon.
          const hasWick =
            c.high > Math.max(c.open, c.close) + 1e-9 ||
            c.low < Math.min(c.open, c.close) - 1e-9;

          return (
            <g key={c.day}>
              {hasWick && (
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(c.high)}
                  y2={y(c.low)}
                  stroke={color}
                  strokeWidth="1"
                  opacity={0.75}
                />
              )}
              <rect
                x={cx - bodyW / 2}
                y={moved ? top : top - 1}
                width={bodyW}
                height={height}
                fill={color}
                rx={1}
              />
            </g>
          );
        })}
      </svg>
      <span className="pointer-events-none absolute right-0 top-0 text-[9px] leading-none text-neutral-600">
        {label}
      </span>
    </div>
  );
}
