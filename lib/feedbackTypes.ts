/**
 * Typen und Grenzen für Vorschläge und Bug-Meldungen – ohne Datenbankzugriff.
 *
 * Wie bei den Neuigkeiten bewusst von `lib/feedback.ts` getrennt: die Formulare
 * und Listen laufen im Browser und dürfen den MySQL-Treiber nicht ins Bundle
 * ziehen. Serverseitig re-exportiert `lib/feedback.ts` alles hier.
 */

// ─── Vorschläge ─────────────────────────────────────────────────────────────

export const SUGGESTION_CATEGORIES = [
  { id: "smp", label: "SMP", color: "#4ADE80" },
  { id: "citybuild", label: "CityBuild", color: "#38BDF8" },
  { id: "lobby", label: "Lobby", color: "#C084FC" },
  { id: "shop", label: "Shop & Ränge", color: "#FBBF24" },
  { id: "website", label: "Website", color: "#F472B6" },
  { id: "discord", label: "Discord", color: "#818CF8" },
  { id: "sonstiges", label: "Sonstiges", color: "#A3B1C6" },
] as const;

export type SuggestionCategoryId = (typeof SUGGESTION_CATEGORIES)[number]["id"];

export function suggestionCategory(id: string) {
  return (
    SUGGESTION_CATEGORIES.find((c) => c.id === id) ??
    SUGGESTION_CATEGORIES[SUGGESTION_CATEGORIES.length - 1]
  );
}

export function isSuggestionCategory(id: string): id is SuggestionCategoryId {
  return SUGGESTION_CATEGORIES.some((c) => c.id === id);
}

/**
 * Bearbeitungsstand eines Vorschlags. Setzen darf ihn nur das Team.
 * `duplikat` verweist zusätzlich über `duplicateOf` auf den Vorschlag, der
 * dasselbe schon abdeckt.
 */
export const SUGGESTION_STATUS = [
  { id: "offen", label: "Offen", color: "#A3B1C6" },
  { id: "geplant", label: "Geplant", color: "#38BDF8" },
  { id: "umgesetzt", label: "Umgesetzt", color: "#4ADE80" },
  { id: "abgelehnt", label: "Abgelehnt", color: "#F87171" },
  { id: "duplikat", label: "Duplikat", color: "#FBBF24" },
] as const;

export type SuggestionStatusId = (typeof SUGGESTION_STATUS)[number]["id"];

export function suggestionStatus(id: string) {
  return SUGGESTION_STATUS.find((s) => s.id === id) ?? SUGGESTION_STATUS[0];
}

export function isSuggestionStatus(id: string): id is SuggestionStatusId {
  return SUGGESTION_STATUS.some((s) => s.id === id);
}

/** Ein Vorschlag samt Stimmen-Bilanz. */
export type Suggestion = {
  id: number;
  authorName: string;
  authorUuid: string;
  category: SuggestionCategoryId;
  title: string;
  body: string;
  status: SuggestionStatusId;
  /** Anmerkung des Teams zum Stand – leer, solange keine hinterlegt ist. */
  staffNote: string;
  /** Bei `status === "duplikat"`: der Vorschlag, der dasselbe abdeckt. */
  duplicateOf: number | null;
  upvotes: number;
  downvotes: number;
  /** upvotes − downvotes; danach wird „Beliebt" sortiert. */
  score: number;
  /** Eigene Stimme: 1, −1 oder 0 (keine bzw. nicht angemeldet). */
  ownVote: number;
  createdAt: string;
  updatedAt: string;
};

/** Ein Treffer der Ähnlichkeitssuche beim Tippen des Titels. */
export type SimilarSuggestion = {
  id: number;
  title: string;
  status: SuggestionStatusId;
  score: number;
  /** Ähnlichkeit 0–1; ab {@link DUPLICATE_THRESHOLD} muss bestätigt werden. */
  similarity: number;
};

// ─── Bug-Meldungen ──────────────────────────────────────────────────────────

