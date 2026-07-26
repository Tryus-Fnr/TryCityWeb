import type mysql from "mysql2/promise";
import { exec, query, db } from "@/lib/db";
import {
  isNewsType,
  newsType,
  LIMITS,
  type NewsImage,
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
  image_count: number;
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
    published: Number(r.published) === 1,
    pinned: Number(r.pinned) === 1,
    imageCount: Number(r.image_count ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const SELECT_POST = `
  SELECT n.*,
         (SELECT COUNT(*) FROM smpg_news_images i WHERE i.post_id = n.id) AS image_count
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
    return rows.map(mapRow);
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
    return rows.map(mapRow);
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
    return rows.length ? mapRow(rows[0]) : null;
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

/** Legt einen Beitrag samt Bildern an und liefert die neue id. */
export async function createNewsPost(input: NewsInput): Promise<number> {
  const uuid = await lookupUuidByName(input.authorName);
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute(
      `INSERT INTO smpg_news
         (type, title, summary, body, author_name, author_uuid, published, pinned)
       VALUES (?,?,?,?,?,?,?,?)`,
      [
        input.type,
        input.title,
        input.summary,
        input.body,
        input.authorName,
        uuid,
        input.published ? 1 : 0,
        input.pinned ? 1 : 0,
      ]
    );
    const id = (res as { insertId: number }).insertId;
    await insertImages(conn, id, input.images);
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Aktualisiert einen Beitrag; die Bilder werden komplett ersetzt. */
export async function updateNewsPost(id: number, input: NewsInput): Promise<void> {
  const uuid = await lookupUuidByName(input.authorName);
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      `UPDATE smpg_news
       SET type = ?, title = ?, summary = ?, body = ?, author_name = ?,
           author_uuid = ?, published = ?, pinned = ?
       WHERE id = ?`,
      [
        input.type,
        input.title,
        input.summary,
        input.body,
        input.authorName,
        uuid,
        input.published ? 1 : 0,
        input.pinned ? 1 : 0,
        id,
      ]
    );
    await conn.execute(`DELETE FROM smpg_news_images WHERE post_id = ?`, [id]);
    await insertImages(conn, id, input.images);
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
