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
  diskTotal: number;
  diskFree: number;
  hostUpdatedAt: number;
};

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
