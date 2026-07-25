/**
 * Typen und Konstanten der Infrastruktur-Ansicht – <b>ohne</b> Datenbankzugriff.
 *
 * Bewusst von {@link ./infra} getrennt: Client-Komponenten brauchen die Typen
 * und die Zeitraum-Liste, dürfen aber `lib/db` (mysql2) nicht importieren –
 * sonst landet der MySQL-Treiber im Browser-Bundle und der Build bricht ab.
 */

/** Eine VPS/Root-Server ("Node" in CloudNet-Sprache). */
export type InfraNode = {
  nodeId: string;
  online: boolean;
  draining: boolean;
  /** CPU-Last der gesamten Maschine, 0..1. -1 = unbekannt. */
  cpuSystem: number;
  /** CloudNets Speicherbudget in MB – NICHT der RAM der Maschine. */
  memMaxMb: number;
  memUsedMb: number;
  memReservedMb: number;
  servicesCount: number;
  players: number;
  host: string;
  cloudnetVersion: string;
  updatedAt: number;
  /** OS-Werte – 0, wenn auf dieser VPS kein Server mit Reporter läuft. */
  osName: string;
  cpuCores: number;
  loadAverage: number;
  ramTotal: number;
  ramFree: number;
  /**
   * Wirklich von Programmen belegt – <b>ohne</b> Cache, Puffer und Shared.
   *
   * Nicht mit "total − free" verwechseln: Linux füllt jeden ungenutzten Block
   * mit Datei-Cache und gibt ihn beim ersten Bedarf sofort wieder her. Die
   * Differenz sieht wie Auslastung aus, ist aber keine.
   */
  ramUsed: number;
  /** Was ohne Swappen noch vergeben werden kann (Cache zählt mit). */
  ramAvailable: number;
  ramBuffers: number;
  ramCached: number;
  ramShared: number;
  swapTotal: number;
  swapFree: number;
  diskTotal: number;
  diskFree: number;
  hostUpdatedAt: number;
};

/** Aufteilung des Arbeitsspeichers – dieselben Kategorien wie im htop-Balken. */
export const MEMORY_SEGMENTS = [
  { key: "used", label: "Belegt", color: "#34d399", hint: "von Programmen genutzt" },
  { key: "buffers", label: "Puffer", color: "#60a5fa", hint: "Kernel-Puffer, wird bei Bedarf frei" },
  { key: "shared", label: "Shared", color: "#c084fc", hint: "z.B. tmpfs und /dev/shm" },
  { key: "cached", label: "Cache", color: "#fbbf24", hint: "Datei-Cache, wird bei Bedarf sofort frei" },
] as const;

/** Ein CloudNet-Service – Minecraft-Server oder Proxy. */
export type InfraService = {
  serviceName: string;
  nodeId: string;
  taskName: string;
  environment: string;
  lifecycle: string;
  connected: boolean;
  online: boolean;
  players: number;
  maxPlayers: number;
  /** Prozess-CPU 0..1, -1 = unbekannt. */
  cpu: number;
  heapUsed: number;
  heapMax: number;
  threads: number;
  address: string;
  port: number;
  createdAt: number;
  updatedAt: number;
};

export type NodeMetricPoint = {
  t: number;
  cpuSystem: number;
  memUsedMb: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
  services: number;
  players: number;
};

/**
 * Ein Zeitpunkt über den GESAMTEN Cluster – alle Nodes zusammengefasst.
 *
 * RAM und Speicherplatz werden summiert (das ergibt die echte Gesamtkapazität),
 * die CPU dagegen gemittelt: eine Summe von Prozentwerten wäre sinnlos. Zusätzlich
 * steht der höchste Einzelwert daneben, damit ein einzelner heißlaufender Node
 * nicht im Durchschnitt untergeht.
 */
export type ClusterMetricPoint = {
  t: number;
  /** Mittlere CPU-Last über alle Nodes, 0..1. */
  cpuAvg: number;
  /** Höchste CPU-Last eines einzelnen Nodes, 0..1. */
  cpuMax: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
  services: number;
  players: number;
  /** Wie viele Nodes zu diesem Zeitpunkt gemeldet haben. */
  nodes: number;
};

export type ServiceMetricPoint = {
  t: number;
  cpu: number;
  heapUsed: number;
  heapMax: number;
  threads: number;
  players: number;
};

/**
 * Ein Start-/Stopp-Ereignis, das als Marker in den Diagrammen erscheint.
 *
 * Die Zeitpunkte kommen vom Proxy: Service-Start und -Stopp aus CloudNet-Events
 * (sekundengenau), "betretbar" und Node-Ausfälle aus dem Vergleich zweier
 * Messrunden (auf 30 s genau).
 */
export type InfraEvent = {
  id: number;
  t: number;
  /** "SERVICE" oder "NODE". */
  kind: string;
  type: InfraEventType;
  /** Service- bzw. Node-Name. */
  target: string;
  nodeId: string;
  detail: string;
};

export type InfraEventType =
  | "SERVICE_STARTED"
  | "SERVICE_ONLINE"
  | "SERVICE_STOPPED"
  | "NODE_ONLINE"
  | "NODE_OFFLINE";

/** Farbe und Beschriftung je Ereignistyp – überall gleich, damit man sie wiedererkennt. */
export const EVENT_STYLE: Record<InfraEventType, { label: string; color: string }> = {
  SERVICE_STARTED: { label: "Start", color: "#38bdf8" },
  SERVICE_ONLINE: { label: "Betretbar", color: "#34d399" },
  SERVICE_STOPPED: { label: "Stopp", color: "#fb7185" },
  NODE_ONLINE: { label: "Node online", color: "#a78bfa" },
  NODE_OFFLINE: { label: "Node offline", color: "#f43f5e" },
};

export function eventStyle(type: string): { label: string; color: string } {
  return EVENT_STYLE[type as InfraEventType] ?? { label: type, color: "#a3a3a3" };
}

export type MetricRange = "1h" | "6h" | "24h" | "7d" | "30d" | "all";

export const METRIC_RANGES: { key: MetricRange; label: string }[] = [
  { key: "1h", label: "1 Stunde" },
  { key: "6h", label: "6 Stunden" },
  { key: "24h", label: "24 Stunden" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "all", label: "Gesamt" },
];

/** Validiert einen Zeitraum aus der URL. Unbekannte Werte fallen auf 24h zurück. */
export function parseRange(value: string | null): MetricRange {
  const allowed: MetricRange[] = ["1h", "6h", "24h", "7d", "30d", "all"];
  return allowed.includes(value as MetricRange) ? (value as MetricRange) : "24h";
}
