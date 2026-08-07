import { exec, query } from "./db";

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
  /** Preis beim vorherigen Anpassungslauf – Grundlage der angezeigten Änderung. */
  previous: number | null;
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
     INNER JOIN smpg_dynamic_prices d ON d.material = s.material
     ORDER BY s.material ASC`
  );

  // Preis beim VORHERIGEN Lauf – schlicht der zweitneueste Historie-Eintrag.
  // Bewusst nicht "älter als 24 Stunden": fällt ein Lauf mal aus oder wird einer
  // von Hand angestoßen, verglich das vorher zwei Stände, die gar nicht
  // aufeinander folgen. So ist es immer genau ein Lauf Unterschied.
  const prevRows = await query<{ material: string; price: string }>(
    `SELECT material, price FROM (
       SELECT material, price,
              ROW_NUMBER() OVER (PARTITION BY material ORDER BY ts DESC, id DESC) AS rn
       FROM smpg_price_history
     ) t WHERE rn = 2`
  );
  const previous = new Map(prevRows.map((r) => [r.material, Number(r.price)]));

  return rows.map((r) => ({
    material: r.material,
    price: Number(r.price),
    startValue: r.start_value !== null ? Number(r.start_value) : null,
    minPrice: r.min_price !== null ? Number(r.min_price) : null,
    maxPrice: r.max_price !== null ? Number(r.max_price) : null,
    previous: previous.get(r.material) ?? null,
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
    meta: await loadItemMeta(material),
    metaHistory: await loadMetaHistory(material),
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

// ─── Metas (befristete Preis-Anhebungen) ───────────────────────────────────

/**
 * Eine Meta hebt den Verkaufspreis eines Items für eine begrenzte Zeit an.
 * Gesetzt wird sie vom Admin – ingame über /dynprice meta oder hier auf der
 * Item-Seite. Das Minecraft-Netzwerk wertet die Tabelle bei jedem
 * Anpassungslauf (00:00 und 12:00) aus.
 *
 * Zustände: PENDING (wartet auf den nächsten Lauf) → ACTIVE (zieht zum
 * Zielpreis) → COOLDOWN (geht zurück auf den Preis davor) → DONE.
 */
export type ItemMeta = {
  id: number;
  material: string;
  targetPrice: number;
  strength: number; // 0..1
  startAt: string;
  endAt: string;
  state: "PENDING" | "ACTIVE" | "COOLDOWN" | "DONE";
  priceBefore: number | null;
  createdBy: string;
};

type MetaRow = {
  id: number;
  material: string;
  target_price: string;
  strength: string;
  start_at: string;
  end_at: string;
  state: ItemMeta["state"];
  price_before: string | null;
  created_by: string;
};

const mapMeta = (r: MetaRow): ItemMeta => ({
  id: r.id,
  material: r.material,
  targetPrice: Number(r.target_price),
  strength: Number(r.strength),
  startAt: r.start_at,
  endAt: r.end_at,
  state: r.state,
  priceBefore: r.price_before !== null ? Number(r.price_before) : null,
  createdBy: r.created_by,
});

const META_COLS =
  "id, material, target_price, strength, start_at, end_at, state, price_before, created_by";

/** Die laufende Meta eines Items (PENDING/ACTIVE/COOLDOWN) – oder null. */
export async function loadItemMeta(material: string): Promise<ItemMeta | null> {
  const rows = await query<MetaRow>(
    `SELECT ${META_COLS} FROM smpg_price_meta
     WHERE material = ? AND state <> 'DONE' ORDER BY id DESC LIMIT 1`,
    [material]
  );
  return rows.length > 0 ? mapMeta(rows[0]) : null;
}

/** Abgeschlossene Metas eines Items – als Marker im Graphen. */
export async function loadMetaHistory(material: string): Promise<ItemMeta[]> {
  const rows = await query<MetaRow>(
    `SELECT ${META_COLS} FROM smpg_price_meta
     WHERE material = ? AND state = 'DONE' ORDER BY start_at ASC LIMIT 50`,
    [material]
  );
  return rows.map(mapMeta);
}

/** Alle laufenden Metas im Netzwerk. */
export async function loadOpenMetas(): Promise<ItemMeta[]> {
  const rows = await query<MetaRow>(
    `SELECT ${META_COLS} FROM smpg_price_meta
     WHERE state <> 'DONE' ORDER BY end_at ASC`
  );
  return rows.map(mapMeta);
}

/**
 * Legt eine Meta an. Eine bereits laufende Meta desselben Items wird dabei
 * abgeschlossen – es gibt immer höchstens eine gleichzeitig.
 *
 * @param hours Laufzeit ab jetzt in Stunden
 */
export async function createItemMeta(
  material: string,
  targetPrice: number,
  strength: number,
  hours: number,
  createdBy: string
): Promise<void> {
  // Ersetzt eine laufende Meta? Dann deren price_before übernehmen – sonst
  // merkt sich die neue Meta den bereits angehobenen Preis als "davor" und der
  // Preis schraubt sich bei jedem Ersetzen weiter hoch.
  const running = await loadItemMeta(material);
  const carryOver = running?.priceBefore ?? null;

  await exec(`UPDATE smpg_price_meta SET state = 'DONE' WHERE material = ? AND state <> 'DONE'`, [
    material,
  ]);
  await exec(
    `INSERT INTO smpg_price_meta
       (material, target_price, strength, start_at, end_at, state, price_before, created_by)
     VALUES (?, ?, ?, NOW(), NOW() + INTERVAL ? MINUTE, 'PENDING', ?, ?)`,
    [material, targetPrice, strength, Math.max(1, Math.round(hours * 60)), carryOver, createdBy]
  );
  await bumpShopCacheVersion();
}

/**
 * Beendet eine laufende Meta vorzeitig. Eine aktive geht in die Rückkehr-Phase
 * (der Preis wandert genauso schnell zurück), eine noch wartende wird verworfen.
 */
export async function stopItemMeta(material: string): Promise<void> {
  await exec(`UPDATE smpg_price_meta SET state = 'DONE' WHERE material = ? AND state = 'PENDING'`, [
    material,
  ]);
  await exec(
    `UPDATE smpg_price_meta SET state = 'COOLDOWN', end_at = NOW()
     WHERE material = ? AND state = 'ACTIVE'`,
    [material]
  );
}

// ─── Preis-Einstellungen eines Items ───────────────────────────────────────

/**
 * Zählt den Änderungszähler hoch, den die Minecraft-Server im Auge behalten.
 * Ohne das würde eine hier geänderte Zahl erst beim nächsten Anpassungslauf
 * ingame ankommen – also womöglich erst zwölf Stunden später.
 */
async function bumpShopCacheVersion(): Promise<void> {
  await exec(
    `UPDATE smpg_shop_meta SET meta_value = CAST(meta_value AS UNSIGNED) + 1
     WHERE meta_key = 'shop_cache_version'`
  );
}

/**
 * Ändert StartWert, Unter-/Obergrenze und optional den aktuellen Verkaufspreis.
 *
 * Bewusst NICHT angefasst werden `sold_current` und `reset_at`: früher galt jede
 * Änderung als Neuanfang und hat die Volumen-Durchschnitte weggeworfen – genau
 * daran sind die Preise vorher ständig umgekippt.
 *
 * Die Änderung landet zusätzlich im Protokoll, damit sie als Marker im Graphen
 * auftaucht. Die Alt-Spalten (trend_days, intensity, …) werden dabei
 * unverändert durchgereicht; die neue Rechnung liest sie nicht mehr, sie sind
 * in der Protokolltabelle aber Pflichtfelder.
 *
 * @returns false, wenn es das Item nicht im dynamischen Preissystem gibt
 */
export async function updateItemSettings(
  material: string,
  startValue: number,
  minPrice: number,
  maxPrice: number,
  currentPrice: number | null
): Promise<boolean> {
  const rows = await query<{
    trend_days: number;
    intensity: string;
    trend_weight: string;
    gravity: string;
  }>(
    `SELECT trend_days, intensity, trend_weight, gravity
     FROM smpg_dynamic_prices WHERE material = ? LIMIT 1`,
    [material]
  );
  if (rows.length === 0) return false;
  const legacy = rows[0];

  await exec(
    `UPDATE smpg_dynamic_prices
        SET start_value = ?, min_price = ?, max_price = ?
      WHERE material = ?`,
    [startValue, minPrice, maxPrice, material]
  );

  if (currentPrice !== null) {
    await exec(
      `INSERT INTO smpg_sell_prices (material, sell_price) VALUES (?, ?)
       ON DUPLICATE KEY UPDATE sell_price = VALUES(sell_price)`,
      [material, currentPrice]
    );
  }

  const priceForLog =
    currentPrice ??
    (await query<{ sell_price: string }>(
      `SELECT sell_price FROM smpg_sell_prices WHERE material = ? LIMIT 1`,
      [material]
    ).then((r) => (r.length > 0 ? Number(r[0].sell_price) : startValue)));

  await exec(
    `INSERT INTO smpg_dynamic_price_log
       (material, changed_at, start_value, min_price, max_price,
        trend_days, intensity, trend_weight, gravity, current_price)
     VALUES (?, NOW(), ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      material,
      startValue,
      minPrice,
      maxPrice,
      legacy.trend_days,
      legacy.intensity,
      legacy.trend_weight,
      legacy.gravity,
      priceForLog,
    ]
  );

  await bumpShopCacheVersion();
  return true;
}

