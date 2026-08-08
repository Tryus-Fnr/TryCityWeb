import type { SparklinePoint } from "@/lib/queries";

/** Eine Tageskerze: Eröffnung, Hoch, Tief, Schluss. */
export type Candle = { day: string; open: number; high: number; low: number; close: number };

/** Wie viele Tageskerzen die Vorschau zeigt. */
export const CANDLE_DAYS = 7;

/**
 * Fasst die einzelnen Anpassungsläufe zu Tageskerzen zusammen.
 *
 * Eröffnung ist der SCHLUSSKURS DES VORTAGS, nicht der erste Preis des Tages
 * selbst – so wie an einer Börse. Das hat zwei Gründe:
 *
 *  - Die Kerze deckt damit die volle Bewegung von einem Tagesende zum nächsten
 *    ab. Vorher fiel der Sprung zwischen dem letzten Lauf des Vortags und dem
 *    ersten des Folgetags aus der Darstellung heraus.
 *  - Erst dadurch gibt es überhaupt Dochte: bei zwei Läufen am Tag hat eine
 *    Kerze sonst nur zwei Punkte, und dann sind Hoch und Tief zwangsläufig
 *    identisch mit Eröffnung und Schluss. Mit dem Vortagesschluss sind es drei,
 *    und ein Zwischenhoch oder -tief ragt sichtbar aus dem Körper heraus.
 */
export function toCandles(points: SparklinePoint[]): Candle[] {
  const byDay = new Map<string, number[]>();
  for (const p of points) {
    const day = p.ts.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(p.price);
    else byDay.set(day, [p.price]);
  }

  const all: Candle[] = [];
  let prevClose: number | null = null;
  for (const [day, prices] of byDay) {
    // Am ältesten Tag fehlt der Vortag – dort bleibt es beim ersten Preis.
    const open = prevClose ?? prices[0];
    const span = [open, ...prices];
    all.push({
      day,
      open,
      close: prices[prices.length - 1],
      high: Math.max(...span),
      low: Math.min(...span),
    });
    prevClose = prices[prices.length - 1];
  }

  // 14 Läufe verteilen sich über 8 Kalendertage, weil der älteste angebrochen
  // ist. Der wird abgeschnitten – sonst stünden acht Kerzen unter „7 Tage".
  // Nebeneffekt: die erste angezeigte Kerze hat dann auch einen Vortag.
  return all.slice(-CANDLE_DAYS);
}

/** Ragt der Docht über den Körper hinaus? Ohne das gäbe es nichts zu zeichnen. */
export function hasWick(c: Candle): { top: boolean; bottom: boolean } {
  return {
    top: c.high > Math.max(c.open, c.close) + 1e-9,
    bottom: c.low < Math.min(c.open, c.close) - 1e-9,
  };
}
