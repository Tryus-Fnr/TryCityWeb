import type mysql from "mysql2/promise";
import { exec, query, db } from "@/lib/db";
import {
  isNewsType,
  newsType,
  LIMITS,
  type NewsAuthor,
  type NewsImage,
  type ReactionCount,
  type NewsImageInput,
  type NewsInput,
  type NewsPost,
} from "@/lib/newsTypes";

/**
 * Neuigkeiten (Updates, Infos, Bugs …).
 *
 * Beiträge werden ausschließlich hier im Admin-Bereich geschrieben und vom
 * SMPGlobal-Plugin (Paket `de.leon.sMPGlobal.news`) nur gelesen – ingame gibt
 * es bewusst keinen Befehl zum Anlegen.
 *
 * Der Beitragstext liegt im ColorUtil-Format (`&`-Codes, `&#RRGGBB`,
 * `<#RRGGBB>`, `<gradient:#a:#b>…</gradient>`), damit Web und Spiel dieselbe
 * Quelle rendern. Bilder stehen als `[img:N]` im Text; die Daten selbst liegen
 * base64-kodiert in `smpg_news_images` und werden ingame nicht dargestellt.
 */

// ─── Typen ──────────────────────────────────────────────────────────────────
// Die reinen Definitionen liegen in lib/newsTypes.ts, damit Client-Komponenten
// sie nutzen können, ohne den MySQL-Treiber ins Browser-Bundle zu ziehen.
export * from "@/lib/newsTypes";

// ─── Zeilen aus der DB abbilden ─────────────────────────────────────────────

type Row = {
  id: number;
  type: string;
  title: string;
  summary: string | null;
  body: string | null;
  author_name: string;
  author_uuid: string | null;
  published: number;
  pinned: number;
  markdown: number | null;
  image_count: number;
  cover_id: number | null;
  created_at: string;
  updated_at: string;
};

