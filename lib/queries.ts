import { query } from "./db";

/**
 * Alle Lese-Queries der Website an die Spiel-Datenbank.
 * Tabellen werden vom Minecraft-Netzwerk befüllt:
 *  - smpg_sell_prices        aktueller Verkaufspreis pro Item
 *  - smpg_dynamic_prices     Einstellungen des dynamischen Preissystems
 *  - smpg_price_history      Preis/Volumen pro Anpassungslauf (Graphen)
 *  - smpg_dynamic_price_log  Admin-Änderungen (Marker in Graphen)
 *  - server_statistics       Spielerzahlen alle 5 Minuten (Proxy)
 */

export type ItemRow = {
  material: string;
  price: number;
  startValue: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  yesterday: number | null;
};

export async function loadItems(): Promise<ItemRow[]> {
  const rows = await query<{
    material: string;
    price: string;
    start_value: string | null;
    min_price: string | null;
    max_price: string | null;
  }>(
    `SELECT s.material, s.sell_price AS price,
            d.start_value, d.min_price, d.max_price
     FROM smpg_sell_prices s
     LEFT JOIN smpg_dynamic_prices d ON d.material = s.material
     ORDER BY s.material ASC`
  );

  // Preis von "vor 24h": letzter Historie-Eintrag, der älter als 1 Tag ist
  const yRows = await query<{ material: string; price: string }>(
    `SELECT h.material, h.price
     FROM smpg_price_history h
     JOIN (SELECT material, MAX(id) AS mid
           FROM smpg_price_history
           WHERE ts <= NOW() - INTERVAL 1 DAY
           GROUP BY material) t ON h.id = t.mid`
  );
  const yesterday = new Map(yRows.map((r) => [r.material, Number(r.price)]));

  return rows.map((r) => ({
    material: r.material,
    price: Number(r.price),
    startValue: r.start_value !== null ? Number(r.start_value) : null,
    minPrice: r.min_price !== null ? Number(r.min_price) : null,
    maxPrice: r.max_price !== null ? Number(r.max_price) : null,
    yesterday: yesterday.get(r.material) ?? null,
  }));
}

export type HistoryPoint = { ts: string; price: number; sold: number };
export type ChangeMarker = {
  changedAt: string;
  startValue: number;
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
};

export async function loadItemDetail(material: string, days: number | null) {
  const params: (string | number)[] = [material];
  let where = "WHERE material = ?";
  if (days !== null) {
    where += " AND ts >= NOW() - INTERVAL ? DAY";
    params.push(days);
  }

  const history = await query<{ ts: string; price: string; sold: string }>(
    `SELECT ts, price, sold FROM smpg_price_history ${where} ORDER BY ts ASC, id ASC`,
    params
  );

  const changes = await query<{
    changed_at: string;
    start_value: string;
    min_price: string;
    max_price: string;
    current_price: string;
  }>(
    `SELECT changed_at, start_value, min_price, max_price, current_price
     FROM smpg_dynamic_price_log WHERE material = ? ORDER BY changed_at ASC, id ASC`,
    [material]
  );

  const settings = await query<{
    start_value: string;
    min_price: string;
    max_price: string;
    trend_days: number;
    gravity: string;
  }>(
    `SELECT start_value, min_price, max_price, trend_days, gravity
     FROM smpg_dynamic_prices WHERE material = ? LIMIT 1`,
    [material]
  );

  const current = await query<{ sell_price: string }>(
    `SELECT sell_price FROM smpg_sell_prices WHERE material = ? LIMIT 1`,
    [material]
  );

  return {
    material,
    currentPrice: current.length > 0 ? Number(current[0].sell_price) : null,
    settings:
      settings.length > 0
        ? {
            startValue: Number(settings[0].start_value),
            minPrice: Number(settings[0].min_price),
            maxPrice: Number(settings[0].max_price),
            trendDays: settings[0].trend_days,
            gravity: Number(settings[0].gravity),
          }
        : null,
    history: history.map(
      (h): HistoryPoint => ({ ts: h.ts, price: Number(h.price), sold: Number(h.sold) })
    ),
    changes: changes.map(
      (c): ChangeMarker => ({
        changedAt: c.changed_at,
        startValue: Number(c.start_value),
        minPrice: Number(c.min_price),
        maxPrice: Number(c.max_price),
        currentPrice: Number(c.current_price),
      })
    ),
  };
}

