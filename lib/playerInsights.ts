/**
 * Muster in den Spielerzahlen: Uhrzeit, Wochentag, Tagesverlauf.
 *
 * Rechnet auf den stundenweise verdichteten Messpunkten aus
 * `loadHourlyPlayers()`. Bewusst getrennt von lib/queries.ts: Uhrzeit und
 * Wochentag müssen in der Zeitzone des Netzwerks (Europe/Berlin) bestimmt
 * werden. In SQL ginge das nur über CONVERT_TZ, und dafür müssten in der
 * Datenbank die Zeitzonen-Tabellen gepflegt sein – sind sie meistens nicht.
 * Ausserdem liegen die Typen dadurch ohne MySQL-Treiber vor und lassen sich
 * auch in Client-Komponenten verwenden.
 */

/** Ein zu einer vollen Stunde verdichteter Messpunkt (UTC-Stunde). */
export type HourBucket = { t: number; avg: number; max: number; samples: number };

/** Höchststand aller Zeiten – `at` ist das ERSTE Erreichen. */
export type PlayerRecord = { players: number; at: number };

/** Datenbasis der Auswertung. */
export type StatsCoverage = { firstAt: number | null; snapshots: number };

export type HourStat = { hour: number; avg: number; max: number; samples: number };
export type WeekdayStat = { day: number; avg: number; max: number; samples: number };
export type DayStat = { day: string; avg: number; max: number };

export type PlayerPatterns = {
  /** 24 Einträge, 0 = Mitternacht. */
  byHour: HourStat[];
  /** 7 Einträge, 0 = Montag. */
  byWeekday: WeekdayStat[];
  /** [Wochentag][Stunde] – null, wo nie gemessen wurde. */
  heatmap: (number | null)[][];
  /** Ein Eintrag je Kalendertag, aufsteigend – Grundlage des Wochentrends. */
  daily: DayStat[];
  /** Ø über den ganzen Zeitraum. */
  avgOverall: number;
};

/** Antwort von /api/stats/insights. */
export type PlayerInsights = PlayerPatterns & {
  ok: boolean;
  /** Gewähltes Fenster der Muster-Auswertungen ("30d" … "all"). */
  window: string;
  /** Beginn des Fensters; bei "all" der erste Messpunkt überhaupt. */
  since: number | null;
  /** Immer über die gesamte Aufzeichnung, nie nur über das Fenster. */
  record: PlayerRecord | null;
  coverage: StatsCoverage;
  error?: string;
};

/** Kurznamen der Wochentage, passend zu `byWeekday` (0 = Montag). */
export const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"] as const;

/** Ausgeschriebene Wochentage, gleiche Reihenfolge. */
export const WEEKDAYS_LONG = [
  "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag", "Sonntag",
] as const;

const BERLIN = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Berlin",
  hour12: false,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
});

/**
 * Uhrzeit, Wochentag (0 = Montag) und Kalendertag in Berliner Zeit.
 *
 * Der Wochentag wird über einen UTC-Tag mit denselben Kalenderwerten bestimmt –
 * so hängt er nicht an der Zeitzone des Servers, auf dem die Website läuft.
 */
function berlinParts(t: number): { hour: number; weekday: number; day: string } {
  const p: Record<string, string> = {};
  for (const part of BERLIN.formatToParts(new Date(t))) p[part.type] = part.value;
  // Manche Umgebungen liefern für Mitternacht "24" statt "00".
  const hour = Number(p.hour) % 24;
  const sunday0 = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day))).getUTCDay();
  return { hour, weekday: (sunday0 + 6) % 7, day: `${p.year}-${p.month}-${p.day}` };
}

