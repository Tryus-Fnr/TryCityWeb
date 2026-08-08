import { hasWick, toCandles } from "@/lib/candles";
import type { SparklinePoint } from "@/lib/queries";

const UP = "#34d399";
const DOWN = "#f87171";
const FLAT = "#6b7280";

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

          // Docht nur zeichnen, wenn er über den Körper hinausragt.
          const wick = hasWick(c);

          return (
            <g key={c.day}>
              {(wick.top || wick.bottom) && (
                <line
                  x1={cx}
                  x2={cx}
                  y1={y(c.high)}
                  y2={y(c.low)}
                  stroke={color}
                  strokeWidth="1"
                  strokeLinecap="round"
                  opacity={0.85}
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
      {/* Leeres Label heißt: der Zeitraum steht schon woanders. Auf der
          Item-Übersicht sagt ihn die Legende einmal für alle Karten. */}
      {label && (
        <span className="pointer-events-none absolute right-0 top-0 text-[9px] leading-none text-neutral-600">
          {label}
        </span>
      )}
    </div>
  );
}
