import { query } from "@/lib/db";
import type {
  ClusterMetricPoint,
  InfraNode,
  InfraService,
  MetricRange,
  NodeMetricPoint,
  ServiceMetricPoint,
} from "@/lib/infraTypes";

export { METRIC_RANGES, parseRange } from "@/lib/infraTypes";

/**
 * Abfragen für die Infrastruktur-Ansicht (CloudNet-Nodes & -Services).
 *
 * Die Tabellen werden vom Proxy geschrieben (`InfraMetricsManager`) – bis auf
 * die Betriebssystem-Werte der VPS, die CloudNet gar nicht kennt: RAM und
 * Festplatte meldet das Server-Plugin (`HostMetricsReporter`) aus jedem
 * laufenden Service in `infra_host_live`.
 */

export type {
  ClusterMetricPoint,
  InfraNode,
  InfraService,
  MetricRange,
  NodeMetricPoint,
  ServiceMetricPoint,
} from "@/lib/infraTypes";

/**
 * Wählt Auflösung und Zeitfenster passend zum Bereich.
 *
 * Muss zur Verdichtung im Proxy passen: Rohdaten (30s) gibt es nur für 24h,
 * 5-Minuten-Mittel bis 7 Tage, darüber hinaus nur noch 30-Minuten-Mittel.
 */
function rangeToBucket(range: MetricRange): { bucket: number; sinceMs: number } {
  switch (range) {
    case "1h":
      return { bucket: 30, sinceMs: 60 * 60 * 1000 };
    case "6h":
      return { bucket: 30, sinceMs: 6 * 60 * 60 * 1000 };
    case "24h":
      return { bucket: 30, sinceMs: 24 * 60 * 60 * 1000 };
    case "7d":
      return { bucket: 300, sinceMs: 7 * 24 * 60 * 60 * 1000 };
    case "30d":
      return { bucket: 1800, sinceMs: 30 * 24 * 60 * 60 * 1000 };
    case "all":
      return { bucket: 1800, sinceMs: 0 };
  }
}

type Row = Record<string, string | number | null>;

// ─── Live-Zustand ───────────────────────────────────────────────────────────

/** Alle VPS mit CloudNet- und Betriebssystem-Werten. */
export async function loadInfraNodes(): Promise<InfraNode[]> {
  const rows = await query<Row>(
    `SELECT n.node_id, n.online, n.draining, n.cpu_system, n.mem_max_mb, n.mem_used_mb,
            n.mem_reserved_mb, n.services_count, n.players, n.host, n.cloudnet_version, n.updated_at,
            h.os_name, h.cpu_cores, h.load_average, h.ram_total, h.ram_free,
            h.disk_total, h.disk_free, h.updated_at AS host_updated_at
     FROM infra_node_live n
     LEFT JOIN infra_host_live h ON h.node_id = n.node_id
     ORDER BY n.node_id ASC`
  );
  return rows.map((r) => ({
    nodeId: String(r.node_id),
    online: Number(r.online) === 1,
    draining: Number(r.draining) === 1,
    cpuSystem: Number(r.cpu_system ?? -1),
    memMaxMb: Number(r.mem_max_mb ?? 0),
    memUsedMb: Number(r.mem_used_mb ?? 0),
    memReservedMb: Number(r.mem_reserved_mb ?? 0),
    servicesCount: Number(r.services_count ?? 0),
    players: Number(r.players ?? 0),
    host: String(r.host ?? ""),
    cloudnetVersion: String(r.cloudnet_version ?? ""),
    updatedAt: Number(r.updated_at ?? 0),
    osName: String(r.os_name ?? ""),
    cpuCores: Number(r.cpu_cores ?? 0),
    loadAverage: Number(r.load_average ?? -1),
    ramTotal: Number(r.ram_total ?? 0),
    ramFree: Number(r.ram_free ?? 0),
    diskTotal: Number(r.disk_total ?? 0),
    diskFree: Number(r.disk_free ?? 0),
    hostUpdatedAt: Number(r.host_updated_at ?? 0),
  }));
}

