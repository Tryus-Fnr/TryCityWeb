/**
 * Textähnlichkeit für die Duplikat-Suche bei Vorschlägen.
 *
 * Bewusst ohne KI. Die Suche läuft, während jemand den Titel tippt – ein
 * Modell-Aufruf pro Tastenanschlag wäre langsam, kostet Geld und wäre bei
 * „Mehr Spawner" gegen „mehr spawner bitte" auch nicht klüger als das hier.
 * Gerechnet wird in zwei Ebenen:
 *
 *  1. **Trigramme** über den normalisierten Text. Fängt Tippfehler, Beugungen
 *     und zusammengeschriebene Wörter ab („Enderchest" ↔ „Ender Chest").
 *  2. **Wortstämme**. Fängt umgestellte Sätze ab, die als Trigramm-Kette weit
 *     auseinanderliegen („Shop für Spawner" ↔ „Spawner im Shop verkaufen").
 *
 * Beides zusammen liegt bei ein paar tausend Titeln im Mikrosekunden-Bereich –
 * die Titel werden einmal vorbereitet (siehe {@link prepare}) und danach nur
 * noch Mengen geschnitten.
 */

/** Umlaute vor der Akzent-Zerlegung ersetzen, sonst wird aus „ä" ein „a". */
const UMLAUTS: Record<string, string> = { ä: "ae", ö: "oe", ü: "ue", ß: "ss" };

/**
 * Wörter, die in fast jedem Vorschlag stehen und deshalb nichts über den
 * Inhalt aussagen. Sie fliegen nur aus dem Wortvergleich – in den Trigrammen
 * bleiben sie drin, dort stören sie nicht.
 */
const STOPWORDS = new Set([
  // Vorschlags-Floskeln
  "idee", "vorschlag", "vorschlaege", "bitte", "waere", "waer", "cool", "gut",
  "besser", "toll", "nice", "moeglich", "moechte", "wuensche", "wunsch",
  "koennte", "koennen", "kann", "sollte", "sollen", "soll", "muss", "muesste",
  "machen", "macht", "gibt", "geben", "haben", "hat", "brauchen", "braucht",
  "neue", "neuer", "neues", "neu", "mehr", "weniger", "eigene", "eigenes",
  "server", "trycity",
  // Füllwörter
  "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
  "einer", "und", "oder", "aber", "auch", "noch", "schon", "nur", "mal",
  "fuer", "mit", "ohne", "vom", "von", "bei", "beim", "zum", "zur", "aus",
  "auf", "ins", "in", "im", "an", "am", "als", "wie", "wenn", "dass", "das",
  "ist", "sind", "war", "wird", "werden", "man", "ich", "wir", "ihr", "du",
  "es", "sie", "er", "nicht", "kein", "keine", "so", "sehr", "the", "a", "an",
  "for", "and", "with", "more",
]);

/**
 * Kleinbuchstaben, keine Umlaute, keine Satzzeichen.
 *
 * Wird auch beim Speichern verwendet (`title_norm`), damit die Suche später
 * nicht jedes Mal alle Titel neu putzen muss.
 */
