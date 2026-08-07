/**
 * Die beiden Volumen-Durchschnitte, nach denen sich der Preis richtet.
 *
 * Gegenstück zu `PriceCurve.averages()` im Plugin (SMPGlobal). Die Zahlen hier
 * dienen nur der Anzeige – gerechnet wird weiterhin auf dem Server. Weichen die
 * Konstanten voneinander ab, zeigt der Graph etwas anderes als das, was
 * tatsächlich passiert; sie gehören also zusammen geändert.
 *
 * Kurz über lang heißt: es wird gerade mehr verkauft als üblich, der Preis
 * sinkt. Kurz unter lang heißt: der Preis steigt. Wo sich die beiden Linien
 * kreuzen, dreht die Preiskurve.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

/** Halbwertszeit „was gerade los ist", in Tagen. */
export const HALFLIFE_SHORT_DAYS = 2.0;
/** Halbwertszeit „das übliche Niveau", in Tagen. */
export const HALFLIFE_LONG_DAYS = 14.0;
/** Ein einzelnes Tagesfenster zählt höchstens als so viel mal das übliche Niveau. */
export const OUTLIER_FACTOR = 4.0;

export type VolumePoint = { ts: string; sold: number };
/** Werte in der Einheit der Balken, also Menge JE LAUF – siehe {@link volumeAverages}. */
export type VolumeAverage = { ts: string; shortAvg: number; longAvg: number };

function alpha(dtDays: number, halflifeDays: number): number {
  return 1 - Math.pow(0.5, dtDays / halflifeDays);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Rechnet den Verlauf beider Durchschnitte über die Historie.
 *
 * Gerechnet wird intern mit Tagesmengen (das 24-Stunden-Fenster). Zurück kommen
 * die Werte aber in der Einheit der Balken, also Menge je Lauf – sonst lägen die
 * Linien bei zwei Läufen pro Tag doppelt so hoch wie die Balken darunter. Der
 * Umrechnungsfaktor stammt aus dem tatsächlichen Abstand der Läufe, nicht aus
 * einer festen Annahme; ändert sich der Takt, stimmt die Anzeige weiterhin.
 *
 * @param history Läufe in zeitlicher Reihenfolge (ts als von Date lesbarer Text)
 * @returns ein Eintrag je Lauf, dessen 24-Stunden-Fenster vollständig ist – die
 *          ersten Läufe fehlen also, sonst sähe der Anfang künstlich nach
 *          Knappheit aus. Das `ts` ist unverändert das der Eingabe, damit sich
 *          die Werte ohne Umweg an die Historie anfügen lassen. Leer, wenn die
 *          Historie keine 24 Stunden abdeckt.
 */
export function volumeAverages(history: VolumePoint[]): VolumeAverage[] {
  if (!history || history.length < 2) return [];

  const pts = history
    .map((h) => ({
      ts: h.ts,
      t: new Date(h.ts.replace(" ", "T")).getTime(),
      sold: Number(h.sold) || 0,
    }))
    .filter((p) => Number.isFinite(p.t))
    .sort((a, b) => a.t - b.t);
  if (pts.length < 2) return [];

  // Schritt 1: rollendes 24h-Fenster, auf Tagesmenge hochgerechnet.
  const first = pts[0].t;
  const roll: { ts: string; t: number; value: number }[] = [];
  let sum = 0;
  let from = 0;
  for (let i = 0; i < pts.length; i++) {
    sum += pts[i].sold;
    while (from < i && pts[from].t <= pts[i].t - DAY_MS) {
      sum -= pts[from].sold;
      from++;
    }
    if (pts[i].t - first >= DAY_MS) roll.push({ ts: pts[i].ts, t: pts[i].t, value: sum });
  }
  if (roll.length < 2) return [];

  // Wie viele Läufe kommen auf einen Tag? Aus dem üblichen Abstand der Läufe,
  // damit ein geänderter Takt die Anzeige nicht verfälscht.
  const gaps: number[] = [];
  for (let i = 1; i < pts.length; i++) {
    const g = pts[i].t - pts[i - 1].t;
    if (g > 0) gaps.push(g);
  }
  const typicalGap = median(gaps);
  const runsPerDay = typicalGap > 0 ? Math.max(1, DAY_MS / typicalGap) : 1;

  // Schritt 2: beide Durchschnitte starten auf dem Median – nicht auf einem
  // einzelnen Lauf. Genau daran ist die erste Fassung der Rechnung gescheitert.
  const seed = median(roll.map((r) => r.value));
  let shortAvg = seed;
  let longAvg = seed;

  const scale = 1 / runsPerDay; // Tagesmenge → Menge je Lauf
  const out: VolumeAverage[] = [
    { ts: roll[0].ts, shortAvg: shortAvg * scale, longAvg: longAvg * scale },
  ];

  // Schritt 3: über die Reihe laufen. Der zeitliche Abstand geht in die
  // Glättung ein, damit Lücken im Verlauf richtig gewichtet werden.
  for (let i = 1; i < roll.length; i++) {
    const dt = (roll[i].t - roll[i - 1].t) / DAY_MS;
    if (dt <= 0) continue;
    const value = Math.min(roll[i].value, longAvg * OUTLIER_FACTOR);
    shortAvg += alpha(dt, HALFLIFE_SHORT_DAYS) * (value - shortAvg);
    longAvg += alpha(dt, HALFLIFE_LONG_DAYS) * (value - longAvg);
    out.push({ ts: roll[i].ts, shortAvg: shortAvg * scale, longAvg: longAvg * scale });
  }
  return out;
}
