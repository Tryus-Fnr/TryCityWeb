import type mysql from "mysql2/promise";
import { db, exec, query } from "@/lib/db";
import {
  DUPLICATE_THRESHOLD,
  SUGGEST_THRESHOLD,
  normalizeText,
  prepare,
  similarity,
  type PreparedTitle,
} from "@/lib/similarity";
import {
  isSuggestionStatus,
  suggestionCategory,
  FEEDBACK_LIMITS,
  type BugReport,
  type SimilarSuggestion,
  type Suggestion,
  type SuggestionCategoryId,
  type SuggestionStatusId,
} from "@/lib/feedbackTypes";

/**
 * Vorschläge und Bug-Meldungen der Spieler.
 *
 * Beides wird ausschließlich hier auf der Website eingereicht. Ingame gibt es
 * dafür bewusst kein Formular mehr: `/bug` zeigt nur noch den Link, das
 * Admin-GUI (`/bug admin`) liest weiter dieselbe Tabelle `smpg_bugs`.
 *
 * Sichtbarkeit:
 *  - Vorschläge sind öffentlich, abstimmen und einreichen nur angemeldet.
 *  - Bug-Meldungen sieht nur der Melder selbst und das Team. Sie enthalten
 *    regelmäßig Wege, wie man etwas kaputt macht – das gehört nicht ins Netz.
 */

export * from "@/lib/feedbackTypes";

// ─── Vorschläge lesen ───────────────────────────────────────────────────────

