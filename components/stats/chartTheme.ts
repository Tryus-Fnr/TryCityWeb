/**
 * Farben und Achsen-Einstellungen der Spielerzahlen-Diagramme.
 *
 * Bewusst EIN Farbton für alles: die Diagramme zeigen durchweg dieselbe Größe
 * (Spieler), nur unterschiedlich verdichtet – verschiedene Farbtöne würden
 * Kategorien vortäuschen, die es nicht gibt. Mehr Spieler heißt heller.
 *
 * Die Stufen sind gegen die Kartenfläche geprüft (3 % Weiß auf #0a0a0b ≈
 * #111112): die dunkelste liegt dort noch bei 2,5:1 und verschwindet damit
 * nicht im Hintergrund.
 */

/** Sechs Stufen von dunkel nach hell – für die Heatmap. */
export const RAMP = ["#065f46", "#047857", "#059669", "#10b981", "#34d399", "#6ee7b7"] as const;

/** Hauptreihe: Ø Spieler. */
export const SERIES = "#10b981";

/** Hervorgehobener Bestwert – gleicher Farbton, hellere Stufe. */
export const HIGHLIGHT = "#6ee7b7";

/** Nebenreihe (Höchstwerte) – als Rahmen um die Hauptreihe, deshalb blass. */
export const SERIES_MAX = "rgba(52,211,153,0.45)";

/** Kein Wert / niemand online – knapp über der Fläche, aber noch sichtbar. */
export const EMPTY_CELL = "rgba(255,255,255,0.04)";

export const GRID = "rgba(255,255,255,0.06)";
export const AXIS_LINE = "#525252";
export const AXIS_TICK = { fill: "#737373", fontSize: 12 } as const;

export const TOOLTIP_STYLE = {
  background: "#171717",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  color: "#ededed",
} as const;

/** Durchschnitt mit einer Nachkommastelle: 14.25 → „14,3". */
export function avgLabel(value: number): string {
  return value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
}

/** „21 Uhr" – Stunden immer zweistellig, damit nichts springt. */
export function hourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")} Uhr`;
}

/** "2026-07-13" → „13.07." */
export function shortDay(day: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return m ? `${m[3]}.${m[2]}.` : day;
}

/** Zeitstempel in Millisekunden → „13.07.2026, 20:15". */
export function germanDateTime(ms: number): string {
  return new Date(ms).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin",
  });
}