function mapRow(r: Row): NewsPost {
  return {
    id: Number(r.id),
    type: newsType(r.type).id,
    title: r.title,
    summary: r.summary ?? "",
    body: r.body ?? "",
    authorName: r.author_name,
    authorUuid: r.author_uuid,
    // Wird von attachAuthors() nachgereicht; bis dahin steht hier der
    // Hauptautor, damit ein Beitrag nie ganz ohne Verfasser dasteht.
    authors: [{ name: r.author_name, uuid: r.author_uuid }],
    published: Number(r.published) === 1,
    pinned: Number(r.pinned) === 1,
    // Fehlt die Spalte noch (Plugin lief seit dem Update nicht), gilt der
    // Artikel-Modus als an – so wie er für neue Beiträge voreingestellt ist.
    markdown: r.markdown === null || r.markdown === undefined ? true : Number(r.markdown) === 1,
    imageCount: Number(r.image_count ?? 0),
    coverId: r.cover_id !== null && r.cover_id !== undefined ? Number(r.cover_id) : null,
    // Wird von attachReactions() nachgereicht.
    reactions: [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Zählt die Reaktionen zu mehreren Beiträgen in EINER Abfrage nach.
 * Fehlt die Tabelle noch, bleibt es bei leeren Listen – die Seite lädt trotzdem.
 */
async function attachReactions(posts: NewsPost[]): Promise<NewsPost[]> {
  if (posts.length === 0) return posts;
  try {
    const ids = posts.map((p) => p.id);
    const rows = await query<{ post_id: number; emoji: string; n: string }>(
      `SELECT post_id, emoji, COUNT(*) AS n
       FROM smpg_news_reactions
       WHERE post_id IN (${ids.map(() => "?").join(",")})
       GROUP BY post_id, emoji
       ORDER BY post_id ASC, n DESC, emoji ASC`,
      ids
    );
    if (rows.length === 0) return posts;
    const byPost = new Map<number, ReactionCount[]>();
    for (const r of rows) {
      const list = byPost.get(Number(r.post_id)) ?? [];
      list.push({ emoji: r.emoji, count: Number(r.n) });
      byPost.set(Number(r.post_id), list);
    }
    for (const p of posts) p.reactions = byPost.get(p.id) ?? [];
    return posts;
  } catch {
    return posts;
  }
}

/** Reaktionen eines Beitrags plus die eigene, falls angemeldet. */
export async function loadPostReactions(
  postId: number,
  uuid: string | null
): Promise<{ counts: ReactionCount[]; own: string | null }> {
  try {
    const [counts, mine] = await Promise.all([
      query<{ emoji: string; n: string }>(
        `SELECT emoji, COUNT(*) AS n FROM smpg_news_reactions
         WHERE post_id = ? GROUP BY emoji ORDER BY n DESC, emoji ASC`,
        [postId]
      ),
      uuid
        ? query<{ emoji: string }>(
            `SELECT emoji FROM smpg_news_reactions WHERE post_id = ? AND uuid = ? LIMIT 1`,
            [postId, uuid]
          )
        : Promise.resolve([]),
    ]);
    return {
      counts: counts.map((r) => ({ emoji: r.emoji, count: Number(r.n) })),
      own: mine.length > 0 ? mine[0].emoji : null,
    };
  } catch {
    return { counts: [], own: null };
  }
}

/**
 * Setzt, ändert oder entfernt die Reaktion eines Spielers.
 *
 * `emoji === null` nimmt sie zurück. Da (post_id, uuid) der Primärschlüssel
 * ist, ersetzt ein erneutes Setzen die vorherige – mehr als eine Reaktion je
 * Person und Beitrag kann so gar nicht entstehen.
 */
export async function setPostReaction(
  postId: number,
  uuid: string,
  emoji: string | null
): Promise<void> {
  if (emoji === null) {
    await exec(`DELETE FROM smpg_news_reactions WHERE post_id = ? AND uuid = ?`, [postId, uuid]);
    return;
  }
  await exec(
    `INSERT INTO smpg_news_reactions (post_id, uuid, emoji) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE emoji = VALUES(emoji), created_at = CURRENT_TIMESTAMP`,
    [postId, uuid, emoji]
  );
}

/**
 * Lädt die Verfasser zu mehreren Beiträgen in EINER Abfrage nach.
 *
 * Beiträge, die vor der Umstellung entstanden sind, haben keine Zeilen in
 * `smpg_news_authors` – dort bleibt es beim Hauptautor aus `mapRow`.
 */
async function attachAuthors(posts: NewsPost[]): Promise<NewsPost[]> {
  if (posts.length === 0) return posts;
  try {
    const ids = posts.map((p) => p.id);
    const rows = await query<{ post_id: number; name: string; uuid: string | null }>(
      `SELECT post_id, name, uuid FROM smpg_news_authors
       WHERE post_id IN (${ids.map(() => "?").join(",")})
       ORDER BY post_id ASC, idx ASC`,
      ids
    );
    if (rows.length === 0) return posts;
    const byPost = new Map<number, NewsAuthor[]>();
    for (const r of rows) {
      const list = byPost.get(Number(r.post_id)) ?? [];
      list.push({ name: r.name, uuid: r.uuid });
      byPost.set(Number(r.post_id), list);
    }
    for (const p of posts) {
      const list = byPost.get(p.id);
      if (list && list.length > 0) p.authors = list;
    }
    return posts;
  } catch {
    // Tabelle fehlt noch (Plugin lief seit dem Update nicht) – Hauptautor reicht.
    return posts;
  }
}

// Die Bilddaten selbst (base64 in LONGTEXT) bleiben hier bewusst außen vor –
// bei zwölf Beiträgen wären das schnell mehrere Megabyte. Für die Karten wird
// nur die id des ersten Bildes mitgeladen; ausgeliefert wird es über
// /api/news/image/<id>.
const SELECT_POST = `
  SELECT n.*,
         (SELECT COUNT(*) FROM smpg_news_images i WHERE i.post_id = n.id) AS image_count,
         (SELECT i2.id FROM smpg_news_images i2 WHERE i2.post_id = n.id
           ORDER BY i2.idx ASC, i2.id ASC LIMIT 1) AS cover_id
  FROM smpg_news n`;

// ─── Lesen ──────────────────────────────────────────────────────────────────

/**
 * Veröffentlichte Beiträge – angepinnte zuerst, danach die neuesten.
 * Fehlt die Tabelle noch (Plugin lief nie), wird eine leere Liste geliefert,
 * damit die Startseite trotzdem lädt.
 */
export async function loadPublishedNews(limit = 50, type?: string): Promise<NewsPost[]> {
  try {
    const filter = type && isNewsType(type) ? " AND n.type = ?" : "";
    const params = filter ? [type as string] : [];
    const rows = await query<Row>(
      `${SELECT_POST} WHERE n.published = 1${filter}
       ORDER BY n.pinned DESC, n.created_at DESC, n.id DESC
       LIMIT ${Math.max(1, Math.min(200, Math.floor(limit)))}`,
      params
    );
    return attachReactions(await attachAuthors(rows.map(mapRow)));
  } catch {
    return [];
  }
}

/** Alle Beiträge inkl. Entwürfe – nur für den Admin-Bereich. */
export async function loadAllNews(): Promise<NewsPost[]> {
  try {
    const rows = await query<Row>(
      `${SELECT_POST} ORDER BY n.pinned DESC, n.created_at DESC, n.id DESC LIMIT 500`
    );
    return attachReactions(await attachAuthors(rows.map(mapRow)));
  } catch {
    return [];
  }
}

/**
 * Einzelner Beitrag.
 * @param includeDrafts nur im Admin-Bereich auf true setzen
 */
export async function loadNewsPost(
  id: number,
  includeDrafts = false
): Promise<NewsPost | null> {
  try {
    const rows = await query<Row>(
      `${SELECT_POST} WHERE n.id = ?${includeDrafts ? "" : " AND n.published = 1"} LIMIT 1`,
      [id]
    );
    if (rows.length === 0) return null;
    return (await attachReactions(await attachAuthors([mapRow(rows[0])])))[0];
  } catch {
    return null;
  }
}

/** Bilder eines Beitrags, nach ihrem Index im Text sortiert. */
export async function loadNewsImages(postId: number): Promise<NewsImage[]> {
  try {
    const rows = await query<{
      id: number;
      post_id: number;
      idx: number;
      mime: string;
      caption: string | null;
      data: string;
    }>(
      `SELECT id, post_id, idx, mime, caption, data
       FROM smpg_news_images WHERE post_id = ? ORDER BY idx ASC`,
      [postId]
    );
    return rows.map((r) => ({
      id: Number(r.id),
      postId: Number(r.post_id),
      idx: Number(r.idx),
      mime: r.mime,
      caption: r.caption ?? "",
      data: r.data,
    }));
  } catch {
    return [];
  }
}

// ─── Schreiben (nur Admin) ──────────────────────────────────────────────────

/**
 * UUID zu einem Spielernamen suchen – für den Skin-Render des Autors.
 * Unbekannte Namen liefern null; der Beitrag lässt sich trotzdem speichern.
 */
export async function lookupUuidByName(name: string): Promise<string | null> {
  try {
    const rows = await query<{ uuid: string }>(
      `SELECT uuid FROM tryus_players WHERE LOWER(name) = LOWER(?) LIMIT 1`,
      [name]
    );
    return rows.length ? rows[0].uuid : null;
  } catch {
    return null;
  }
}

/**
 * Schlägt zu allen Verfassern die UUID nach.
 * Leere Namen und Doppelte fliegen raus, die Reihenfolge bleibt.
 */
async function resolveAuthors(names: string[]): Promise<NewsAuthor[]> {
  const seen = new Set<string>();
  const clean: string[] = [];
  for (const raw of names) {
    const name = raw.trim().slice(0, 16);
    const key = name.toLowerCase();
    if (!name || seen.has(key)) continue;
    seen.add(key);
    clean.push(name);
    if (clean.length >= LIMITS.authors) break;
  }
  return Promise.all(
    clean.map(async (name) => ({ name, uuid: await lookupUuidByName(name) }))
  );
}

/** Legt einen Beitrag samt Bildern an und liefert die neue id. */
export async function createNewsPost(input: NewsInput): Promise<number> {
  const authors = await resolveAuthors(input.authorNames);
  const main = authors[0] ?? { name: "Unbekannt", uuid: null };
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute(
      `INSERT INTO smpg_news
         (type, title, summary, body, author_name, author_uuid, published, pinned, markdown)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [
        input.type,
        input.title,
        input.summary,
        input.body,
        main.name,
        main.uuid,
        input.published ? 1 : 0,
        input.pinned ? 1 : 0,
        input.markdown ? 1 : 0,
      ]
    );
    const id = (res as { insertId: number }).insertId;
    await insertImages(conn, id, input.images);
    await insertAuthors(conn, id, authors);
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Aktualisiert einen Beitrag; Bilder und Verfasser werden komplett ersetzt. */
export async function updateNewsPost(id: number, input: NewsInput): Promise<void> {
  const authors = await resolveAuthors(input.authorNames);
  const main = authors[0] ?? { name: "Unbekannt", uuid: null };
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE smpg_news
       SET type = ?, title = ?, summary = ?, body = ?, author_name = ?,
           author_uuid = ?, published = ?, pinned = ?, markdown = ?
       WHERE id = ?`,
      [
        input.type,
        input.title,
        input.summary,
        input.body,
        main.name,
        main.uuid,
        input.published ? 1 : 0,
        input.pinned ? 1 : 0,
        input.markdown ? 1 : 0,
        id,
      ]
    );
    await conn.execute(`DELETE FROM smpg_news_images WHERE post_id = ?`, [id]);
    await insertImages(conn, id, input.images);
    await conn.execute(`DELETE FROM smpg_news_authors WHERE post_id = ?`, [id]);
    await insertAuthors(conn, id, authors);
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function deleteNewsPost(id: number): Promise<number> {
  // ON DELETE CASCADE räumt smpg_news_images mit ab.
  return exec(`DELETE FROM smpg_news WHERE id = ?`, [id]);
}

async function insertAuthors(
  conn: mysql.PoolConnection,
  postId: number,
  authors: NewsAuthor[]
): Promise<void> {
  for (let i = 0; i < authors.length; i++) {
    await conn.execute(
      `INSERT INTO smpg_news_authors (post_id, idx, name, uuid) VALUES (?,?,?,?)`,
      [postId, i, authors[i].name, authors[i].uuid]
    );
  }
}

async function insertImages(
  conn: mysql.PoolConnection,
  postId: number,
  images: NewsImageInput[]
): Promise<void> {
  for (const img of images.slice(0, LIMITS.images)) {
    await conn.execute(
      `INSERT INTO smpg_news_images (post_id, idx, mime, caption, data) VALUES (?,?,?,?,?)`,
      [postId, img.idx, img.mime, img.caption.slice(0, 191), img.data]
    );
  }
}