export type PlayerPoint = { t: number; avg: number; max: number };
export type ServerNow = { server: string; online: number; max: number };

/** Spielerzahlen-Verlauf: Summe über alle Server, gebuckelt. */
export async function loadPlayerHistory(
  sinceMs: number,
  bucketMs: number
): Promise<PlayerPoint[]> {
  const rows = await query<{ b: string; avg_total: string; max_total: string }>(
    `SELECT FLOOR(ts / ?) AS b,
            ROUND(AVG(total)) AS avg_total,
            MAX(total) AS max_total
     FROM (SELECT timestamp AS ts, SUM(online_players) AS total
           FROM server_statistics
           WHERE timestamp >= ?
           GROUP BY timestamp) x
     GROUP BY b ORDER BY b ASC`,
    [bucketMs, sinceMs]
  );
  return rows.map((r) => ({
    t: Number(r.b) * bucketMs + bucketMs / 2,
    avg: Number(r.avg_total),
    max: Number(r.max_total),
  }));
}

/** Aktuelle Spielerzahlen pro Server (letzter Snapshot). */
export async function loadServersNow(): Promise<ServerNow[]> {
  const rows = await query<{
    server_name: string;
    online_players: number;
    max_players: number;
  }>(
    `SELECT server_name, online_players, max_players
     FROM server_statistics
     WHERE timestamp = (SELECT MAX(timestamp) FROM server_statistics)
     ORDER BY server_name ASC`
  );
  return rows.map((r) => ({
    server: r.server_name,
    online: r.online_players,
    max: r.max_players,
  }));
}

/** Sparklines für alle Items: täglich aggregierter Preis der letzten 14 Tage. */
export type SparklinePoint = { day: string; price: number };
export async function loadSparklinesAll(): Promise<Record<string, SparklinePoint[]>> {
  const rows = await query<{ material: string; day: string; price: string }>(
    `SELECT material,
            DATE(ts) AS day,
            ROUND(AVG(price), 2) AS price
     FROM smpg_price_history
     WHERE ts >= NOW() - INTERVAL 14 DAY
     GROUP BY material, DATE(ts)
     ORDER BY material ASC, day ASC`
  );
  const result: Record<string, SparklinePoint[]> = {};
  for (const r of rows) {
    if (!result[r.material]) result[r.material] = [];
    result[r.material].push({ day: r.day, price: Number(r.price) });
  }
  return result;
}

// ─── SMP-Spieler Inventar ───────────────────────────────────────────────────

export type RawInventoryRow = {
  inventory: string | null;
  ender_chest: string | null;
  armor: string | null;
  offhand: string | null;
};

export async function loadPlayerRawInventory(uuid: string): Promise<RawInventoryRow | null> {
  const rows = await query<RawInventoryRow>(
    `SELECT inventory, ender_chest, armor, offhand
     FROM smpg_player_data WHERE uuid = ? LIMIT 1`,
    [uuid]
  );
  return rows.length > 0 ? rows[0] : null;
}

// ─── SMP-Spieler ───────────────────────────────────────────────────────────

export type PlayerRow = {
  uuid: string;
  name: string;
  firstJoin: number;
  lastJoin: number;
  onlineTime: number;
  coins: number;
  gems: number;
  stars: number;
};

export async function loadAllPlayers(): Promise<PlayerRow[]> {
  const rows = await query<{
    uuid: string;
    name: string;
    firstJoin: string;
    lastJoin: string;
    onlineTime: string;
    coins: string;
    gems: string;
    stars: string;
  }>(
    `SELECT uuid, name, firstJoin, lastJoin, onlineTime, coins, gems, stars
     FROM tryus_players
     ORDER BY lastJoin DESC`
  );
  return rows.map((r) => ({
    uuid: r.uuid,
    name: r.name,
    firstJoin: Number(r.firstJoin),
    lastJoin: Number(r.lastJoin),
    onlineTime: Number(r.onlineTime),
    coins: Number(r.coins),
    gems: Number(r.gems),
    stars: Number(r.stars),
  }));
}

