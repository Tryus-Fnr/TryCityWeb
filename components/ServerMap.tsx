"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

type RegionRow = {
  regionKey: string;
  rx: number;
  rz: number;
  serverName: string;
  lastHeartbeat: number;
  regionSize: number;
};

/** Heartbeat-Timeout: 90 Sekunden (analog zum Minecraft-Plugin) */
const HEARTBEAT_TIMEOUT_MS = 90_000;

function isLive(row: RegionRow): boolean {
  if (row.lastHeartbeat <= 0) return false;
  return Date.now() - row.lastHeartbeat < HEARTBEAT_TIMEOUT_MS;
}

/**
 * Grenzen einer Region in Weltkoordinaten.
 *
 * Regionen sind um ihren Mittelpunkt zentriert, nicht an der Ecke verankert –
 * der Weltnullpunkt liegt also MITTEN in Region (0,0) und nicht dort, wo vier
 * Regionen zusammenstoßen. Das entspricht RegionGrid.getRegionMinX/MaxX im
 * Plugin: rx * size ± size/2.
 *
 * Bei regionSize 25000 geht Region (0,0) damit von -12500 bis 12500.
 */
function formatCoords(rx: number, rz: number, regionSize: number) {
  const half = regionSize / 2;
  const x1 = rx * regionSize - half;
  const z1 = rz * regionSize - half;
  const x2 = rx * regionSize + half;
  const z2 = rz * regionSize + half;
  return { x1, z1, x2, z2 };
}

/** Kurzform großer Blockzahlen: 12500 → "12,5k" */
function formatBlocks(value: number): string {
  const abs = Math.abs(value);
  if (abs < 1000) return String(value);
  const k = value / 1000;
  return `${k.toLocaleString("de-DE", { maximumFractionDigits: 1 })}k`;
}

const CELL_SIZE = 120; // px per cell at zoom=1
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;