/** Alle laufenden Services – optional auf eine VPS eingeschränkt. */
export async function loadInfraServices(nodeId?: string): Promise<InfraService[]> {
  const rows = await query<Row>(
    `SELECT service_name, node_id, task_name, environment, lifecycle, connected, online,
            players, max_players, cpu, heap_used, heap_max, threads, address, port,
            created_at, updated_at
     FROM infra_service_live
     ${nodeId ? "WHERE node_id = ?" : ""}
     ORDER BY node_id ASC, service_name ASC`,
    nodeId ? [nodeId] : []
  );
  return rows.map((r) => ({
    serviceName: String(r.service_name),
    nodeId: String(r.node_id ?? ""),
    taskName: String(r.task_name ?? ""),
    environment: String(r.environment ?? ""),
    lifecycle: String(r.lifecycle ?? ""),
    connected: Number(r.connected) === 1,
    online: Number(r.online) === 1,
    players: Number(r.players ?? 0),
    maxPlayers: Number(r.max_players ?? 0),
    cpu: Number(r.cpu ?? -1),
    heapUsed: Number(r.heap_used ?? 0),
    heapMax: Number(r.heap_max ?? 0),
    threads: Number(r.threads ?? 0),
    address: String(r.address ?? ""),
    port: Number(r.port ?? 0),
    createdAt: Number(r.created_at ?? 0),
    updatedAt: Number(r.updated_at ?? 0),
  }));
}

export async function loadInfraService(serviceName: string): Promise<InfraService | null> {
  const rows = await loadInfraServices();
  return rows.find((s) => s.serviceName === serviceName) ?? null;
}

export async function loadInfraNode(nodeId: string): Promise<InfraNode | null> {
  const rows = await loadInfraNodes();
  return rows.find((n) => n.nodeId === nodeId) ?? null;
}

/**
 * Ordnet jedem SMP-Servernamen seine VPS zu – für die Server-Karte, die sonst
 * nur Regionen und Servernamen kennt.
 */
export async function loadServiceNodeMap(): Promise<Record<string, string>> {
  const rows = await query<Row>(
    `SELECT service_name, node_id FROM infra_service_live`
  );
  const map: Record<string, string> = {};
  for (const r of rows) map[String(r.service_name)] = String(r.node_id ?? "");
  return map;
}

// ─── Verlauf ────────────────────────────────────────────────────────────────

export async function loadNodeMetrics(
  nodeId: string,
  range: MetricRange
): Promise<NodeMetricPoint[]> {
  const { bucket, sinceMs } = rangeToBucket(range);
  const since = sinceMs === 0 ? 0 : Date.now() - sinceMs;

  const rows = await query<Row>(
    `SELECT ts, cpu_system, mem_used_mb, ram_used, ram_total, disk_used, disk_total,
            services_count, players
     FROM infra_node_metrics
     WHERE node_id = ? AND bucket_seconds = ? AND ts >= ?
     ORDER BY ts ASC`,
    [nodeId, bucket, since]
  );
  return rows.map((r) => ({
    t: Number(r.ts),
    cpuSystem: Number(r.cpu_system ?? -1),
    memUsedMb: Number(r.mem_used_mb ?? 0),
    ramUsed: Number(r.ram_used ?? 0),
    ramTotal: Number(r.ram_total ?? 0),
    diskUsed: Number(r.disk_used ?? 0),
    diskTotal: Number(r.disk_total ?? 0),
    services: Number(r.services_count ?? 0),
    players: Number(r.players ?? 0),
  }));
}

/**
 * Verlauf des gesamten Clusters – alle Nodes je Zeitstempel zusammengefasst.
 *
 * Die Erfassung rundet alle Zeitstempel auf ein Vielfaches der Auflösung, deshalb
 * lässt sich hier sauber nach {@code ts} gruppieren: alle Nodes einer Messrunde
 * haben denselben Wert.
 *
 * {@code NULLIF(cpu_system, -1)} filtert unbekannte CPU-Werte heraus, damit ein
 * einzelner Node ohne Messwert den Durchschnitt nicht nach unten zieht.
 */
