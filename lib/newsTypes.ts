/**
 * Typen und Hilfsfunktionen rund um Neuigkeiten – ohne Datenbankzugriff.
 *
 * Bewusst getrennt von `lib/news.ts`: Client-Komponenten (Editor, Filterliste,
 * Karten) brauchen diese Definitionen, dürfen aber den MySQL-Treiber nicht ins
 * Browser-Bundle ziehen. Serverseitig re-exportiert `lib/news.ts` alles hier.
 */

/** Muss mit `de.leon.sMPGlobal.news.NewsType` übereinstimmen. */
export const NEWS_TYPES = [
  { id: "update", label: "Update", color: "#4FA3D9" },
  { id: "info", label: "Info", color: "#A3B1C6" },
  { id: "bugfix", label: "Bugfix", color: "#4ADE80" },
  { id: "bug", label: "Bekannter Bug", color: "#F87171" },
  { id: "wartung", label: "Wartung", color: "#FBBF24" },
  { id: "event", label: "Event", color: "#C084FC" },
  { id: "ankuendigung", label: "Ankündigung", color: "#FB923C" },
] as const;

export type NewsTypeId = (typeof NEWS_TYPES)[number]["id"];

export function newsType(id: string) {
  return NEWS_TYPES.find((t) => t.id === id) ?? NEWS_TYPES[1];
}

export function isNewsType(id: string): id is NewsTypeId {
  return NEWS_TYPES.some((t) => t.id === id);
}

/**
 * Erlaubte Reaktionen auf einen Beitrag – nur auf der Website, ingame gibt es
 * dafür nichts. Die Liste ist bewusst fest: sie wird auch serverseitig geprüft,
 * damit über die Schnittstelle nichts Beliebiges in der Datenbank landet.
 */
export const REACTIONS = ["🔥", "😍", "😳", "🤮", "💩"] as const;
export type Reaction = (typeof REACTIONS)[number];

export function isReaction(v: string): v is Reaction {
  return (REACTIONS as readonly string[]).includes(v);
}

/** Anzahl je Emoji, absteigend sortiert. */
export type ReactionCount = { emoji: string; count: number };

/** Ein Verfasser eines Beitrags. */
export type NewsAuthor = {
  name: string;
  /** Für den Skin-Render; null, wenn der Name nicht bekannt ist. */
  uuid: string | null;
};

export type NewsPost = {
  id: number;
  type: NewsTypeId;
  title: string;
  summary: string;
  body: string;
  /**
   * HAUPTAUTOR – nicht zwingend der Ersteller. Steht auch ingame so da; die
   * Spalte fasst nur einen Namen (VARCHAR(16)).
   */
  authorName: string;
  authorUuid: string | null;
  /**
   * Alle Verfasser, Hauptautor zuerst. Beiträge von vor der Mehrfach-Autoren-
   * Umstellung haben hier genau einen Eintrag.
   */
  authors: NewsAuthor[];
  published: boolean;
  pinned: boolean;
  /**
   * Artikel-Modus: Zeilen mit führenden Rauten werden im Web zu Überschriften.
   * Aus für Beiträge, in denen die Raute einfach ein Zeichen sein soll.
   * Ingame spielt das keine Rolle – dort steht sie ohnehin als Text da.
   */
  markdown: boolean;
  imageCount: number;
  /**
   * id des ersten Bildes für Vorschaubild und Aufmacher, oder null.
   * Die Bilddaten kommen über /api/news/image/<id> – in der Liste selbst wären
   * sie viel zu schwer.
   */
  coverId: number | null;
  /** Reaktionen, häufigste zuerst. In der Übersicht werden die ersten zwei gezeigt. */
  reactions: ReactionCount[];
  createdAt: string;
  updatedAt: string;
};

export type NewsImage = {
  id: number;
  postId: number;
  idx: number;
  mime: string;
  caption: string;
  /** Base64 ohne `data:`-Präfix. */
  data: string;
};

/** Bild-Eingabe beim Speichern (ohne feste id). */
export type NewsImageInput = {
  idx: number;
  mime: string;
  caption: string;
  data: string;
};

export type NewsInput = {
  type: NewsTypeId;
  title: string;
  summary: string;
  body: string;
  /** Alle Verfasser in Anzeigereihenfolge; der erste wird der Hauptautor. */
  authorNames: string[];
  published: boolean;
  pinned: boolean;
  markdown: boolean;
  images: NewsImageInput[];
};

/** Grenzen, damit ein Beitrag die Datenbank nicht sprengt. */
export const LIMITS = {
  title: 128,
  summary: 256,
  body: 60_000,
  /** Base64-Länge je Bild (≈ 2 MB Rohdaten). */
  imageData: 2_800_000,
  images: 12,
  authors: 6,
};

/** „JulcoYT" · „JulcoYT, Gebuildet" · „A, B und C" */
export function authorLine(authors: NewsAuthor[] | undefined, fallback = ""): string {
  const names = (authors ?? []).map((a) => a.name).filter(Boolean);
  if (names.length === 0) return fallback;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(", ")} und ${names[names.length - 1]}`;
}

/** "2026-07-26 10:30:00" → "26.07.2026". */
export function germanDate(ts: string): string {
  if (!ts || ts.length < 10) return ts ?? "";
  const [y, m, d] = ts.slice(0, 10).split("-");
  return d && m && y ? `${d}.${m}.${y}` : ts.slice(0, 10);
}

/**
 * Ganzkörper-Skin-Render im Mojavatar-Stil (wie in Minecraft-Foren-Posts).
 * Fällt auf mc-heads zurück, falls der Dienst nicht antwortet – das übernimmt
 * die Komponente per `onError`.
 */
export function mojavatarUrl(name: string): string {
  return `https://starlightskins.lunareclipse.studio/render/mojavatar/${encodeURIComponent(
    name
  )}/bust`;
}

export function avatarFallbackUrl(name: string): string {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/128`;
}