export function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => UMLAUTS[c] ?? c)
    // é → e, ñ → n … alles was danach noch an Akzenten übrig ist
    .normalize("NFD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Sehr grober deutscher Wortstamm: schneidet die häufigen Endungen ab.
 *
 * Kein echter Stemmer und soll auch keiner sein – er muss nur „Spawner",
 * „Spawnern" und „Spawners" auf denselben Klotz bringen. Kurze Wörter bleiben
 * unangetastet, sonst wird aus „ende" ein „end" und aus „eis" ein „ei".
 */
function stem(token: string): string {
  if (token.length > 7) {
    for (const suffix of ["ungen", "chen", "lein", "ung", "heit", "keit"]) {
      if (token.endsWith(suffix)) return token.slice(0, -suffix.length);
    }
  }
  if (token.length > 5) {
    for (const suffix of ["ern", "est", "end", "en", "er", "es", "em"]) {
      if (token.endsWith(suffix)) return token.slice(0, -suffix.length);
    }
  }
  if (token.length > 4) {
    for (const suffix of ["st", "n", "s", "e"]) {
      if (token.endsWith(suffix)) return token.slice(0, -suffix.length);
    }
  }
  return token;
}

/**
 * Die aussagekräftigen Wortstämme eines Titels.
 *
 * Bleibt nach dem Aussortieren nichts übrig (Titel besteht nur aus Floskeln),
 * werden alle Wörter genommen – eine leere Menge würde sonst zu jedem anderen
 * Titel „passen".
 */
function contentTokens(norm: string): Set<string> {
  const all = norm.split(" ").filter((t) => t.length >= 2);
  const kept = all.filter((t) => !STOPWORDS.has(t));
  const use = kept.length > 0 ? kept : all;
  return new Set(use.map(stem));
}

/** Zeichen-Trigramme mit Rand-Polsterung, damit Wortanfänge mitzählen. */
function trigrams(norm: string): Set<string> {
  const padded = `  ${norm} `;
  const out = new Set<string>();
  for (let i = 0; i + 3 <= padded.length; i++) out.add(padded.slice(i, i + 3));
  return out;
}

/** Ein für den Vergleich vorbereiteter Titel. */
export type PreparedTitle = {
  norm: string;
  tokens: Set<string>;
  grams: Set<string>;
};

/**
 * Bereitet einen Titel einmal auf. Für die gespeicherten Vorschläge passiert
 * das im Index (siehe `lib/feedback.ts`), für die Eingabe einmal pro Anfrage.
 */
export function prepare(title: string, normalized?: string): PreparedTitle {
  const norm = normalized && normalized.length > 0 ? normalized : normalizeText(title);
  return { norm, tokens: contentTokens(norm), grams: trigrams(norm) };
}

function intersectionSize<T>(a: Set<T>, b: Set<T>): number {
  // Immer über die kleinere Menge laufen – bei 3 gegen 40 Trigramme spart das
  // gut eine Größenordnung.
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  let n = 0;
  for (const v of small) if (big.has(v)) n++;
  return n;
}

/**
 * Ähnlichkeit zweier Titel als Wert zwischen 0 und 1.
 *
 * Die Gewichtung stammt aus dem Abgleich an echten Titeln: der Wortvergleich
 * wiegt etwas schwerer, weil er inhaltlich trifft, die Trigramme fangen dafür
 * das ab, wovon er nichts weiß (Tippfehler, Zusammenschreibung).
 */
export function similarity(a: PreparedTitle, b: PreparedTitle): number {
  if (a.norm.length === 0 || b.norm.length === 0) return 0;
  if (a.norm === b.norm) return 1;

  const gramHits = intersectionSize(a.grams, b.grams);
  const dice = (2 * gramHits) / (a.grams.size + b.grams.size);

  const tokenHits = intersectionSize(a.tokens, b.tokens);
  const union = a.tokens.size + b.tokens.size - tokenHits;
  const jaccard = union > 0 ? tokenHits / union : 0;
  // Enthaltensein: „Spawner Shop" steckt vollständig in „Spawner Shop in der
  // Lobby bauen". Ohne das rutscht der längere Titel bei Jaccard durch.
  const containment = tokenHits / Math.min(a.tokens.size, b.tokens.size);
  const tokenScore = 0.5 * jaccard + 0.5 * containment;

  let score = 0.45 * dice + 0.55 * tokenScore;

  // Steht der eine Titel wörtlich im anderen, ist es unabhängig von der
  // Rechnung ein Treffer – „Enderchest erweitern" in „Enderchest erweitern für
  // alle Ränge".
  const short = a.norm.length <= b.norm.length ? a.norm : b.norm;
  const long = a.norm.length <= b.norm.length ? b.norm : a.norm;
  if (short.length >= 6 && long.includes(short)) score = Math.max(score, 0.85);

  return Math.min(1, score);
}

/**
 * Ab hier gilt ein Vorschlag als so ähnlich, dass er beim Absenden ausdrücklich
 * bestätigt werden muss. Bewusst hoch angesetzt: lieber ein Duplikat zu viel
 * als jemanden, der seinen Vorschlag nicht loswird.
 */
export const DUPLICATE_THRESHOLD = 0.82;

/** Ab hier wird ein Vorschlag beim Tippen als möglicher Treffer angezeigt. */
export const SUGGEST_THRESHOLD = 0.34;
