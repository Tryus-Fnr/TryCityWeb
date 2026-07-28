import { query, exec, db } from "@/lib/db";

/**
 * Datenbankschicht für die netzwerkweite Bossbar.
 *
 * Die Tabellen werden vom Proxy-Plugin (BossBarBridge) automatisch angelegt –
 * die Website schreibt nur in sie hinein.
 *
 * Tabellen:
 *   tryus_bossbar_messages  – id, position, message, enabled
 *   tryus_bossbar_config    – config_key, config_value
 */

export type BossBarMessage = {
  id: number;
  position: number;
  message: string;
  enabled: boolean;
};

export type BossBarConfig = {
  enabled: boolean;
  intervalSeconds: number;
};

const T_MSG = "tryus_bossbar_messages";
const T_CFG = "tryus_bossbar_config";

type MsgRow = { id: number; position: number; message: string; enabled: number };

function mapRow(r: MsgRow): BossBarMessage {
  return {
    id: Number(r.id),
    position: Number(r.position),
    message: r.message,
    enabled: Number(r.enabled) === 1,
  };
}

// ── Lesen ─────────────────────────────────────────────────────────────────────

export async function loadBossBarMessages(): Promise<BossBarMessage[]> {
  try {
    const rows = await query<MsgRow>(
      `SELECT id, position, message, enabled FROM \`${T_MSG}\` ORDER BY position ASC, id ASC`
    );
    return rows.map(mapRow);
  } catch {
    return [];
  }
}

export async function loadBossBarConfig(): Promise<BossBarConfig> {
  try {
    const rows = await query<{ config_key: string; config_value: string }>(
      `SELECT config_key, config_value FROM \`${T_CFG}\``
    );
    const map = Object.fromEntries(rows.map((r) => [r.config_key, r.config_value]));
    return {
      enabled: map["enabled"] !== "false",
      intervalSeconds: Math.max(3, parseInt(map["interval-seconds"] ?? "60", 10) || 60),
    };
  } catch {
    return { enabled: true, intervalSeconds: 60 };
  }
}

// ── Schreiben ─────────────────────────────────────────────────────────────────

/** Fügt eine neue Nachricht hinzu und gibt die neue id zurück. */
export async function addBossBarMessage(message: string, position: number): Promise<number> {
  const [result] = await db().execute(
    `INSERT INTO \`${T_MSG}\` (position, message, enabled) VALUES (?, ?, 1)`,
    [position, message]
  );
  return (result as { insertId: number }).insertId;
}

export async function updateBossBarMessage(id: number, message: string): Promise<void> {
  await exec(`UPDATE \`${T_MSG}\` SET message = ? WHERE id = ?`, [message, id]);
}

export async function setBossBarMessageEnabled(id: number, enabled: boolean): Promise<void> {
  await exec(`UPDATE \`${T_MSG}\` SET enabled = ? WHERE id = ?`, [enabled ? 1 : 0, id]);
}

export async function setBossBarMessagePosition(id: number, position: number): Promise<void> {
  await exec(`UPDATE \`${T_MSG}\` SET position = ? WHERE id = ?`, [position, id]);
}

export async function deleteBossBarMessage(id: number): Promise<void> {
  await exec(`DELETE FROM \`${T_MSG}\` WHERE id = ?`, [id]);
}

/** Schreibt einen Config-Wert mit UPSERT. */
export async function setBossBarConfig(key: string, value: string): Promise<void> {
  await exec(
    `INSERT INTO \`${T_CFG}\` (config_key, config_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
    [key, value]
  );
}