type SuggestionRow = {
  id: number;
  author_uuid: string;
  author_name: string;
  category: string;
  title: string;
  body: string | null;
  status: string;
  staff_note: string | null;
  duplicate_of: number | null;
  upvotes: number | string;
  downvotes: number | string;
  score: number | string;
  own_vote: number | string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Stimmen kommen als Unterabfragen dazu – genau wie bei den Beitragsbildern in
 * `lib/news.ts`. Ein GROUP BY über die Stimmen-Tabelle wäre kürzer, würde aber
 * je nach `sql_mode` an ONLY_FULL_GROUP_BY scheitern.
 */
const SELECT_SUGGESTION = `
  SELECT s.id, s.author_uuid, s.author_name, s.category, s.title, s.body,
         s.status, s.staff_note, s.duplicate_of, s.created_at, s.updated_at,
         (SELECT COUNT(*) FROM smpg_suggestion_votes v
           WHERE v.suggestion_id = s.id AND v.value = 1) AS upvotes,
         (SELECT COUNT(*) FROM smpg_suggestion_votes v
           WHERE v.suggestion_id = s.id AND v.value = -1) AS downvotes,
         (SELECT COALESCE(SUM(v.value), 0) FROM smpg_suggestion_votes v
           WHERE v.suggestion_id = s.id) AS score,
         (SELECT v.value FROM smpg_suggestion_votes v
           WHERE v.suggestion_id = s.id AND v.uuid = ? LIMIT 1) AS own_vote
  FROM smpg_suggestions s`;

function mapSuggestion(r: SuggestionRow): Suggestion {
  return {
    id: Number(r.id),
    authorUuid: r.author_uuid,
    authorName: r.author_name,
    category: suggestionCategory(r.category).id,
    title: r.title,
    body: r.body ?? "",
    status: isSuggestionStatus(r.status) ? r.status : "offen",
    staffNote: r.staff_note ?? "",
    duplicateOf: r.duplicate_of !== null ? Number(r.duplicate_of) : null,
    upvotes: Number(r.upvotes ?? 0),
    downvotes: Number(r.downvotes ?? 0),
    score: Number(r.score ?? 0),
    ownVote: Number(r.own_vote ?? 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/**
 * Vorschläge für die Übersicht, die beliebtesten zuerst.
 *
 * Gefiltert und weiter sortiert wird im Browser (siehe `SuggestionList`) –
 * bei ein paar hundert Einträgen ist das schneller als für jeden Klick auf
 * einen Filter erneut zur Datenbank zu gehen.
 *
 * @param uuid angemeldete UUID (für die eigene Stimme) oder null
 */
export async function loadSuggestions(uuid: string | null, limit = 300): Promise<Suggestion[]> {
  try {
    const rows = await query<SuggestionRow>(
      `${SELECT_SUGGESTION}
       ORDER BY score DESC, s.created_at DESC, s.id DESC
       LIMIT ${Math.max(1, Math.min(500, Math.floor(limit)))}`,
      [uuid ?? ""]
    );
    return rows.map(mapSuggestion);
  } catch {
    // Tabelle fehlt noch (setup.sql nicht gelaufen) – die Seite lädt trotzdem.
    return [];
  }
}

/** Einzelner Vorschlag, oder null. */
export async function loadSuggestion(id: number, uuid: string | null): Promise<Suggestion | null> {
  try {
    const rows = await query<SuggestionRow>(`${SELECT_SUGGESTION} WHERE s.id = ? LIMIT 1`, [
      uuid ?? "",
      id,
    ]);
    return rows.length > 0 ? mapSuggestion(rows[0]) : null;
  } catch {
    return null;
  }
}

// ─── Ähnlichkeitssuche ──────────────────────────────────────────────────────

type IndexEntry = {
  id: number;
  title: string;
  status: SuggestionStatusId;
  score: number;
  prepared: PreparedTitle;
};

/**
 * Titel-Index für die Duplikat-Suche.
 *
 * Die Suche läuft, während jemand tippt – jedes Zeichen eine Abfrage über alle
 * Vorschläge wäre Unsinn. Stattdessen liegt die Liste eine Minute lang im
 * Speicher, aufbereitet für den Vergleich (siehe `lib/similarity.ts`). Nach dem
 * Anlegen eines Vorschlags wird sie verworfen, damit der eigene Titel sofort
 * mitzählt.
 */
const INDEX_TTL_MS = 60_000;
let index: { at: number; entries: IndexEntry[] } | null = null;

export function invalidateSuggestionIndex(): void {
  index = null;
}

async function suggestionIndex(): Promise<IndexEntry[]> {
  if (index && Date.now() - index.at < INDEX_TTL_MS) return index.entries;
  try {
    const rows = await query<{
      id: number;
      title: string;
      title_norm: string | null;
      status: string;
      score: number | string;
    }>(
      `SELECT s.id, s.title, s.title_norm, s.status,
              (SELECT COALESCE(SUM(v.value), 0) FROM smpg_suggestion_votes v
                WHERE v.suggestion_id = s.id) AS score
       FROM smpg_suggestions s
       ORDER BY s.id DESC
       LIMIT 3000`
    );
    const entries = rows.map((r) => ({
      id: Number(r.id),
      title: r.title,
      status: (isSuggestionStatus(r.status) ? r.status : "offen") as SuggestionStatusId,
      score: Number(r.score ?? 0),
      // title_norm wird beim Speichern gefüllt; für Altbestand notfalls hier.
      prepared: prepare(r.title, r.title_norm ?? undefined),
    }));
    index = { at: Date.now(), entries };
    return entries;
  } catch {
    return [];
  }
}

/**
 * Vorschläge, die dem eingetippten Titel ähneln – absteigend nach Ähnlichkeit.
 *
 * @param limit wie viele Treffer höchstens zurückkommen
 */
export async function findSimilarSuggestions(
  title: string,
  limit = 5
): Promise<SimilarSuggestion[]> {
  const norm = normalizeText(title);
  // Unter vier Zeichen ist jeder Treffer Zufall.
  if (norm.length < 4) return [];

  const wanted = prepare(title, norm);
  const entries = await suggestionIndex();

  const hits: SimilarSuggestion[] = [];
  for (const e of entries) {
    const s = similarity(wanted, e.prepared);
    if (s < SUGGEST_THRESHOLD) continue;
    hits.push({ id: e.id, title: e.title, status: e.status, score: e.score, similarity: s });
  }
  hits.sort((a, b) => b.similarity - a.similarity || b.score - a.score);
  return hits.slice(0, limit);
}

/** true, wenn es zum Titel bereits einen praktisch identischen Vorschlag gibt. */
export function isDuplicate(hits: SimilarSuggestion[]): boolean {
  return hits.length > 0 && hits[0].similarity >= DUPLICATE_THRESHOLD;
}

// ─── Vorschläge schreiben ───────────────────────────────────────────────────

export type SuggestionInput = {
  category: SuggestionCategoryId;
  title: string;
  body: string;
};

/**
 * Legt einen Vorschlag an und gibt seine id zurück.
 *
 * Der Ersteller stimmt automatisch dafür – er hat den Vorschlag ja gemacht,
 * und ohne das stünde jeder neue Eintrag mit 0 in der Liste.
 */
export async function createSuggestion(
  uuid: string,
  name: string,
  input: SuggestionInput
): Promise<number> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute(
      `INSERT INTO smpg_suggestions
         (author_uuid, author_name, category, title, title_norm, body)
       VALUES (?,?,?,?,?,?)`,
      [
        uuid,
        name.slice(0, 16),
        input.category,
        input.title,
        normalizeText(input.title).slice(0, 160),
        input.body,
      ]
    );
    const id = (res as { insertId: number }).insertId;
    await conn.execute(
      `INSERT INTO smpg_suggestion_votes (suggestion_id, uuid, value) VALUES (?,?,1)`,
      [id, uuid]
    );
    await conn.commit();
    invalidateSuggestionIndex();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/** Gibt es den Vorschlag überhaupt? Für Abstimmungen die billigste Prüfung. */
export async function suggestionExists(id: number): Promise<boolean> {
  const rows = await query<{ id: number }>(`SELECT id FROM smpg_suggestions WHERE id = ? LIMIT 1`, [
    id,
  ]);
  return rows.length > 0;
}

/**
 * Setzt die Stimme einer Person auf einen Vorschlag.
 *
 * @param value 1 = dafür, −1 = dagegen, 0 = zurücknehmen
 */
export async function setSuggestionVote(
  suggestionId: number,
  uuid: string,
  value: number
): Promise<void> {
  if (value === 0) {
    await exec(`DELETE FROM smpg_suggestion_votes WHERE suggestion_id = ? AND uuid = ?`, [
      suggestionId,
      uuid,
    ]);
    return;
  }
  await exec(
    `INSERT INTO smpg_suggestion_votes (suggestion_id, uuid, value) VALUES (?,?,?)
     ON DUPLICATE KEY UPDATE value = VALUES(value), created_at = CURRENT_TIMESTAMP`,
    [suggestionId, uuid, value > 0 ? 1 : -1]
  );
}

/** Stimmen-Bilanz eines Vorschlags nach einer Abstimmung. */
export async function loadVoteState(
  suggestionId: number,
  uuid: string | null
): Promise<{ upvotes: number; downvotes: number; score: number; ownVote: number }> {
  const rows = await query<{ ups: number | string; downs: number | string; own: number | null }>(
    `SELECT
       (SELECT COUNT(*) FROM smpg_suggestion_votes WHERE suggestion_id = ? AND value = 1) AS ups,
       (SELECT COUNT(*) FROM smpg_suggestion_votes WHERE suggestion_id = ? AND value = -1) AS downs,
       (SELECT value FROM smpg_suggestion_votes WHERE suggestion_id = ? AND uuid = ? LIMIT 1) AS own`,
    [suggestionId, suggestionId, suggestionId, uuid ?? ""]
  );
  const r = rows[0];
  const upvotes = Number(r?.ups ?? 0);
  const downvotes = Number(r?.downs ?? 0);
  return { upvotes, downvotes, score: upvotes - downvotes, ownVote: Number(r?.own ?? 0) };
}

/** Bearbeitungsstand und Anmerkung setzen – nur fürs Team. */
export async function updateSuggestionStatus(
  id: number,
  status: SuggestionStatusId,
  staffNote: string,
  duplicateOf: number | null
): Promise<number> {
  const affected = await exec(
    `UPDATE smpg_suggestions SET status = ?, staff_note = ?, duplicate_of = ? WHERE id = ?`,
    [status, staffNote.slice(0, FEEDBACK_LIMITS.staffNote), duplicateOf, id]
  );
  invalidateSuggestionIndex();
  return affected;
}

export async function deleteSuggestion(id: number): Promise<number> {
  const affected = await exec(`DELETE FROM smpg_suggestions WHERE id = ?`, [id]);
  invalidateSuggestionIndex();
  return affected;
}

// ─── Bug-Meldungen ──────────────────────────────────────────────────────────

type BugRow = {
  id: number;
  reporter_uuid: string;
  reporter_name: string;
  title: string;
  description: string | null;
  priority: number;
  status: number;
  created_at: string;
  image_ids: string | null;
};

/**
 * Die Bild-ids kommen als kommagetrennte Liste mit – GROUP_CONCAT spart die
 * zweite Abfrage, und mehr als drei Bilder gibt es pro Meldung ohnehin nicht.
 */
const SELECT_BUG = `
  SELECT b.id, b.reporter_uuid, b.reporter_name, b.title, b.description,
         b.priority, b.status, b.created_at,
         (SELECT GROUP_CONCAT(i.id ORDER BY i.idx ASC)
            FROM smpg_bug_images i WHERE i.bug_id = b.id) AS image_ids
  FROM smpg_bugs b`;

function mapBug(r: BugRow): BugReport {
  return {
    id: Number(r.id),
    reporterUuid: r.reporter_uuid,
    reporterName: r.reporter_name,
    title: r.title,
    description: r.description ?? "",
    priority: Number(r.priority ?? 0),
    status: Number(r.status ?? 0),
    imageIds: (r.image_ids ?? "")
      .split(",")
      .filter(Boolean)
      .map((v) => Number(v))
      .filter((v) => Number.isInteger(v) && v > 0),
    createdAt: r.created_at,
  };
}

/** Alle Meldungen, neueste zuerst – nur fürs Team. */
export async function loadAllBugs(limit = 300): Promise<BugReport[]> {
  try {
    const rows = await query<BugRow>(
      `${SELECT_BUG} ORDER BY b.status ASC, b.priority DESC, b.id DESC
       LIMIT ${Math.max(1, Math.min(500, Math.floor(limit)))}`
    );
    return rows.map(mapBug);
  } catch {
    return [];
  }
}

/** Die eigenen Meldungen einer Person. */
export async function loadOwnBugs(uuid: string, limit = 50): Promise<BugReport[]> {
  try {
    const rows = await query<BugRow>(
      `${SELECT_BUG} WHERE b.reporter_uuid = ? ORDER BY b.id DESC
       LIMIT ${Math.max(1, Math.min(200, Math.floor(limit)))}`,
      [uuid]
    );
    return rows.map(mapBug);
  } catch {
    return [];
  }
}

export type BugImageInput = { mime: string; data: string };

export type BugInput = {
  title: string;
  description: string;
  images: BugImageInput[];
};

/** Legt eine Bug-Meldung samt Bildern an und gibt die neue id zurück. */
export async function createBug(uuid: string, name: string, input: BugInput): Promise<number> {
  const conn = await db().getConnection();
  try {
    await conn.beginTransaction();
    const [res] = await conn.execute(
      `INSERT INTO smpg_bugs (reporter_uuid, reporter_name, title, description)
       VALUES (?,?,?,?)`,
      [uuid, name.slice(0, 16), input.title, input.description]
    );
    const id = (res as { insertId: number }).insertId;
    await insertBugImages(conn, id, input.images);
    await conn.commit();
    return id;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function insertBugImages(
  conn: mysql.PoolConnection,
  bugId: number,
  images: BugImageInput[]
): Promise<void> {
  const list = images.slice(0, FEEDBACK_LIMITS.bugImages);
  for (let i = 0; i < list.length; i++) {
    await conn.execute(
      `INSERT INTO smpg_bug_images (bug_id, idx, mime, data) VALUES (?,?,?,?)`,
      [bugId, i + 1, list[i].mime, list[i].data]
    );
  }
}

/** Ein Bild samt Melder – der Aufrufer entscheidet, ob er es zeigen darf. */
export async function loadBugImage(
  imageId: number
): Promise<{ mime: string; data: string; reporterUuid: string } | null> {
  const rows = await query<{ mime: string; data: string; reporter_uuid: string }>(
    `SELECT i.mime, i.data, b.reporter_uuid
     FROM smpg_bug_images i
     JOIN smpg_bugs b ON b.id = i.bug_id
     WHERE i.id = ? LIMIT 1`,
    [imageId]
  );
  if (rows.length === 0) return null;
  return { mime: rows[0].mime, data: rows[0].data, reporterUuid: rows[0].reporter_uuid };
}

/** Priorität (0–3) und Status (0/1) setzen – wie im Admin-GUI ingame. */
export async function updateBug(id: number, priority: number, status: number): Promise<number> {
  return exec(`UPDATE smpg_bugs SET priority = ?, status = ? WHERE id = ?`, [
    Math.max(0, Math.min(3, Math.floor(priority))),
    status === 1 ? 1 : 0,
    id,
  ]);
}

/**
 * Löscht eine Meldung samt Bildern.
 *
 * Die Bilder hängen ohne Fremdschlüssel an der Meldung – `smpg_bugs` legt das
 * Plugin an, und eine nachträgliche Beziehung darauf würde je nach Engine der
 * bestehenden Tabelle scheitern. Aufgeräumt wird deshalb hier von Hand, und im
 * Plugin genauso (`BugBridge.delete`).
 */
export async function deleteBug(id: number): Promise<number> {
  await exec(`DELETE FROM smpg_bug_images WHERE bug_id = ?`, [id]);
  return exec(`DELETE FROM smpg_bugs WHERE id = ?`, [id]);
}

// ─── Schutz vor Flut und gesperrten Konten ──────────────────────────────────

/**
 * Wie viele Einträge jemand in den letzten 24 Stunden gemacht hat und wann der
 * letzte war – Grundlage für Tagesmenge und Abstand zwischen zwei Einträgen.
 *
 * Absichtlich aus der Datenbank statt aus dem Speicher: ein Neustart der
 * Website darf die Tagesmenge nicht zurücksetzen.
 */
export async function recentSubmissions(
  table: "smpg_suggestions" | "smpg_bugs",
  uuidColumn: "author_uuid" | "reporter_uuid",
  uuid: string
): Promise<{ count: number; lastAgoSeconds: number | null }> {
  const rows = await query<{ n: number | string; ago: number | string | null }>(
    `SELECT COUNT(*) AS n,
            MIN(TIMESTAMPDIFF(SECOND, created_at, NOW())) AS ago
     FROM ${table}
     WHERE ${uuidColumn} = ? AND created_at > (NOW() - INTERVAL 1 DAY)`,
    [uuid]
  );
  const r = rows[0];
  return {
    count: Number(r?.n ?? 0),
    lastAgoSeconds: r?.ago === null || r?.ago === undefined ? null : Number(r.ago),
  };
}

/**
 * Aktive Sperre eines Kontos, oder null.
 *
 * Wer gebannt oder stummgeschaltet ist, reicht nichts ein. Ein Mute ist die
 * Ansage „du schreibst hier gerade nicht" – die über das Web zu umgehen wäre
 * ein Loch, das sich sonst genau einmal herumspricht.
 * `expires_at`: 0 oder NULL heißt dauerhaft, sonst Zeitstempel in Millisekunden.
 */
export async function loadActiveRestriction(uuid: string): Promise<"BAN" | "MUTE" | null> {
  try {
    const rows = await query<{ type: string }>(
      `SELECT type FROM tryus_punishments
       WHERE target_uuid = ? AND active = 1 AND type IN ('BAN','MUTE')
         AND (expires_at IS NULL OR expires_at = 0 OR expires_at > ?)
       ORDER BY FIELD(type, 'BAN', 'MUTE')
       LIMIT 1`,
      [uuid, Date.now()]
    );
    if (rows.length === 0) return null;
    return rows[0].type === "BAN" ? "BAN" : "MUTE";
  } catch {
    // Tabelle nicht lesbar – dann lieber durchlassen als alle aussperren.
    return null;
  }
}