// ─── Marktpreis-Verlauf (Auktionshaus + Orders) ────────────────────────────

export type MarketDayPoint = {
  day: string;
  avgAuction: number | null;
  avgOrder: number | null;
};

/**
 * Tägliche Durchschnittspreise für ein Item:
 *  - avgAuction: Ø-Preis verkaufter Auktionshaus-Listings
 *  - avgOrder:   Ø-Preis-pro-Item in gelieferten Kaufaufträgen
 */
export async function loadItemMarketHistory(
  material: string,
  days: number | null
): Promise<MarketDayPoint[]> {
  const dayFilter = days !== null
    ? `AND created_at >= UNIX_TIMESTAMP(NOW() - INTERVAL ${Number(days)} DAY) * 1000`
    : "";

  const auctionRows = await query<{ day: string; avg_val: string }>(
    `SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS day,
            AVG(CASE WHEN listing_type = 'AUCTION' THEN current_bid ELSE price END) AS avg_val
     FROM smpg_auction_listings
     WHERE UPPER(item_material) = ?
       AND status NOT IN ('ACTIVE', 'CANCELLED', 'EXPIRED')
       AND created_at > 0
       ${dayFilter}
     GROUP BY day
     ORDER BY day ASC`,
    [material.toUpperCase()]
  );

  const orderRows = await query<{ day: string; avg_val: string }>(
    `SELECT DATE(FROM_UNIXTIME(created_at / 1000)) AS day,
            AVG(price_per_item) AS avg_val
     FROM smpg_orders
     WHERE UPPER(material) = ?
       AND delivered > 0
       AND created_at > 0
       ${dayFilter}
     GROUP BY day
     ORDER BY day ASC`,
    [material.toUpperCase()]
  );

  // Alle Tage aus beiden Quellen sammeln und zusammenführen
  const auctionMap = new Map(auctionRows.map((r) => [r.day, Number(r.avg_val)]));
  const orderMap = new Map(orderRows.map((r) => [r.day, Number(r.avg_val)]));
  const allDays = Array.from(new Set([...auctionMap.keys(), ...orderMap.keys()])).sort();

  return allDays.map((day) => ({
    day,
    avgAuction: auctionMap.has(day) ? auctionMap.get(day)! : null,
    avgOrder: orderMap.has(day) ? orderMap.get(day)! : null,
  }));
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

/** Verkaufsvolumen je Material der letzten 48 Stunden (für Sort "Meist verkauft"). */
export async function loadSold48h(): Promise<Record<string, number>> {
  const rows = await query<{ material: string; sold48h: string }>(
    `SELECT material, SUM(sold) AS sold48h
     FROM smpg_price_history
     WHERE ts >= NOW() - INTERVAL 48 HOUR
     GROUP BY material`
  );
  const result: Record<string, number> = {};
  for (const r of rows) {
    result[r.material] = Number(r.sold48h);
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

// ─── Auktionshaus ──────────────────────────────────────────────────────────

export type AuctionRow = {
  id: string;
  sellerName: string;
  itemName: string | null;
  itemMaterial: string;
  category: string;
  listingType: string;
  price: number;
  currentBid: number;
  currentBidderName: string | null;
  endTime: number | null;
  createdAt: number;
  status: string;
};

export async function loadActiveAuctions(): Promise<AuctionRow[]> {
  const rows = await query<{
    id: string;
    seller_name: string;
    item_name: string | null;
    item_material: string;
    category: string;
    listing_type: string;
    price: string;
    current_bid: string;
    current_bidder_name: string | null;
    end_time: string | null;
    created_at: string;
    status: string;
  }>(
    `SELECT id, seller_name, item_name, item_material, category, listing_type,
            price, current_bid, current_bidder_name, end_time, created_at, status
     FROM smpg_auction_listings
     WHERE status = 'ACTIVE'
     ORDER BY created_at DESC
     LIMIT 500`
  );
  return rows.map((r) => ({
    id: r.id,
    sellerName: r.seller_name,
    itemName: r.item_name,
    itemMaterial: r.item_material,
    category: r.category,
    listingType: r.listing_type,
    price: Number(r.price),
    currentBid: Number(r.current_bid),
    currentBidderName: r.current_bidder_name,
    endTime: r.end_time !== null ? Number(r.end_time) : null,
    createdAt: Number(r.created_at),
    status: r.status,
  }));
}

// ─── Orders ────────────────────────────────────────────────────────────────

export type OrderRow = {
  id: string;
  ownerName: string;
  material: string;
  itemName: string | null;
  amount: number;
  pricePerItem: number;
  delivered: number;
  collected: number;
  paidOut: number;
  createdAt: number;
  status: string;
};

export async function loadOpenOrders(): Promise<OrderRow[]> {
  const rows = await query<{
    id: string;
    owner_name: string;
    material: string;
    item_name: string | null;
    amount: string;
    price_per_item: string;
    delivered: string;
    collected: string;
    paid_out: string;
    created_at: string;
    status: string;
  }>(
    `SELECT id, owner_name, material, item_name, amount, price_per_item,
            delivered, collected, paid_out, created_at, status
     FROM smpg_orders
     WHERE status = 'OPEN'
     ORDER BY created_at DESC
     LIMIT 500`
  );
  return rows.map((r) => ({
    id: r.id,
    ownerName: r.owner_name,
    material: r.material,
    itemName: r.item_name,
    amount: Number(r.amount),
    pricePerItem: Number(r.price_per_item),
    delivered: Number(r.delivered),
    collected: Number(r.collected),
    paidOut: Number(r.paid_out),
    createdAt: Number(r.created_at),
    status: r.status,
  }));
}

// ─── Bounties (Kopfgeld) ────────────────────────────────────────────────────

export type BountyRow = {
  targetUuid: string;
  targetName: string;
  amount: number;
};

export async function loadBounties(): Promise<BountyRow[]> {
  const rows = await query<{
    target_uuid: string;
    target_name: string;
    amount: string;
  }>(
    `SELECT target_uuid, target_name, amount
     FROM smpg_bounties
     WHERE amount > 0
     ORDER BY amount DESC`
  );
  return rows.map((r) => ({
    targetUuid: r.target_uuid,
    targetName: r.target_name,
    amount: Number(r.amount),
  }));
}

// ─── Region-Registry (Server-Karte) ────────────────────────────────────────

export type RegionRow = {
  regionKey: string;
  rx: number;
  rz: number;
  serverName: string;
  lastHeartbeat: number;
  regionSize: number;
};

export async function loadRegions(): Promise<RegionRow[]> {
  const rows = await query<{
    region_key: string;
    rx: string;
    rz: string;
    server_name: string;
    last_heartbeat: string;
    region_size: string;
  }>(
    `SELECT region_key, rx, rz, server_name, last_heartbeat, region_size
     FROM smp_region_registry
     ORDER BY rx ASC, rz ASC`
  );
  return rows.map((r) => ({
    regionKey: r.region_key,
    rx: Number(r.rx),
    rz: Number(r.rz),
    serverName: r.server_name,
    lastHeartbeat: Number(r.last_heartbeat),
    regionSize: Number(r.region_size),
  }));
}

// ─── Mod-Queries ────────────────────────────────────────────────────────────

export type PunishmentRow = {
  id: number;
  type: "BAN" | "MUTE" | "WARN" | "KICK";
  reason: string;
  staffUuid: string | null;
  staffName: string | null;
  createdAt: number;
  expiresAt: number | null;
  active: boolean;
  targetIp: string | null;
};

export async function loadPlayerPunishments(uuid: string): Promise<PunishmentRow[]> {
  const rows = await query<{
    id: number;
    type: string;
    reason: string;
    staff_uuid: string | null;
    staff_name: string | null;
    created_at: number;
    expires_at: number | null;
    active: number;
    target_ip: string | null;
  }>(
    `SELECT p.id, p.type, p.reason, p.staff_uuid,
            tp.name AS staff_name,
            p.created_at, p.expires_at, p.active, p.target_ip
     FROM tryus_punishments p
     LEFT JOIN tryus_players tp ON tp.uuid = p.staff_uuid
     WHERE p.target_uuid = ?
     ORDER BY p.created_at DESC`,
    [uuid]
  );
  return rows.map((r) => ({
    id: r.id,
    type: r.type as PunishmentRow["type"],
    reason: r.reason,
    staffUuid: r.staff_uuid,
    staffName: r.staff_name,
    createdAt: Number(r.created_at),
    expiresAt: r.expires_at !== null ? Number(r.expires_at) : null,
    active: r.active === 1,
    targetIp: r.target_ip,
  }));
}

export type AnticheatFlagRow = {
  id: number;
  checkId: string;
  checkName: string;
  category: string;
  details: string;
  server: string;
  ping: number;
  tps: number;
  lagged: boolean;
  createdAt: number;
};

/**
 * Anticheat-Flags eines Spielers (aus tryus_anticheat_flags), neueste zuerst.
 * Enthaelt Ping/TPS zum Zeitpunkt des Flags, damit Mods Fehl-Bans erkennen koennen.
 * Faellt still auf [] zurueck, wenn die Tabelle (noch) nicht existiert.
 */
export async function loadPlayerAnticheatFlags(
  uuid: string,
  limit = 300
): Promise<AnticheatFlagRow[]> {
  const safeLimit = Math.max(1, Math.min(1000, Math.floor(limit)));
  const rows = await query<{
    id: number;
    check_id: string;
    check_name: string;
    category: string | null;
    details: string | null;
    server: string | null;
    ping: number | null;
    tps: number | null;
    lagged: number;
    created_at: number;
  }>(
    `SELECT id, check_id, check_name, category, details, server, ping, tps, lagged, created_at
     FROM tryus_anticheat_flags
     WHERE uuid = ?
     ORDER BY created_at DESC
     LIMIT ${safeLimit}`,
    [uuid]
  );
  return rows.map((r) => ({
    id: r.id,
    checkId: r.check_id,
    checkName: r.check_name,
    category: r.category ?? "",
    details: r.details ?? "",
    server: r.server ?? "",
    ping: r.ping !== null ? Number(r.ping) : -1,
    tps: r.tps !== null ? Number(r.tps) : 20,
    lagged: r.lagged === 1,
    createdAt: Number(r.created_at),
  }));
}

export type FriendRow = {
  friendUuid: string;
  friendName: string;
  friendSince: number;
  accepted: boolean;
};

export async function loadPlayerFriends(uuid: string): Promise<FriendRow[]> {
  const rows = await query<{
    friendUUID: string;
    name: string;
    friendSince: number;
    accepted: number;
  }>(
    `SELECT f.friendUUID, p.name, f.friendSince, f.accepted
     FROM friends f
     LEFT JOIN tryus_players p ON p.uuid = f.friendUUID
     WHERE f.playerUUID = ? AND f.accepted = 1
     ORDER BY f.friendSince DESC`,
    [uuid]
  );
  return rows.map((r) => ({
    friendUuid: r.friendUUID,
    friendName: r.name ?? r.friendUUID,
    friendSince: Number(r.friendSince),
    accepted: r.accepted === 1,
  }));
}

export type AltAccountRow = {
  uuid: string;
  name: string;
  sharedIp: string | null;
  via: "ip" | "trust";
};

export async function loadPlayerAltAccounts(uuid: string): Promise<AltAccountRow[]> {
  // Via trusted link
  const trustRows = await query<{ uuid: string; name: string }>(
    `SELECT DISTINCT p.uuid, p.name
     FROM tryus_trusts t
     JOIN tryus_players p ON p.uuid = IF(t.player_a = ?, t.player_b, t.player_a)
     WHERE (t.player_a = ? OR t.player_b = ?) AND p.uuid != ?`,
    [uuid, uuid, uuid, uuid]
  );

  // Via shared IP
  const ipRows = await query<{ uuid: string; name: string; ip: string }>(
    `SELECT DISTINCT p.uuid, p.name, ir2.ip
     FROM tryus_ip_records ir1
     JOIN tryus_ip_records ir2 ON ir2.ip = ir1.ip AND ir2.player_uuid != ir1.player_uuid
     JOIN tryus_players p ON p.uuid = ir2.player_uuid
     WHERE ir1.player_uuid = ?`,
    [uuid]
  );

  const result: AltAccountRow[] = [];
  const seen = new Set<string>();

  for (const r of trustRows) {
    if (!seen.has(r.uuid)) {
      seen.add(r.uuid);
      result.push({ uuid: r.uuid, name: r.name, sharedIp: null, via: "trust" });
    }
  }
  for (const r of ipRows) {
    if (!seen.has(r.uuid)) {
      seen.add(r.uuid);
      result.push({ uuid: r.uuid, name: r.name, sharedIp: r.ip, via: "ip" });
    }
  }
  return result;
}

export type PlayerClanInfo = {
  clanId: number;
  clanName: string;
  clanTag: string;
  rankId: number | null;
  rankName: string | null;
};

export async function loadPlayerClan(uuid: string): Promise<PlayerClanInfo | null> {
  const rows = await query<{
    clan_id: number;
    name: string;
    tag: string;
    rank_id: number | null;
    rank_name: string | null;
  }>(
    `SELECT cm.clan_id, c.name, c.tag, cm.rank_id, cr.name AS rank_name
     FROM tryus_clan_members cm
     JOIN tryus_clans c ON c.id = cm.clan_id
     LEFT JOIN tryus_clan_ranks cr ON cr.clan_id = cm.clan_id AND cr.id = cm.rank_id
     WHERE cm.uuid = ?
     LIMIT 1`,
    [uuid]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    clanId: Number(r.clan_id),
    clanName: r.name,
    clanTag: r.tag,
    rankId: r.rank_id !== null ? Number(r.rank_id) : null,
    rankName: r.rank_name,
  };
}

export type UnbanRequestRow = {
  id: number;
  actionType: string;
  targetUuid: string;
  targetName: string;
  /** Discord-Ticket-Titel / Betreff des Antrags (vom Bot befüllt). */
  reason: string;
  /** Was der Spieler selbst als Entschuldigung / Begründung geschrieben hat. */
  playerMessage: string | null;
  createdBy: string | null;
  status: string;
  createdAt: number;
  processedAt: number | null;
  resultMessage: string | null;
};

// ─── Ban-Liste ──────────────────────────────────────────────────────────────

export type BanRow = {
  id: number;
  targetUuid: string;
  targetName: string;
  reason: string;
  staffName: string | null;
  createdAt: number;
  /** null = permanent (DB-Wert 0 oder NULL), >0 = Ablauf-Timestamp in ms */
  expiresAt: number | null;
  active: boolean;
  /** Name des Mods der entbannt hat, null = automatisch abgelaufen / unbekannt */
  removedByName: string | null;
  /** Zeitpunkt der manuellen Aufhebung in ms, null = automatisch */
  removedAt: number | null;
};

/**
 * Alle Bans (aktive + aufgehobene), neueste zuerst.
 * expires_at = 0 im Proxy → permanent → wir mappen das auf null.
 */
export async function loadAllBans(): Promise<BanRow[]> {
  const rows = await query<{
    id: number;
    target_uuid: string;
    target_name: string | null;
    reason: string;
    staff_name: string | null;
    created_at: number;
    expires_at: number | null;
    active: number;
    removed_by_name: string | null;
    removed_at: number | null;
  }>(
    `SELECT p.id, p.target_uuid, tp.name AS target_name, p.reason,
            sp.name AS staff_name, p.created_at, p.expires_at, p.active,
            rp.name AS removed_by_name, p.removed_at
     FROM tryus_punishments p
     LEFT JOIN tryus_players tp ON tp.uuid = p.target_uuid
     LEFT JOIN tryus_players sp ON sp.uuid = p.staff_uuid
     LEFT JOIN tryus_players rp ON rp.uuid = p.removed_by
     WHERE p.type = 'BAN'
     ORDER BY p.created_at DESC
     LIMIT 500`
  );
  return rows.map((r) => {
    const rawExpiry = r.expires_at !== null ? Number(r.expires_at) : null;
    return {
      id: r.id,
      targetUuid: r.target_uuid,
      targetName: r.target_name ?? r.target_uuid,
      reason: r.reason,
      staffName: r.staff_name ?? null,
      createdAt: Number(r.created_at),
      // 0 = permanent im Proxy → null
      expiresAt: rawExpiry === null || rawExpiry === 0 ? null : rawExpiry,
      active: r.active === 1,
      removedByName: r.removed_by_name ?? null,
      removedAt: r.removed_at !== null ? Number(r.removed_at) : null,
    };
  });
}

// ─── Mutes / Warns / Kicks ─────────────────────────────────────────────────

export type RecentPunishmentRow = {
  id: number;
  type: "MUTE" | "WARN" | "KICK";
  targetUuid: string;
  targetName: string;
  reason: string;
  staffName: string | null;
  createdAt: number;
  expiresAt: number | null;
  active: boolean;
  removedByName: string | null;
  removedAt: number | null;
};

/**
 * Letzte Strafen eines bestimmten Typs (MUTE / WARN / KICK), neueste zuerst.
 * expires_at = 0 → permanent (Mutes).
 */
export async function loadRecentPunishments(
  type: "MUTE" | "WARN" | "KICK",
  limit = 300
): Promise<RecentPunishmentRow[]> {
  const rows = await query<{
    id: number;
    type: string;
    target_uuid: string;
    target_name: string | null;
    reason: string;
    staff_name: string | null;
    created_at: number;
    expires_at: number | null;
    active: number;
    removed_by_name: string | null;
    removed_at: number | null;
  }>(
    `SELECT p.id, p.type, p.target_uuid, tp.name AS target_name, p.reason,
            sp.name AS staff_name, p.created_at, p.expires_at, p.active,
            rp.name AS removed_by_name, p.removed_at
     FROM tryus_punishments p
     LEFT JOIN tryus_players tp ON tp.uuid = p.target_uuid
     LEFT JOIN tryus_players sp ON sp.uuid = p.staff_uuid
     LEFT JOIN tryus_players rp ON rp.uuid = p.removed_by
     WHERE p.type = ?
     ORDER BY p.created_at DESC
     LIMIT ?`,
    [type, limit]
  );
  return rows.map((r) => {
    const rawExpiry = r.expires_at !== null ? Number(r.expires_at) : null;
    return {
      id: r.id,
      type: r.type as RecentPunishmentRow["type"],
      targetUuid: r.target_uuid,
      targetName: r.target_name ?? r.target_uuid,
      reason: r.reason,
      staffName: r.staff_name ?? null,
      createdAt: Number(r.created_at),
      expiresAt: rawExpiry === null || rawExpiry === 0 ? null : rawExpiry,
      active: r.active === 1,
      removedByName: r.removed_by_name ?? null,
      removedAt: r.removed_at !== null ? Number(r.removed_at) : null,
    };
  });
}

// ─── Anticheat-Flags (global, neueste) ─────────────────────────────────────

export type RecentAnticheatFlagRow = {
  id: number;
  playerUuid: string;
  playerName: string;
  checkId: string;
  checkName: string;
  category: string;
  details: string;
  server: string;
  ping: number;
  tps: number;
  lagged: boolean;
  createdAt: number;
};

/**
 * Neueste Anticheat-Flags aller Spieler (global), neueste zuerst.
 * Fällt still auf [] zurück, wenn die Tabelle noch nicht existiert.
 */
export async function loadRecentAnticheatFlags(
  limit = 300
): Promise<RecentAnticheatFlagRow[]> {
  try {
    const rows = await query<{
      id: number;
      uuid: string;
      player_name: string | null;
      check_id: string;
      check_name: string;
      category: string | null;
      details: string | null;
      server: string | null;
      ping: number | null;
      tps: number | null;
      lagged: number;
      created_at: number;
    }>(
      `SELECT f.id, f.uuid, p.name AS player_name,
              f.check_id, f.check_name, f.category, f.details,
              f.server, f.ping, f.tps, f.lagged, f.created_at
       FROM tryus_anticheat_flags f
       LEFT JOIN tryus_players p ON p.uuid = f.uuid
       ORDER BY f.created_at DESC
       LIMIT ?`,
      [limit]
    );
    return rows.map((r) => ({
      id: r.id,
      playerUuid: r.uuid,
      playerName: r.player_name ?? r.uuid,
      checkId: r.check_id,
      checkName: r.check_name,
      category: r.category ?? "",
      details: r.details ?? "",
      server: r.server ?? "",
      ping: r.ping !== null ? Number(r.ping) : -1,
      tps: r.tps !== null ? Number(r.tps) : 20,
      lagged: r.lagged === 1,
      createdAt: Number(r.created_at),
    }));
  } catch {
    return [];
  }
}

// ─── Spieler-Statistiken ────────────────────────────────────────────────────

export type PlayerStats = {
  total: number;
  banned: number;
};

/** Gesamtzahl aller TryusPlayer + Anzahl gebannter Spieler. */
export async function loadPlayerStats(): Promise<PlayerStats> {
  const [totalRows, bannedRows] = await Promise.all([
    query<{ n: string }>(`SELECT COUNT(*) AS n FROM tryus_players`),
    query<{ n: string }>(
      `SELECT COUNT(DISTINCT target_uuid) AS n
       FROM tryus_punishments
       WHERE type = 'BAN' AND active = 1`
    ),
  ]);
  return {
    total: Number(totalRows[0]?.n ?? 0),
    banned: Number(bannedRows[0]?.n ?? 0),
  };
}

export async function loadUnbanRequests(): Promise<UnbanRequestRow[]> {
  const rows = await query<{
    id: number;
    action_type: string;
    target_uuid: string;
    target_name: string;
    reason: string;
    player_message: string | null;
    created_by: string | null;
    status: string;
    created_at: string | number;
    processed_at: string | number | null;
    result_message: string | null;
  }>(
    `SELECT id, action_type, target_uuid, target_name, reason, player_message, created_by,
            status, created_at, processed_at, result_message
     FROM tryus_bot_actions
     WHERE action_type IN ('MC_UNBAN', 'UNBAN_REQUEST', 'UNMUTE_REQUEST')
     ORDER BY created_at DESC
     LIMIT 200`
  );
  return rows.map((r) => ({
    id: r.id,
    actionType: r.action_type,
    targetUuid: r.target_uuid,
    targetName: r.target_name,
    reason: r.reason,
    playerMessage: r.player_message ?? null,
    createdBy: r.created_by,
    status: r.status,
    createdAt: Number(r.created_at),
    processedAt: r.processed_at !== null ? Number(r.processed_at) : null,
    resultMessage: r.result_message,
  }));
}

import { CLAN_PERMISSIONS } from "./clanPermissions";
export { CLAN_PERMISSIONS };
export type { ClanPermissionKey } from "./clanPermissions";

export type ClanRankDetail = {
  id: number;
  name: string;
  /** KLEINER = mächtiger. Der niedrigste Wert im Clan ist der Anführer-Rang. */
  priority: number;
  permissions: Record<string, boolean>;
};

export type ClanMemberDetail = {
  uuid: string;
  name: string;
  rankId: number | null;
  rankName: string | null;
  rankPriority: number | null;
};

export type ClanDetail = {
  id: number;
  name: string;
  description: string | null;
  tag: string;
  color: string | null;
  secondaryColor: string | null;
  /** NONE | GRADIENT | SWITCH – bestimmt, wie der Tag eingefärbt wird. */
  tagStyle: string;
  /** Formatierungscodes wie "l" (fett) oder "lo" (fett+kursiv). */
  formattingCodes: string;
  bankBalance: number;
  members: ClanMemberDetail[];
  ranks: ClanRankDetail[];
};

/** Kurzform für die Clan-Übersicht. */
export type ClanSummary = {
  id: number;
  name: string;
  description: string | null;
  tag: string;
  color: string | null;
  secondaryColor: string | null;
  tagStyle: string;
  formattingCodes: string;
  memberCount: number;
  /** Anführer laut niedrigster Rang-Priorität. */
  ownerName: string | null;
};

/**
 * Alle Clans für die Übersichtsseite – öffentlich, ohne Bankdaten.
 * Der Anführer wird über den Rang mit der KLEINSTEN Priorität ermittelt
 * (so macht es auch `Clan.getOwnerRank()` im Proxy-Plugin).
 */
export async function loadAllClans(): Promise<ClanSummary[]> {
  const rows = await query<{
    id: number;
    name: string;
    description: string | null;
    tag: string;
    color: string | null;
    secondary_color: string | null;
    tag_style: string | null;
    formatting_codes: string | null;
    member_count: number;
    owner_name: string | null;
  }>(
    `SELECT c.id, c.name, c.description, c.tag, c.color, c.secondary_color,
            c.tag_style, c.formatting_codes,
            (SELECT COUNT(*) FROM tryus_clan_members m WHERE m.clan_id = c.id) AS member_count,
            (SELECT p.name
               FROM tryus_clan_members m2
               JOIN tryus_clan_ranks r2 ON r2.clan_id = m2.clan_id AND r2.id = m2.rank_id
               JOIN tryus_players p ON p.uuid = m2.uuid
              WHERE m2.clan_id = c.id
              ORDER BY r2.priority ASC LIMIT 1) AS owner_name
       FROM tryus_clans c
      ORDER BY member_count DESC, c.name ASC`
  );
  return rows.map((r) => ({
    id: Number(r.id),
    name: r.name,
    description: r.description,
    tag: r.tag,
    color: r.color,
    secondaryColor: r.secondary_color,
    tagStyle: (r.tag_style ?? "NONE").toUpperCase(),
    formattingCodes: r.formatting_codes ?? "",
    memberCount: Number(r.member_count),
    ownerName: r.owner_name,
  }));
}

export async function loadClanDetail(clanId: number): Promise<ClanDetail | null> {
  const clans = await query<{
    id: number;
    name: string;
    description: string | null;
    tag: string;
    color: string | null;
    secondary_color: string | null;
    tag_style: string | null;
    formatting_codes: string | null;
    bank_balance: string;
  }>(
    `SELECT id, name, description, tag, color, secondary_color,
            tag_style, formatting_codes, bank_balance
     FROM tryus_clans WHERE id = ? LIMIT 1`,
    [clanId]
  );
  if (clans.length === 0) return null;
  const clan = clans[0];

  // Priorität AUFSTEIGEND: Der kleinste Wert ist der Anführer-Rang
  // (siehe Clan.getOwnerRank() im Proxy-Plugin – dort gewinnt die NIEDRIGSTE Zahl).
  const members = await query<{
    uuid: string;
    name: string;
    rank_id: number | null;
    rank_name: string | null;
    rank_priority: number | null;
  }>(
    `SELECT cm.uuid, p.name, cm.rank_id, cr.name AS rank_name, cr.priority AS rank_priority
     FROM tryus_clan_members cm
     JOIN tryus_players p ON p.uuid = cm.uuid
     LEFT JOIN tryus_clan_ranks cr ON cr.clan_id = cm.clan_id AND cr.id = cm.rank_id
     WHERE cm.clan_id = ?
     ORDER BY cr.priority ASC, p.name ASC`,
    [clanId]
  );

  // SELECT * statt Spaltenliste: Die perm_-Spalten wurden per ALTER TABLE
  // nachgerüstet und sind je nach Alter der Datenbank evtl. nicht alle vorhanden.
  const rankRows = await query<Record<string, unknown>>(
    `SELECT * FROM tryus_clan_ranks WHERE clan_id = ? ORDER BY priority ASC`,
    [clanId]
  );

  const ranks: ClanRankDetail[] = rankRows.map((r) => {
    const permissions: Record<string, boolean> = {};
    for (const perm of CLAN_PERMISSIONS) {
      const raw = r[perm.key];
      permissions[perm.key] = raw === 1 || raw === true || raw === "1";
    }
    return {
      id: Number(r.id),
      name: String(r.name),
      priority: Number(r.priority),
      permissions,
    };
  });

  return {
    id: Number(clan.id),
    name: clan.name,
    description: clan.description,
    tag: clan.tag,
    color: clan.color,
    secondaryColor: clan.secondary_color,
    tagStyle: (clan.tag_style ?? "NONE").toUpperCase(),
    formattingCodes: clan.formatting_codes ?? "",
    bankBalance: Number(clan.bank_balance),
    members: members.map((m) => ({
      uuid: m.uuid,
      name: m.name,
      rankId: m.rank_id !== null ? Number(m.rank_id) : null,
      rankName: m.rank_name,
      rankPriority: m.rank_priority !== null ? Number(m.rank_priority) : null,
    })),
    ranks,
  };
}

// ─── Wirtschaft-Bestenlisten ────────────────────────────────────────────────

export type LeaderboardEntry = {
  uuid: string;
  name: string;
  value: number;
};

/**
 * Top-N nach Geld (balance) absteigend.
 * Spieler mit Setting "konto" != 0 werden ausgeblendet.
 */
export async function loadTopMoney(limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await query<{ uuid: string; name: string; val: string }>(
    `SELECT e.\`uuid\` AS uuid, e.\`name\` AS name, e.\`balance\` AS val
     FROM \`smpg_economy\` e
     LEFT JOIN \`tryus_player_settings\` s
       ON s.\`player_uuid\` = e.\`uuid\` AND s.\`setting_key\` = 'konto'
     WHERE e.\`name\` IS NOT NULL
       AND COALESCE(s.\`setting_value\`, 0) = 0
     ORDER BY e.\`balance\` DESC LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({ uuid: r.uuid, name: r.name, value: Number(r.val) }));
}

/**
 * Top-N nach Spielzeit (onlineTime in ms) absteigend.
 * Spieler mit Setting "playtime_hover" != 0 werden ausgeblendet.
 */
export async function loadTopPlaytime(limit = 10): Promise<LeaderboardEntry[]> {
  const rows = await query<{ uuid: string; name: string; val: string }>(
    `SELECT p.\`uuid\` AS uuid, p.\`name\` AS name, p.\`onlineTime\` AS val
     FROM \`tryus_players\` p
     LEFT JOIN \`tryus_player_settings\` s
       ON s.\`player_uuid\` = p.\`uuid\` AND s.\`setting_key\` = 'playtime_hover'
     WHERE p.\`name\` IS NOT NULL
       AND COALESCE(s.\`setting_value\`, 0) = 0
     ORDER BY p.\`onlineTime\` DESC LIMIT ?`,
    [limit]
  );
  return rows.map((r) => ({ uuid: r.uuid, name: r.name, value: Number(r.val) }));
}

// ─── LuckPerms Admin-Check ─────────────────────────────────────────────────

/**
 * Prüft, ob ein Spieler (per UUID) die `*`-Berechtigung hat –
 * direkt oder über seine Gruppe(n) (bis 2 Ebenen Vererbung).
 * LuckPerms-Tabellen: luckperms_user_permissions, luckperms_group_permissions
 */
export async function loadIsAdmin(uuid: string): Promise<boolean> {
  try {
    const rows = await query<{ found: number }>(
      `SELECT 1 AS found
       FROM luckperms_user_permissions
       WHERE uuid = ? AND permission = '*' AND value = 1
         AND (expiry = 0 OR expiry > UNIX_TIMESTAMP())

       UNION

       SELECT 1 FROM luckperms_user_permissions u
       JOIN luckperms_group_permissions g
         ON g.name = SUBSTRING(u.permission, 7)
       WHERE u.uuid = ? AND u.permission LIKE 'group.%' AND u.value = 1
         AND (u.expiry = 0 OR u.expiry > UNIX_TIMESTAMP())
         AND g.permission = '*' AND g.value = 1
         AND (g.expiry = 0 OR g.expiry > UNIX_TIMESTAMP())

       UNION

       SELECT 1 FROM luckperms_user_permissions u
       JOIN luckperms_group_permissions g1
         ON g1.name = SUBSTRING(u.permission, 7)
       JOIN luckperms_group_permissions g2
         ON g2.name = SUBSTRING(g1.permission, 7)
       WHERE u.uuid = ? AND u.permission LIKE 'group.%' AND u.value = 1
         AND (u.expiry = 0 OR u.expiry > UNIX_TIMESTAMP())
         AND g1.permission LIKE 'group.%' AND g1.value = 1
         AND (g1.expiry = 0 OR g1.expiry > UNIX_TIMESTAMP())
         AND g2.permission = '*' AND g2.value = 1
         AND (g2.expiry = 0 OR g2.expiry > UNIX_TIMESTAMP())

       LIMIT 1`,
      [uuid, uuid, uuid]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

/**
 * Prüft, ob ein Spieler (per UUID) die `trycity.webmod`-Berechtigung hat –
 * direkt oder über seine Gruppe(n) (bis 2 Ebenen Vererbung). Admins (*) gelten auch als Mods.
 */
export async function loadIsMod(uuid: string): Promise<boolean> {
  try {
    // Admins sind automatisch auch Mods
    const isAdmin = await loadIsAdmin(uuid);
    if (isAdmin) return true;

    const perm = "trycity.webmod";
    const rows = await query<{ found: number }>(
      `SELECT 1 AS found
       FROM luckperms_user_permissions
       WHERE uuid = ? AND permission = ? AND value = 1
         AND (expiry = 0 OR expiry > UNIX_TIMESTAMP())

       UNION

       SELECT 1 FROM luckperms_user_permissions u
       JOIN luckperms_group_permissions g
         ON g.name = SUBSTRING(u.permission, 7)
       WHERE u.uuid = ? AND u.permission LIKE 'group.%' AND u.value = 1
         AND (u.expiry = 0 OR u.expiry > UNIX_TIMESTAMP())
         AND g.permission = ? AND g.value = 1
         AND (g.expiry = 0 OR g.expiry > UNIX_TIMESTAMP())

       UNION

       SELECT 1 FROM luckperms_user_permissions u
       JOIN luckperms_group_permissions g1
         ON g1.name = SUBSTRING(u.permission, 7)
       JOIN luckperms_group_permissions g2
         ON g2.name = SUBSTRING(g1.permission, 7)
       WHERE u.uuid = ? AND u.permission LIKE 'group.%' AND u.value = 1
         AND (u.expiry = 0 OR u.expiry > UNIX_TIMESTAMP())
         AND g1.permission LIKE 'group.%' AND g1.value = 1
         AND (g1.expiry = 0 OR g1.expiry > UNIX_TIMESTAMP())
         AND g2.permission = ? AND g2.value = 1
         AND (g2.expiry = 0 OR g2.expiry > UNIX_TIMESTAMP())

       LIMIT 1`,
      [uuid, perm, uuid, perm, uuid, perm]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ─── Web-Login-Sitzungs-Widerruf ───────────────────────────────────────────

/**
 * Prüft, ob die Sitzung widerrufen wurde.
 * Gibt true zurück, wenn die Sitzung VOR dem letzten Widerruf ausgestellt wurde.
 */
export async function isSessionRevoked(uuid: string, issuedAtSec: number): Promise<boolean> {
  try {
    const rows = await query<{ revoked_before: string }>(
      `SELECT revoked_before FROM smpg_web_session_revoke WHERE uuid = ? LIMIT 1`,
      [uuid]
    );
    if (rows.length === 0) return false;
    return issuedAtSec <= Number(rows[0].revoked_before);
  } catch {
    // Tabelle existiert noch nicht oder DB-Fehler → Sitzung als gültig behandeln
    return false;
  }
}

// ─── Web-Login Deaktiviert-Check ───────────────────────────────────────────

/**
 * Prüft, ob ein Spieler den Web-Login für seinen Account deaktiviert hat.
 * Gibt true zurück, wenn der Web-Login deaktiviert ist.
 */
export async function isWebLoginDisabled(playerName: string): Promise<boolean> {
  try {
    const rows = await query<{ setting_value: number }>(
      `SELECT s.setting_value
       FROM tryus_players p
       JOIN tryus_player_settings s ON s.player_uuid = p.uuid
       WHERE LOWER(p.name) = LOWER(?) AND s.setting_key = 'web_login_disabled'
       LIMIT 1`,
      [playerName]
    );
    return rows.length > 0 && rows[0].setting_value === 1;
  } catch {
    return false;
  }
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

// ─── Karten-Sync (smpg_map_sync, befüllt vom SMPGlobal-MapSync) ─────────────

export type SyncedMap = {
  originServer: string;
  originMapId: number;
  centerX: number;
  centerZ: number;
  scale: number;
  dimension: string;
  locked: boolean;
  updatedAt: string;
};

/** Alle synchronisierten Karten (nur Metadaten, keine Pixel). */
export async function loadSyncedMaps(): Promise<SyncedMap[]> {
  const rows = await query<{
    origin_server: string;
    origin_map_id: number;
    center_x: number;
    center_z: number;
    scale: number;
    dimension: string;
    locked: number;
    updated_at: string;
  }>(
    `SELECT origin_server, origin_map_id, center_x, center_z,
            scale, dimension, locked, updated_at
     FROM smpg_map_sync
     ORDER BY updated_at DESC`
  );
  return rows.map((r) => ({
    originServer: r.origin_server,
    originMapId: Number(r.origin_map_id),
    centerX: Number(r.center_x),
    centerZ: Number(r.center_z),
    scale: Number(r.scale),
    dimension: r.dimension,
    locked: Number(r.locked) === 1,
    updatedAt: r.updated_at,
  }));
}

/** Pixel-Blob (zlib-komprimiert) + Hash einer Karte – für das PNG-Rendering. */
export async function loadMapPixels(
  originServer: string,
  originMapId: number
): Promise<{ pixels: Buffer; pixelHash: string } | null> {
  const rows = await query<{ pixels: Buffer | null; pixel_hash: string }>(
    `SELECT pixels, pixel_hash FROM smpg_map_sync
     WHERE origin_server = ? AND origin_map_id = ?
     LIMIT 1`,
    [originServer, originMapId]
  );
  if (rows.length === 0 || rows[0].pixels === null) return null;
  return { pixels: rows[0].pixels, pixelHash: String(rows[0].pixel_hash) };
}

// ─── Creator-Codes ─────────────────────────────────────────────────────────

export type CreatorCodeRow = {
  code: string;
  ownerUuid: string;
  ownerName: string;
  createdAt: string;
};

/** @returns der Code des Spielers, oder null wenn er keiner ist. */
export async function loadCreatorCodeByOwner(
  uuid: string
): Promise<CreatorCodeRow | null> {
  const rows = await query<{
    code: string;
    owner_uuid: string;
    owner_name: string;
    created_at: string;
  }>(
    `SELECT code, owner_uuid, owner_name, created_at
     FROM smpg_creator_codes
     WHERE owner_uuid = ?
     LIMIT 1`,
    [uuid]
  );
  if (rows.length === 0) return null;
  return {
    code: rows[0].code,
    ownerUuid: rows[0].owner_uuid,
    ownerName: rows[0].owner_name,
    createdAt: rows[0].created_at,
  };
}

export type CreatorStats = {
  currentUsers: number;
  users30d: number;
  usersTotal: number;
  gemsTotal: number;
  gems30d: number;
  purchasesTotal: number;
};

/**
 * Nutzerzahlen zählen DISTINCT Spieler – trägt jemand denselben Code erneut
 * ein, zählt er weiterhin nur einmal.
 */
export async function loadCreatorStats(code: string): Promise<CreatorStats> {
  const [current, last30, total, earnings] = await Promise.all([
    query<{ n: string }>(
      `SELECT COUNT(DISTINCT player_uuid) AS n
       FROM smpg_creator_code_uses
       WHERE code = ? AND ended_at IS NULL AND expires_at > NOW()`,
      [code]
    ),
    query<{ n: string }>(
      `SELECT COUNT(DISTINCT player_uuid) AS n
       FROM smpg_creator_code_uses
       WHERE code = ? AND entered_at >= NOW() - INTERVAL 30 DAY`,
      [code]
    ),
    query<{ n: string }>(
      `SELECT COUNT(DISTINCT player_uuid) AS n
       FROM smpg_creator_code_uses
       WHERE code = ?`,
      [code]
    ),
    query<{ gems: string; gems30: string; purchases: string }>(
      `SELECT COALESCE(SUM(gems), 0) AS gems,
              COALESCE(SUM(CASE WHEN day >= CURDATE() - INTERVAL 30 DAY THEN gems ELSE 0 END), 0) AS gems30,
              COALESCE(SUM(purchases), 0) AS purchases
       FROM smpg_creator_earnings
       WHERE code = ?`,
      [code]
    ),
  ]);

  return {
    currentUsers: Number(current[0]?.n ?? 0),
    users30d: Number(last30[0]?.n ?? 0),
    usersTotal: Number(total[0]?.n ?? 0),
    gemsTotal: Number(earnings[0]?.gems ?? 0),
    gems30d: Number(earnings[0]?.gems30 ?? 0),
    purchasesTotal: Number(earnings[0]?.purchases ?? 0),
  };
}

export type CreatorEarningDay = {
  day: string;
  gems: number;
  purchases: number;
};

/** Verdienst pro Tag (ein Eintrag je Tag, neueste zuerst). */
export async function loadCreatorEarnings(
  code: string,
  days: number
): Promise<CreatorEarningDay[]> {
  const rows = await query<{ day: string; gems: string; purchases: string }>(
    `SELECT day, gems, purchases
     FROM smpg_creator_earnings
     WHERE code = ? AND day >= CURDATE() - INTERVAL ? DAY
     ORDER BY day DESC`,
    [code, days]
  );
  return rows.map((r) => ({
    day: r.day,
    gems: Number(r.gems),
    purchases: Number(r.purchases),
  }));
}

export type CreatorUserRow = {
  playerName: string;
  enteredAt: string;
  expiresAt: string;
};

/** Aktuell eingetragene Spieler (neueste zuerst). */
export async function loadCreatorActiveUsers(
  code: string
): Promise<CreatorUserRow[]> {
  const rows = await query<{
    player_name: string;
    entered_at: string;
    expires_at: string;
  }>(
    `SELECT player_name, entered_at, expires_at
     FROM smpg_creator_code_uses
     WHERE code = ? AND ended_at IS NULL AND expires_at > NOW()
     ORDER BY entered_at DESC
     LIMIT 100`,
    [code]
  );
  return rows.map((r) => ({
    playerName: r.player_name,
    enteredAt: r.entered_at,
    expiresAt: r.expires_at,
  }));
}