export async function loadClusterMetrics(range: MetricRange): Promise<ClusterMetricPoint[]> {
  const { bucket, sinceMs } = rangeToBucket(range);
  const since = sinceMs === 0 ? 0 : Date.now() - sinceMs;

  const rows = await query<Row>(
    `SELECT ts,
            AVG(NULLIF(cpu_system, -1)) AS cpu_avg,
            MAX(NULLIF(cpu_system, -1)) AS cpu_max,
            SUM(ram_used)   AS ram_used,
            SUM(ram_total)  AS ram_total,
            SUM(disk_used)  AS disk_used,
            SUM(disk_total) AS disk_total,
            SUM(services_count) AS services,
            SUM(players) AS players,
            COUNT(*) AS nodes
     FROM infra_node_metrics
     WHERE bucket_seconds = ? AND ts >= ?
     GROUP BY ts
     ORDER BY ts ASC`,
    [bucket, since]
  );
  return rows.map((r) => ({
    t: Number(r.ts),
    cpuAvg: r.cpu_avg === null ? -1 : Number(r.cpu_avg),
    cpuMax: r.cpu_max === null ? -1 : Number(r.cpu_max),
    ramUsed: Number(r.ram_used ?? 0),
    ramTotal: Number(r.ram_total ?? 0),
    diskUsed: Number(r.disk_used ?? 0),
    diskTotal: Number(r.disk_total ?? 0),
    services: Number(r.services ?? 0),
    players: Number(r.players ?? 0),
    nodes: Number(r.nodes ?? 0),
  }));
}

export async function loadServiceMetrics(
  serviceName: string,
  range: MetricRange
): Promise<ServiceMetricPoint[]> {
  const { bucket, sinceMs } = rangeToBucket(range);
  const since = sinceMs === 0 ? 0 : Date.now() - sinceMs;

  const rows = await query<Row>(
    `SELECT ts, cpu, heap_used, heap_max, threads, players
     FROM infra_service_metrics
     WHERE service_name = ? AND bucket_seconds = ? AND ts >= ?
     ORDER BY ts ASC`,
    [serviceName, bucket, since]
  );
  return rows.map((r) => ({
    t: Number(r.ts),
    cpu: Number(r.cpu ?? -1),
    heapUsed: Number(r.heap_used ?? 0),
    heapMax: Number(r.heap_max ?? 0),
    threads: Number(r.threads ?? 0),
    players: Number(r.players ?? 0),
  }));
}

/**
 * Verlauf mehrerer Services auf einmal – für den direkten Vergleich
 * ("welcher Server zieht die meiste CPU?").
 */
export async function loadServiceMetricsMulti(
  serviceNames: string[],
  range: MetricRange
): Promise<Record<string, ServiceMetricPoint[]>> {
  if (serviceNames.length === 0) return {};
  const { bucket, sinceMs } = rangeToBucket(range);
  const since = sinceMs === 0 ? 0 : Date.now() - sinceMs;
  const placeholders = serviceNames.map(() => "?").join(",");

  const rows = await query<Row>(
    `SELECT service_name, ts, cpu, heap_used, heap_max, threads, players
     FROM infra_service_metrics
     WHERE service_name IN (${placeholders}) AND bucket_seconds = ? AND ts >= ?
     ORDER BY ts ASC`,
    [...serviceNames, bucket, since]
  );

  const grouped: Record<string, ServiceMetricPoint[]> = {};
  for (const r of rows) {
    const name = String(r.service_name);
    (grouped[name] ??= []).push({
      t: Number(r.ts),
      cpu: Number(r.cpu ?? -1),
      heapUsed: Number(r.heap_used ?? 0),
      heapMax: Number(r.heap_max ?? 0),
      threads: Number(r.threads ?? 0),
      players: Number(r.players ?? 0),
    });
  }
  return grouped;
}
