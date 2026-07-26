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

export type NewsPost = {
  id: number;
  type: NewsTypeId;
  title: string;
  summary: string;
  body: string;
  /** ANGEZEIGTER Autor – nicht zwingend der Ersteller. */
  authorName: string;
  authorUuid: string | null;
  published: boolean;
  pinned: boolean;
  imageCount: number;
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
  authorName: string;
  published: boolean;
  pinned: boolean;
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
};

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