export default function ServerMap() {
  const [regions, setRegions] = useState<RegionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState<RegionRow | null>(null);
  const [, setTick] = useState(0);
  /** Servername → VPS/Node. Kommt aus der Infrastruktur-Erfassung des Proxys. */
  const [nodeMap, setNodeMap] = useState<Record<string, string>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Die Region-Registry weiß nicht, auf welcher Maschine ein Server läuft –
  // das steht nur in den CloudNet-Daten. Fehlt der Endpunkt, bleibt die
  // Karte einfach ohne VPS-Angabe.
  useEffect(() => {
    fetch("/api/infra", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { ok?: boolean; services?: { serviceName: string; nodeId: string }[] }) => {
        if (!data?.ok || !Array.isArray(data.services)) return;
        const map: Record<string, string> = {};
        for (const s of data.services) map[s.serviceName] = s.nodeId;
        setNodeMap(map);
      })
      .catch(() => setNodeMap({}));
  }, []);

  useEffect(() => {
    fetch("/api/servermap")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setRegions(data);
          // Initial-Pan: auf das Zentrum aller Regionen zentrieren
          if (data.length > 0) {
            const minRx = Math.min(...data.map((r: RegionRow) => r.rx));
            const maxRx = Math.max(...data.map((r: RegionRow) => r.rx));
            const minRz = Math.min(...data.map((r: RegionRow) => r.rz));
            const maxRz = Math.max(...data.map((r: RegionRow) => r.rz));
            const centerRx = (minRx + maxRx) / 2;
            const centerRz = (minRz + maxRz) / 2;
            setPan({
            x: -centerRx * CELL_SIZE + (typeof window !== "undefined" ? window.innerWidth / 2 : 400),
            y: -centerRz * CELL_SIZE + 300,
            });
          }
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Heartbeat-Tick alle 5 Sekunden
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, []);

  // Wheel-Zoom
  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor));

      // Zoom zur Mausposition hin
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      const scaleChange = newZoom / zoom;
      setPan((p) => ({
        x: mx - scaleChange * (mx - p.x),
        y: my - scaleChange * (my - p.y),
      }));
      setZoom(newZoom);
    },
    [zoom]
  );

  // Drag
  // Merkt sich, ob seit dem Mausklick wirklich gezogen wurde – sonst würde
  // jedes Verschieben der Karte als Klick auf eine Region gelten.
  const dragMoved = useRef(false);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setDragging(true);
      dragMoved.current = false;
      setDragStart({ x: e.clientX, y: e.clientY });
      setPanStart({ x: pan.x, y: pan.y });
    },
    [pan]
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      if (Math.abs(e.clientX - dragStart.x) > 3 || Math.abs(e.clientY - dragStart.y) > 3) {
        dragMoved.current = true;
      }
      setPan({
        x: panStart.x + (e.clientX - dragStart.x),
        y: panStart.y + (e.clientY - dragStart.y),
      });
    },
    [dragging, dragStart, panStart]
  );

  const onMouseUp = useCallback(() => setDragging(false), []);

  // Touch-Drag
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const touchPanStart = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      touchPanStart.current = { x: pan.x, y: pan.y };
    }
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && touchStart.current) {
      setPan({
        x: touchPanStart.current.x + (e.touches[0].clientX - touchStart.current.x),
        y: touchPanStart.current.y + (e.touches[0].clientY - touchStart.current.y),
      });
    }
  };

  if (loading)
    return (
      <div className="flex h-64 items-center justify-center text-neutral-500">
        Lade Server-Karte…
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-red-400">
        Datenbank nicht erreichbar.
      </div>
    );

  if (regions.length === 0)
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-500">
        Keine Server registriert.
      </div>
    );

  const liveCount = regions.filter(isLive).length;

  // Ausdehnung der gesamten bespielbaren Welt: von der westlichsten bis zur
  // oestlichsten Region, jeweils bis zur aeusseren Kante.
  const regionSize = regions[0]?.regionSize ?? 0;
  const worldMinX = Math.min(...regions.map((r) => r.rx)) * regionSize - regionSize / 2;
  const worldMaxX = Math.max(...regions.map((r) => r.rx)) * regionSize + regionSize / 2;
  const worldMinZ = Math.min(...regions.map((r) => r.rz)) * regionSize - regionSize / 2;
  const worldMaxZ = Math.max(...regions.map((r) => r.rz)) * regionSize + regionSize / 2;
  const worldWidth = worldMaxX - worldMinX;
  const worldDepth = worldMaxZ - worldMinZ;

  return (
    <div className="flex flex-col gap-4">
      {/* Legende + Infos */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-3 w-3 rounded-full bg-emerald-500" />
          <span className="text-neutral-300">Aktiv ({liveCount})</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="h-3 w-3 rounded-full bg-red-500" />
          <span className="text-neutral-300">Offline ({regions.length - liveCount})</span>
        </div>
        <div className="text-sm text-neutral-500">
          <span className="text-neutral-300">
            {regionSize.toLocaleString("de-DE")}
          </span>{" "}
          Blöcke pro Region
        </div>
        <div className="text-sm text-neutral-500">
          Welt{" "}
          <span className="text-neutral-300">
            {formatBlocks(worldWidth)} × {formatBlocks(worldDepth)}
          </span>{" "}
          Blöcke · X {formatBlocks(worldMinX)} … {formatBlocks(worldMaxX)} · Z{" "}
          {formatBlocks(worldMinZ)} … {formatBlocks(worldMaxZ)}
        </div>
        <div className="ml-auto flex gap-2">
          <button
            onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z * 1.3))}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
          >
            +
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z / 1.3))}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
          >
            −
          </button>
          <button
            onClick={() => {
              setZoom(1);
              if (regions.length > 0) {
                const minRx = Math.min(...regions.map((r) => r.rx));
                const maxRx = Math.max(...regions.map((r) => r.rx));
                const minRz = Math.min(...regions.map((r) => r.rz));
                const maxRz = Math.max(...regions.map((r) => r.rz));
                const centerRx = (minRx + maxRx) / 2;
                const centerRz = (minRz + maxRz) / 2;
                const w = containerRef.current?.clientWidth ?? 800;
                const h = containerRef.current?.clientHeight ?? 500;
                setPan({
                  x: w / 2 - centerRx * CELL_SIZE,
                  y: h / 2 - centerRz * CELL_SIZE,
                });
              }
            }}
            className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-sm hover:bg-white/10"
          >
            Reset
          </button>
          <span className="self-center text-xs text-neutral-500">
            {Math.round(zoom * 100)}%
          </span>
        </div>
      </div>

      {/* Karten-Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-hidden rounded-2xl border border-white/10 bg-neutral-950"
        style={{ height: 520, cursor: dragging ? "grabbing" : "grab" }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={() => { touchStart.current = null; }}
      >
        {/* Grid-Hintergrund */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundSize: `${CELL_SIZE * zoom}px ${CELL_SIZE * zoom}px`,
            backgroundPosition: `${(pan.x + (CELL_SIZE * zoom) / 2) % (CELL_SIZE * zoom)}px ${(pan.y + (CELL_SIZE * zoom) / 2) % (CELL_SIZE * zoom)}px`,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
          }}
        />

        {/* Koordinaten-Ursprung (0,0) */}
        <div
          className="absolute pointer-events-none"
          style={{
            left: pan.x,
            top: pan.y,
            width: 0,
            height: 0,
          }}
        >
          {/* Achsen */}
          <div
            className="absolute bg-sky-500/20"
            style={{
              left: -5000 * zoom,
              top: -1,
              width: 10000 * zoom,
              height: 2,
            }}
          />
          <div
            className="absolute bg-sky-500/20"
            style={{
              left: -1,
              top: -5000 * zoom,
              width: 2,
              height: 10000 * zoom,
            }}
          />
          <div
            className="absolute -left-3 -top-3 flex h-6 w-6 items-center justify-center rounded-full bg-sky-500/30 text-xs font-bold text-sky-400"
            style={{ fontSize: 10 }}
          >
            0
          </div>
          {/* Achsenbeschriftung – ohne die weiß niemand, welche Richtung was ist */}
          <div
            className="absolute font-mono text-sky-500/70"
            style={{ left: 10, top: -16, fontSize: 10 }}
          >
            +X →
          </div>
          <div
            className="absolute font-mono text-sky-500/70"
            style={{ left: 6, top: 12, fontSize: 10 }}
          >
            +Z ↓
          </div>
        </div>

        {/* Region-Zellen */}
        <div
          style={{
            position: "absolute",
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: "0 0",
          }}
        >
          {regions.map((region) => {
            const live = isLive(region);
            const { x1, z1, x2, z2 } = formatCoords(region.rx, region.rz, region.regionSize);
            // Wie beim Blick auf eine Minecraft-Karte: X nach rechts, Z nach unten.
            // Die Zelle wird um ihren Mittelpunkt gelegt, weil Regionen zentriert
            // sind – so liegt der Nullpunkt in der Mitte von (0,0) und nicht
            // dort, wo vier Regionen zusammenstoßen.
            const cellX = region.rx * CELL_SIZE - CELL_SIZE / 2;
            const cellY = region.rz * CELL_SIZE - CELL_SIZE / 2;

            return (
              <div
                key={region.regionKey}
                style={{
                  position: "absolute",
                  left: cellX,
                  top: cellY,
                  width: CELL_SIZE - 4,
                  height: CELL_SIZE - 4,
                  margin: 2,
                }}
                className={`cursor-pointer rounded-lg border transition-all select-none ${
                  live
                    ? "border-emerald-500/60 bg-emerald-500/10 hover:border-emerald-400 hover:bg-emerald-500/20"
                    : "border-red-500/40 bg-red-500/5 hover:border-red-400/60 hover:bg-red-500/10"
                }`}
                onMouseEnter={() => setHovered(region)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => {
                  if (dragMoved.current) return;
                  router.push(`/infra/service/${encodeURIComponent(region.serverName)}`);
                }}
              >
                {/* Status-Punkt */}
                <div
                  className={`absolute right-2 top-2 h-2 w-2 rounded-full ${
                    live ? "bg-emerald-400 shadow-[0_0_6px_#34d399]" : "bg-red-500"
                  }`}
                />

                {/* Inhalt */}
                <div className="flex h-full flex-col items-center justify-center gap-1 p-2 text-center">
                  <div
                    className={`text-xs font-bold leading-tight ${
                      live ? "text-emerald-300" : "text-red-400"
                    }`}
                    style={{ fontSize: Math.max(8, 12 * Math.min(zoom, 1)) }}
                  >
                    {region.serverName}
                  </div>
                  <div
                    className="text-neutral-500 font-mono leading-tight"
                    style={{ fontSize: Math.max(7, 9 * Math.min(zoom, 1)) }}
                  >
                    ({region.rx}:{region.rz})
                  </div>
                  {zoom >= 0.7 && (
                    <div
                      className="text-neutral-600 font-mono leading-snug"
                      style={{ fontSize: Math.max(6, 8 * Math.min(zoom, 1)) }}
                    >
                      X {formatBlocks(x1)} … {formatBlocks(x2)}
                      <br />
                      Z {formatBlocks(z1)} … {formatBlocks(z2)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Tooltip */}
        {hovered && <RegionTooltip region={hovered} node={nodeMap[hovered.serverName]} />}

        {/* Hinweis */}
        <div className="absolute bottom-3 left-3 text-xs text-neutral-600 select-none pointer-events-none">
          Scrollrad zum Zoomen · Ziehen zum Verschieben
        </div>

        {/* Maßstab: eine Kachel entspricht genau einer Region */}
        <div className="absolute bottom-3 right-3 select-none pointer-events-none text-right">
          <div
            className="ml-auto border-x border-b border-neutral-500"
            style={{ width: CELL_SIZE * zoom, height: 6 }}
          />
          <div className="mt-1 font-mono text-xs text-neutral-500">
            {formatBlocks(regionSize)} Blöcke
          </div>
        </div>
      </div>

      {/* Tabelle */}
      <details className="rounded-xl border border-white/10 bg-white/[0.03]">
        <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-neutral-300 hover:text-white">
          Alle Server ({regions.length}) als Tabelle anzeigen
        </summary>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-neutral-500">
                <th className="px-4 py-2 text-left">Status</th>
                <th className="px-4 py-2 text-left">Server</th>
                <th className="px-4 py-2 text-left">VPS</th>
                <th className="px-4 py-2 text-left">Region (rx:rz)</th>
                <th className="px-4 py-2 text-left">Block X</th>
                <th className="px-4 py-2 text-left">Block Z</th>
                <th className="px-4 py-2 text-left">Größe</th>
                <th className="px-4 py-2 text-left">Letzter Heartbeat</th>
              </tr>
            </thead>
            <tbody>
              {[...regions]
                .sort((a, b) => (isLive(b) ? 1 : 0) - (isLive(a) ? 1 : 0))
                .map((r) => {
                  const live = isLive(r);
                  const { x1, z1, x2, z2 } = formatCoords(r.rx, r.rz, r.regionSize);
                  const hbAgo = r.lastHeartbeat > 0
                    ? Math.round((Date.now() - r.lastHeartbeat) / 1000)
                    : null;
                  return (
                    <tr key={r.regionKey} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-xs font-semibold ${
                            live
                              ? "bg-emerald-500/15 text-emerald-400"
                              : "bg-red-500/15 text-red-400"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${live ? "bg-emerald-400" : "bg-red-500"}`}
                          />
                          {live ? "Aktiv" : "Offline"}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium">
                        <a
                          href={`/infra/service/${encodeURIComponent(r.serverName)}`}
                          className="text-sky-300 hover:underline"
                        >
                          {r.serverName}
                        </a>
                      </td>
                      <td className="px-4 py-2">
                        {nodeMap[r.serverName] ? (
                          <a
                            href={`/infra/node/${encodeURIComponent(nodeMap[r.serverName])}`}
                            className="text-neutral-300 hover:text-sky-300 hover:underline"
                          >
                            {nodeMap[r.serverName]}
                          </a>
                        ) : (
                          <span className="text-neutral-600">–</span>
                        )}
                      </td>
                      <td className="px-4 py-2 font-mono text-neutral-400">
                        {r.rx}:{r.rz}
                      </td>
                      <td className="px-4 py-2 font-mono text-neutral-400">
                        {x1.toLocaleString("de-DE")} – {x2.toLocaleString("de-DE")}
                      </td>
                      <td className="px-4 py-2 font-mono text-neutral-400">
                        {z1.toLocaleString("de-DE")} – {z2.toLocaleString("de-DE")}
                      </td>
                      <td className="px-4 py-2 text-neutral-500">
                        {r.regionSize.toLocaleString("de-DE")} Blöcke
                      </td>
                      <td className="px-4 py-2 text-neutral-500">
                        {hbAgo === null
                          ? "–"
                          : hbAgo < 60
                          ? `vor ${hbAgo}s`
                          : hbAgo < 3600
                          ? `vor ${Math.round(hbAgo / 60)}min`
                          : `vor ${Math.round(hbAgo / 3600)}h`}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function RegionTooltip({ region, node }: { region: RegionRow; node?: string }) {
  const live = isLive(region);
  const { x1, z1, x2, z2 } = formatCoords(region.rx, region.rz, region.regionSize);
  const hbAgo = region.lastHeartbeat > 0
    ? Math.round((Date.now() - region.lastHeartbeat) / 1000)
    : null;

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-10 rounded-xl border border-white/20 bg-neutral-900/95 p-3 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-2">
        <div
          className={`h-2 w-2 rounded-full ${live ? "bg-emerald-400" : "bg-red-500"}`}
        />
        <span className="font-bold text-neutral-100">{region.serverName}</span>
        <span
          className={`rounded px-1.5 py-0.5 text-xs font-semibold ${
            live ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          }`}
        >
          {live ? "Aktiv" : "Offline"}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <span className="text-neutral-500">VPS</span>
        <span className="font-mono text-neutral-300">{node ?? "–"}</span>
        <span className="text-neutral-500">Region</span>
        <span className="font-mono text-neutral-300">({region.rx}:{region.rz})</span>
        <span className="text-neutral-500">X-Bereich</span>
        <span className="font-mono text-neutral-300">
          {x1.toLocaleString("de-DE")} – {x2.toLocaleString("de-DE")}
        </span>
        <span className="text-neutral-500">Z-Bereich</span>
        <span className="font-mono text-neutral-300">
          {z1.toLocaleString("de-DE")} – {z2.toLocaleString("de-DE")}
        </span>
        <span className="text-neutral-500">Region-Größe</span>
        <span className="font-mono text-neutral-300">
          {region.regionSize.toLocaleString("de-DE")} Blöcke
        </span>
        <span className="text-neutral-500">Heartbeat</span>
        <span className="font-mono text-neutral-300">
          {hbAgo === null
            ? "–"
            : hbAgo < 60
            ? `vor ${hbAgo}s`
            : hbAgo < 3600
            ? `vor ${Math.round(hbAgo / 60)}min`
            : `vor ${Math.round(hbAgo / 3600)}h`}
        </span>
      </div>
    </div>
  );
}



