import { timingSafeEqual } from "crypto";

/**
 * Verteiler für Kauf-Meldungen aus dem Tebex-Webhook zur OBS-Overlay-Seite.
 *
 * Bewusst nur im Arbeitsspeicher: ein Alert ist ein Ereignis für den Moment,
 * in dem der Stream läuft. Nichts davon gehört in die Netzwerk-Datenbank.
 *
 * Der Zustand hängt an globalThis, nicht an einer Modul-Variablen. Im
 * Entwicklungsmodus lädt Next Module bei jeder Änderung neu – ohne das hätten
 * Webhook-Route und Stream-Route je einen eigenen, leeren Verteiler und die
 * Alerts kämen nie an. `next start` ist ein einzelner Node-Prozess, damit
 * reicht dieser Verteiler für alle verbundenen Overlays.
 */

export type TebexAlert = {
  /** Fortlaufend, dient als SSE-Event-ID für das Nachliefern nach Abbrüchen. */
  id: number;
  /** Spielername aus der Bestellung (bei Tebex der Minecraft-Name). */
  buyer: string;
  /** Gekaufte Produkte, schon als Text: z.B. "1x VIP Rang". */
  products: string[];
  amount?: number;
  currency?: string;
  /** Tebex-Transaktionsnummer – nur fürs Log, nicht fürs Overlay. */
  txn?: string;
  /** "renewal" = Abo-Verlängerung. Fehlt oder "purchase" = normaler Kauf. */
  kind?: "purchase" | "renewal";
  /** true, wenn über /api/alerts/test ausgelöst. */
  test?: boolean;
};

type Bus = {
  seq: number;
  clients: Set<(a: TebexAlert) => void>;
  history: TebexAlert[];
  /** Transaktionsnummer -> Zeitpunkt, an dem sie gemeldet wurde. */
  seenTxn: Map<string, number>;
};

const globalForBus = globalThis as unknown as { __tebexAlertBus?: Bus };

const bus: Bus = (globalForBus.__tebexAlertBus ??= {
  seq: 0,
  clients: new Set(),
  history: [],
  seenTxn: new Map(),
});

/** Wie viele Alerts für einen Wiederverbindungs-Nachschlag vorgehalten werden. */
const HISTORY_MAX = 50;

/** Neuen Alert an alle verbundenen Overlays schicken. */
export function pushAlert(alert: Omit<TebexAlert, "id">): TebexAlert {
  const full: TebexAlert = { ...alert, id: ++bus.seq };

  bus.history.push(full);
  if (bus.history.length > HISTORY_MAX) bus.history.shift();

  for (const client of bus.clients) {
    try {
      client(full);
    } catch (e) {
      // Ein hängender Overlay-Tab darf die anderen nicht mitreißen
      console.error("[tebexAlerts] Zustellung fehlgeschlagen", e);
    }
  }
  return full;
}

/** Wie lange eine Transaktionsnummer als "schon gemeldet" gilt. */
const TXN_WINDOW_MS = 10 * 60 * 1000;

/**
 * Transaktionsnummer beanspruchen. Liefert `false`, wenn zu dieser Nummer in
 * den letzten Minuten schon ein Alert lief.
 *
 * Hintergrund: Ein Abo-Kauf kann sowohl `payment.completed` als auch
 * `recurring-payment.started` auslösen – die Tebex-Doku legt sich nicht fest.
 * Beide tragen dieselbe Transaktionsnummer. Ohne diese Sperre stünde derselbe
 * Kauf zweimal im Stream, mit doppeltem Sound.
 *
 * Ohne Nummer (sollte nicht vorkommen) wird durchgelassen: lieber ein Alert
 * zu viel als ein verschluckter Kauf.
 */
export function claimTransaction(txn: string | undefined): boolean {
  if (!txn) return true;

  const now = Date.now();
  for (const [key, seenAt] of bus.seenTxn) {
    if (now - seenAt > TXN_WINDOW_MS) bus.seenTxn.delete(key);
  }

  if (bus.seenTxn.has(txn)) return false;
  bus.seenTxn.set(txn, now);
  return true;
}

/** Overlay anmelden. Rückgabe: Funktion zum Abmelden. */
export function subscribe(fn: (a: TebexAlert) => void): () => void {
  bus.clients.add(fn);
  return () => {
    bus.clients.delete(fn);
  };
}

/**
 * Alles, was nach `lastId` kam.
 *
 * Der Browser schickt beim automatischen Neuverbinden die zuletzt gesehene
 * ID im Header `Last-Event-ID` mit. Damit geht ein Kauf während eines kurzen
 * Aussetzers nicht verloren – nur ein Neustart des Dienstes leert den Verlauf.
 */
export function alertsSince(lastId: number): TebexAlert[] {
  if (!Number.isFinite(lastId) || lastId <= 0) return [];
  return bus.history.filter((a) => a.id > lastId);
}

/** Anzahl aktuell verbundener Overlays – für die Statusanzeige der Test-Route. */
export function clientCount(): number {
  return bus.clients.size;
}

/**
 * Zugangsschlüssel der Overlay-Seite prüfen (ALERT_OVERLAY_KEY).
 *
 * OBS hat keine Sitzung, deshalb steckt der Schlüssel in der URL. Die Seite
 * ist damit zwar öffentlich erreichbar, ohne Schlüssel bekommt aber niemand
 * die Kauf-Ereignisse zu sehen.
 */
export function overlayKeyOk(key: string | null): boolean {
  const expected = process.env.ALERT_OVERLAY_KEY;
  if (!expected) {
    console.error("[tebexAlerts] ALERT_OVERLAY_KEY fehlt – Overlay bleibt gesperrt");
    return false;
  }
  if (!key) return false;
  const a = Buffer.from(key, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