export type PlayerDetail = {
  uuid: string;
  name: string;
  firstJoin: number;
  lastJoin: number;
  lastQuit: number;
  onlineTime: number;
  coins: number;
  gems: number;
  stars: number;
  balance: number | null;
  bankBalance: number | null;
  status: string | null;
  currentServer: string | null;
  lastServer: string | null;
  health: number | null;
  maxHealth: number | null;
  foodLevel: number | null;
  expLevel: number | null;
  experience: number | null;
  gameMode: string | null;
  pendingStarterKit: boolean | null;
  tutorialProgress: number | null;
};

export async function loadPlayerDetail(uuid: string): Promise<PlayerDetail | null> {
  const rows = await query<{
    uuid: string;
    name: string;
    firstJoin: string;
    lastJoin: string;
    lastQuit: string;
    onlineTime: string;
    coins: string;
    gems: string;
    stars: string;
    balance: string | null;
    bank_balance: string | null;
    status: string | null;
    current_server: string | null;
    last_server: string | null;
    health: string | null;
    max_health: string | null;
    food_level: string | null;
    exp_level: string | null;
    experience: string | null;
    game_mode: string | null;
    pending_starter_kit: number | null;
    tutorial_progress: string | null;
  }>(
    `SELECT p.uuid, p.name, p.firstJoin, p.lastJoin, p.lastQuit, p.onlineTime,
            p.coins, p.gems, p.stars,
            e.balance, e.bank_balance,
            d.status, d.current_server, d.last_server,
            d.health, d.max_health, d.food_level, d.exp_level, d.experience,
            d.game_mode, d.pending_starter_kit, d.tutorial_progress
     FROM tryus_players p
     LEFT JOIN smpg_economy e ON e.uuid = p.uuid
     LEFT JOIN smpg_player_data d ON d.uuid = p.uuid
     WHERE p.uuid = ?
     LIMIT 1`,
    [uuid]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    uuid: r.uuid,
    name: r.name,
    firstJoin: Number(r.firstJoin),
    lastJoin: Number(r.lastJoin),
    lastQuit: Number(r.lastQuit),
    onlineTime: Number(r.onlineTime),
    coins: Number(r.coins),
    gems: Number(r.gems),
    stars: Number(r.stars),
    balance: r.balance !== null ? Number(r.balance) : null,
    bankBalance: r.bank_balance !== null ? Number(r.bank_balance) : null,
    status: r.status,
    currentServer: r.current_server,
    lastServer: r.last_server,
    health: r.health !== null ? Number(r.health) : null,
    maxHealth: r.max_health !== null ? Number(r.max_health) : null,
    foodLevel: r.food_level !== null ? Number(r.food_level) : null,
    expLevel: r.exp_level !== null ? Number(r.exp_level) : null,
    experience: r.experience !== null ? Number(r.experience) : null,
    gameMode: r.game_mode,
    pendingStarterKit: r.pending_starter_kit !== null ? r.pending_starter_kit === 1 : null,
    tutorialProgress: r.tutorial_progress !== null ? Number(r.tutorial_progress) : null,
  };
}

// ───────────────────────────────────────────────────────────────────────────

/** Höchste Gesamt-Spielerzahl seit `sinceMs`. */
export async function loadPeak(sinceMs: number): Promise<number> {
  const rows = await query<{ peak: string | null }>(
    `SELECT MAX(total) AS peak
     FROM (SELECT SUM(online_players) AS total
           FROM server_statistics
           WHERE timestamp >= ?
           GROUP BY timestamp) x`,
    [sinceMs]
  );
  return rows.length > 0 && rows[0].peak !== null ? Number(rows[0].peak) : 0;
}
