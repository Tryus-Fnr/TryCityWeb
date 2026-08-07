/**
 * Deutsche Item-Suche – dieselbe Logik wie ingame.
 *
 * Das Gegenstück im Plugin ist `ItemNames.java` in TryusCloudGlobalServer.
 * Beide arbeiten mit derselben Sprachdatei `lang/de_de.json`; hier liegt sie
 * unter `lib/lang/de_de.json`. Nach einem Minecraft-Update muss dieselbe Datei
 * in beide Projekte, sonst weichen die Suchergebnisse voneinander ab.
 *
 * Diese Datei enthält bewusst nur reine Funktionen ohne die Sprachdatei – sie
 * läuft dadurch auch im Browser, ohne dass 160 KB JSON mitgeliefert werden
 * müssen. Den deutschen Namen liefert der Server über die Item-Schnittstelle
 * mit; siehe `itemNames.server.ts`.
 */

/**
 * Vereinheitlicht Text für den Vergleich: Kleinschreibung, Umlaute
 * ausgeschrieben (ä→ae), Trenner werden Leerzeichen.
 *
 * Wer „Bruecke" tippt, findet damit „Brücke".
 */
export function normalize(input: string | null | undefined): string {
  return normalizeInternal(input, true);
}

/**
 * Wie {@link normalize}, aber Umlaute werden nur auf den Grundvokal reduziert
 * (ä→a). Diese zweite Form landet zusätzlich im Suchtext, damit auch „brucke"
 * ganz ohne Umlaut-Schreibweise noch „Brücke" findet.
 */
export function normalizeSimple(input: string | null | undefined): string {
  return normalizeInternal(input, false);
}

function normalizeInternal(input: string | null | undefined, expandUmlauts: boolean): string {
  if (!input) return "";
  const lower = input.toLowerCase();
  let out = "";
  for (const c of lower) {
    switch (c) {
      case "ä": out += expandUmlauts ? "ae" : "a"; break;
      case "ö": out += expandUmlauts ? "oe" : "o"; break;
      case "ü": out += expandUmlauts ? "ue" : "u"; break;
      case "ß": out += "ss"; break;
      case "_":
      case "-":
      case ".":
      case ",":
      case "'":
      case "’":
      case "(":
      case ")":
        out += " ";
        break;
      default: out += c;
    }
  }
  return out.trim().replace(/ +/g, " ");
}

/**
 * Baut den Suchtext für ein Item: deutscher Name in beiden Umlaut-Schreibweisen
 * plus der Material-Name, der die englische Suche abdeckt
 * („oak planks" → OAK_PLANKS).
 */
export function buildHaystack(material: string, germanName?: string | null): string {
  const parts: string[] = [];
  if (germanName) {
    const expanded = normalize(germanName);
    const simple = normalizeSimple(germanName);
    parts.push(expanded);
    if (simple !== expanded) parts.push(simple);
  }
  parts.push(normalize(material));
  return parts.join(" ");
}

/**
 * Passt die Suchanfrage auf diesen Suchtext?
 *
 * Mehrere Wörter werden UND-verknüpft und dürfen in beliebiger Reihenfolge
 * stehen: „holz eichen" findet also „Eichenholzbretter".
 *
 * @param haystack aus {@link buildHaystack}
 * @param query    rohe Eingabe; leer passt immer
 */
export function matchesHaystack(haystack: string, query: string): boolean {
  if (!query || !query.trim()) return true;
  for (const token of normalize(query).split(" ")) {
    if (!token) continue;
    if (!haystack.includes(token)) return false;
  }
  return true;
}

/** Englischer Name aus dem Material-Namen: `OAK_PLANKS` → „Oak Planks". */
export function englishName(material: string): string {
  return material
    .toLowerCase()
    .split("_")
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}
