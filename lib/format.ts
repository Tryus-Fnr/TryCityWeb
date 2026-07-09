/** Material-Name (z.B. "OAK_LOG") in lesbaren Anzeigenamen ("Oak Log"). */
export function formatMaterialName(material: string): string {
  return material
    .toLowerCase()
    .split("_")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** Geldbetrag formatieren: 1234.5 -> "1.234,50" */
export function formatMoney(value: number): string {
  return value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Prozentwert mit Vorzeichen: 3.2 -> "+3,2 %" */
export function formatPct(value: number): string {
  const s = value.toLocaleString("de-DE", { maximumFractionDigits: 1 });
  return `${value > 0 ? "+" : ""}${s} %`;
}

/** "2026-07-13 00:00:00" -> "13.07. 00:00" */
export function formatTs(ts: string): string {
  const m = ts.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})/);
  if (!m) return ts;
  return `${m[3]}.${m[2]}. ${m[4]}:${m[5]}`;
}