/** Auf eine Nachkommastelle – mehr täuscht bei Durchschnitten Genauigkeit vor. */
function round1(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Verdichtet die Stundenwerte zu den Mustern, die die Statistikseite zeigt.
 *
 * Gemittelt wird gewichtet nach der Anzahl der Messungen je Stunde: fällt der
 * Proxy mal für eine halbe Stunde aus, zählt diese Stunde entsprechend weniger,
 * statt gleich stark wie eine vollständig gemessene.
 */
export function buildPatterns(buckets: HourBucket[]): PlayerPatterns {
  const hourSum = new Array<number>(24).fill(0);
  const hourWeight = new Array<number>(24).fill(0);
  const hourMax = new Array<number>(24).fill(0);

  const daySum = new Array<number>(7).fill(0);
  const dayWeight = new Array<number>(7).fill(0);
  const dayMax = new Array<number>(7).fill(0);

  const cellSum = new Array<number>(7 * 24).fill(0);
  const cellWeight = new Array<number>(7 * 24).fill(0);

  const perDay = new Map<string, { sum: number; weight: number; max: number }>();

  let totalSum = 0;
  let totalWeight = 0;

  for (const b of buckets) {
    const { hour, weekday, day } = berlinParts(b.t);
    const w = b.samples > 0 ? b.samples : 1;
    const sum = b.avg * w;

    hourSum[hour] += sum;
    hourWeight[hour] += w;
    if (b.max > hourMax[hour]) hourMax[hour] = b.max;

    daySum[weekday] += sum;
    dayWeight[weekday] += w;
    if (b.max > dayMax[weekday]) dayMax[weekday] = b.max;

    const cell = weekday * 24 + hour;
    cellSum[cell] += sum;
    cellWeight[cell] += w;

    const entry = perDay.get(day) ?? { sum: 0, weight: 0, max: 0 };
    entry.sum += sum;
    entry.weight += w;
    if (b.max > entry.max) entry.max = b.max;
    perDay.set(day, entry);

    totalSum += sum;
    totalWeight += w;
  }

  const byHour: HourStat[] = hourSum.map((sum, hour) => ({
    hour,
    avg: hourWeight[hour] > 0 ? round1(sum / hourWeight[hour]) : 0,
    max: hourMax[hour],
    samples: hourWeight[hour],
  }));

  const byWeekday: WeekdayStat[] = daySum.map((sum, day) => ({
    day,
    avg: dayWeight[day] > 0 ? round1(sum / dayWeight[day]) : 0,
    max: dayMax[day],
    samples: dayWeight[day],
  }));

  const heatmap: (number | null)[][] = Array.from({ length: 7 }, (_, d) =>
    Array.from({ length: 24 }, (_, h) => {
      const cell = d * 24 + h;
      return cellWeight[cell] > 0 ? round1(cellSum[cell] / cellWeight[cell]) : null;
    })
  );

  const daily: DayStat[] = [...perDay.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([day, v]) => ({
      day,
      avg: v.weight > 0 ? round1(v.sum / v.weight) : 0,
      max: v.max,
    }));

  return {
    byHour,
    byWeekday,
    heatmap,
    daily,
    avgOverall: totalWeight > 0 ? round1(totalSum / totalWeight) : 0,
  };
}

// ─── Ableitungen für die Anzeige ────────────────────────────────────────────

/** Ab welchem Anteil des Bestwerts eine Stunde zur Primetime zählt. */
export const PRIME_THRESHOLD = 0.7;

/**
 * Das längste zusammenhängende Zeitfenster über der Primetime-Schwelle.
 *
 * Läuft bewusst über Mitternacht hinaus – ein Abend hört selten um 23:59 auf.
 * Ohne einen echten Anfang (alle Stunden über der Schwelle) gibt es kein
 * Fenster, das etwas aussagen würde.
 *
 * @param avgByHour 24 Durchschnittswerte, 0 = Mitternacht
 */
export function primeTime(avgByHour: number[]): string | null {
  if (avgByHour.length !== 24) return null;
  const peak = Math.max(...avgByHour);
  if (!Number.isFinite(peak) || peak <= 0) return null;

  const over = avgByHour.map((v) => v >= peak * PRIME_THRESHOLD);
  if (over.every(Boolean)) return "rund um die Uhr";

  let best = { start: -1, len: 0 };
  for (let start = 0; start < 24; start++) {
    // Nur an echten Anfängen ansetzen, sonst zählt dasselbe Fenster mehrfach.
    if (!over[start] || over[(start + 23) % 24]) continue;
    let len = 0;
    while (len < 24 && over[(start + len) % 24]) len++;
    if (len > best.len) best = { start, len };
  }
  if (best.len === 0) return null;

  const end = (best.start + best.len - 1) % 24;
  return `${String(best.start).padStart(2, "0")}–${String(end).padStart(2, "0")} Uhr`;
}

/** Ø der letzten sieben Tage gegen die sieben davor, als „+12,4 %". */
export function weekTrend(avgByDay: number[]): string | null {
  if (avgByDay.length < 14) return null;
  const mean = (xs: number[]) => xs.reduce((s, v) => s + v, 0) / xs.length;
  const now = mean(avgByDay.slice(-7));
  const before = mean(avgByDay.slice(-14, -7));
  if (before <= 0) return null;
  const pct = ((now - before) / before) * 100;
  return `${pct > 0 ? "+" : ""}${pct.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
}