/**
 * Prioritäten wie im Plugin (`de.leon.sMPGlobal.bug.BugBridge`) – die Website
 * schreibt in dieselbe Tabelle, in der das Admin-GUI ingame liest.
 */
export const BUG_PRIORITIES = [
  { value: 0, label: "Keine", color: "#A3B1C6" },
  { value: 1, label: "Niedrig", color: "#4ADE80" },
  { value: 2, label: "Mittel", color: "#FBBF24" },
  { value: 3, label: "Hoch", color: "#F87171" },
] as const;

export function bugPriority(value: number) {
  return BUG_PRIORITIES.find((p) => p.value === value) ?? BUG_PRIORITIES[0];
}

/** Ein Bug-Report. Sichtbar nur für den Melder selbst und für das Team. */
export type BugReport = {
  id: number;
  reporterUuid: string;
  reporterName: string;
  title: string;
  description: string;
  priority: number;
  /** 0 = offen, 1 = erledigt (Spaltenwerte des Plugins). */
  status: number;
  /** ids der Bilder; die Daten kommen über /api/bugs/image/<id>. */
  imageIds: number[];
  createdAt: string;
};

// ─── Grenzen ────────────────────────────────────────────────────────────────

/**
 * Grenzen für alles, was Spieler selbst eintippen.
 *
 * Anders als bei den Neuigkeiten schreibt hier nicht das Team, sondern jeder
 * angemeldete Spieler – die Werte werden deshalb serverseitig erzwungen und im
 * Formular nur noch angezeigt. Die Titel-Längen entsprechen den Spalten
 * (`smpg_suggestions.title` VARCHAR(120), `smpg_bugs.title` VARCHAR(64)).
 */
export const FEEDBACK_LIMITS = {
  suggestionTitleMin: 8,
  suggestionTitleMax: 120,
  suggestionBodyMin: 10,
  suggestionBodyMax: 2_000,

  bugTitleMin: 8,
  bugTitleMax: 64,
  bugBodyMin: 20,
  bugBodyMax: 4_000,

  /** Bilder nur bei Bug-Meldungen – ein Vorschlag ist Text. */
  bugImages: 3,
  /** Base64-Länge je Bild (≈ 660 KB Rohdaten nach dem Verkleinern im Browser). */
  bugImageData: 900_000,
  /** Kantenlänge, auf die der Browser vor dem Hochladen herunterrechnet. */
  bugImageEdge: 1_600,
  /**
   * Obergrenze für die Bildpunkte (≈ 4000 × 3000).
   *
   * Der Browser liefert nach dem Verkleinern höchstens 1600 × 1600 – diese
   * Grenze gilt also nur für Anfragen, die jemand von Hand baut. Sie fängt den
   * Fall ab, dass eine winzige Datei beim Anzeigen ein riesiges Bild aufspannt.
   */
  bugImagePixels: 12_000_000,

  /** Anmerkung des Teams an einem Vorschlag. */
  staffNote: 500,
} as const;

/**
 * Wie viel eine Person pro Tag einreichen darf.
 *
 * Gezählt wird in der Datenbank über die letzten 24 Stunden – ein
 * Neustart der Website setzt das also nicht zurück, anders als das
 * In-Memory-Rate-Limit, das nur die Klick-Salven abfängt.
 */
export const FEEDBACK_QUOTA = {
  suggestionsPerDay: 5,
  bugsPerDay: 10,
  /** Mindestabstand zwischen zwei Einreichungen derselben Person. */
  cooldownSeconds: 60,
} as const;

/** "2026-07-26 10:30:00" → "26.07.2026" */
export function germanDate(ts: string): string {
  if (!ts || ts.length < 10) return ts ?? "";
  const [y, m, d] = ts.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : ts.slice(0, 10);
}

/** "2026-07-26 10:30:00" → "26.07.2026, 10:30" */
export function germanDateTime(ts: string): string {
  if (!ts || ts.length < 16) return germanDate(ts);
  return `${germanDate(ts)}, ${ts.slice(11, 16)}`;
}
