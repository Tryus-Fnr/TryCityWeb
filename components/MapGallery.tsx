"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { formatTs } from "@/lib/format";

type SyncedMap = {
  originServer: string;
  originMapId: number;
  centerX: number;
  centerZ: number;
  scale: number;
  dimension: string;
  locked: boolean;
  updatedAt: string;
};

function imageUrl(map: SyncedMap) {
  return `/api/maps/image?server=${encodeURIComponent(map.originServer)}&id=${map.originMapId}`;
}

function dimensionInfo(dimension: string): { icon: string; label: string } {
  switch (dimension) {
    case "NETHER":  return { icon: "🔥", label: "Nether" };
    case "THE_END": return { icon: "🌌", label: "End" };
    default:        return { icon: "🌍", label: "Oberwelt" };
  }
}

export default function MapGallery() {
  const [maps, setMaps] = useState<SyncedMap[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [serverFilter, setServerFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<SyncedMap | null>(null);

  useEffect(() => {
    fetch("/api/maps")
      .then((r) => r.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.maps)) setMaps(data.maps);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // ESC schließt die Detail-Ansicht
  useEffect(() => {
    if (!selected) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelected(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selected]);

  const servers = useMemo(
    () => [...new Set(maps.map((m) => m.originServer))].sort(),
    [maps]
  );

  const filtered = useMemo(() => {
    return maps.filter((m) => {
      if (serverFilter && m.originServer !== serverFilter) return false;
      if (search && !`${m.originMapId}`.includes(search.trim())) return false;
      return true;
    });
  }, [maps, serverFilter, search]);

  if (loading)
    return (
      <div className="flex h-32 items-center justify-center text-neutral-500">
        Lade Karten…
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-red-400">
        Karten konnten nicht geladen werden.
      </div>
    );

  if (maps.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-12 text-center text-neutral-500">
        <div className="mb-3 text-4xl">🗺️</div>
        <p>Noch keine Karten synchronisiert.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={serverFilter}
          onChange={(e) => setServerFilter(e.target.value)}
          className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 focus:border-sky-400/60 focus:outline-none"
        >
          <option value="">Alle Server ({maps.length})</option>
          {servers.map((s) => (
            <option key={s} value={s}>
              {s} ({maps.filter((m) => m.originServer === s).length})
            </option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Karten-ID suchen…"
          className="w-40 rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 placeholder:text-neutral-600 focus:border-sky-400/60 focus:outline-none"
        />
        <span className="ml-auto text-sm text-neutral-500">
          {filtered.length} {filtered.length === 1 ? "Karte" : "Karten"}
        </span>
      </div>

      {/* Galerie */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {filtered.map((map) => (
          <MapCard
            key={`${map.originServer}-${map.originMapId}`}
            map={map}
            onClick={() => setSelected(map)}
          />
        ))}
      </div>

      {/* Detail-Ansicht */}
      {selected && <MapDetail map={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function MapCard({ map, onClick }: { map: SyncedMap; onClick: () => void }) {
  const dim = dimensionInfo(map.dimension);
  return (
    <button
      onClick={onClick}
      className="group overflow-hidden rounded-xl border border-white/10 bg-white/[0.03] text-left transition-colors hover:border-sky-400/40"
    >
      <div className="relative aspect-square w-full bg-[repeating-conic-gradient(#1a1a1a_0%_25%,#111_0%_50%)] bg-[length:16px_16px]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl(map)}
          alt={`Karte ${map.originServer} #${map.originMapId}`}
          loading="lazy"
          width={128}
          height={128}
          className="h-full w-full"
          style={{ imageRendering: "pixelated" }}
        />
        {map.locked && (
          <span
            className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1 text-xs"
            title="Gesperrt (ändert sich nicht mehr)"
          >
            🔒
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-1 px-2.5 py-2">
        <span className="truncate text-xs font-semibold text-neutral-200">
          {map.originServer} <span className="text-sky-400">#{map.originMapId}</span>
        </span>
        <span className="shrink-0 text-xs" title={dim.label}>
          {dim.icon}
        </span>
      </div>
    </button>
  );
}

function MapDetail({ map, onClose }: { map: SyncedMap; onClose: () => void }) {
  const dim = dimensionInfo(map.dimension);
  const blocks = 128 * 2 ** map.scale;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-neutral-950 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
          <h2 className="font-semibold text-neutral-100">
            {map.originServer} <span className="text-sky-400">#{map.originMapId}</span>
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-100"
            aria-label="Schließen"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="bg-[repeating-conic-gradient(#1a1a1a_0%_25%,#111_0%_50%)] bg-[length:24px_24px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl(map)}
            alt={`Karte ${map.originServer} #${map.originMapId}`}
            width={128}
            height={128}
            className="mx-auto aspect-square w-full max-w-md"
            style={{ imageRendering: "pixelated" }}
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 py-4 text-sm">
          <dt className="text-neutral-500">Dimension</dt>
          <dd className="text-neutral-200">
            {dim.icon} {dim.label}
          </dd>
          <dt className="text-neutral-500">Zentrum</dt>
          <dd className="text-neutral-200">
            {map.centerX} / {map.centerZ}
          </dd>
          <dt className="text-neutral-500">Zoom</dt>
          <dd className="text-neutral-200">
            {map.scale}/4 ({blocks}×{blocks} Blöcke)
          </dd>
          <dt className="text-neutral-500">Status</dt>
          <dd className="text-neutral-200">{map.locked ? "🔒 Gesperrt" : "✏️ Aktualisierbar"}</dd>
          <dt className="text-neutral-500">Letztes Update</dt>
          <dd className="text-neutral-200">{formatTs(map.updatedAt)}</dd>
        </dl>
      </div>
    </div>
  );
}
