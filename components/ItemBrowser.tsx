"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatMaterialName, formatMoney, formatPct } from "@/lib/format";
import ItemIcon from "@/components/ItemIcon";

type Item = {
  material: string;
  price: number;
  startValue: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  yesterday: number | null;
};

type SparklinePoint = { day: string; price: number };

const SORTS = [
  { key: "price-desc", label: "Höchster Preis" },
  { key: "price-asc", label: "Niedrigster Preis" },
  { key: "change", label: "Größte Änderung" },
  { key: "name", label: "Name A–Z" },
] as const;

const PAGE_SIZE = 50;

export default function ItemBrowser() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string>("price-desc");
  const [sparklines, setSparklines] = useState<Record<string, SparklinePoint[]>>({});
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setItems(d.items);
        else setError(d.error ?? "Fehler beim Laden.");
      })
      .catch(() => setError("Fehler beim Laden."));

    fetch("/api/items/sparklines")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSparklines(d.sparklines); })
      .catch(() => {/* silent */});
  }, []);

  const filtered = useMemo(() => {
    if (!items) return [];
    const q = search.trim().toLowerCase().replace(/ /g, "_");
    let list = items.filter(
      (i) =>
        q.length === 0 ||
        i.material.toLowerCase().includes(q) ||
        formatMaterialName(i.material).toLowerCase().includes(search.trim().toLowerCase())
    );
    const changeOf = (i: Item) =>
      i.yesterday && i.yesterday > 0 ? Math.abs((i.price - i.yesterday) / i.yesterday) : 0;
    list = [...list];
    switch (sort) {
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "price-asc":  list.sort((a, b) => a.price - b.price); break;
      case "change":     list.sort((a, b) => changeOf(b) - changeOf(a)); break;
      case "name":       list.sort((a, b) => formatMaterialName(a.material).localeCompare(formatMaterialName(b.material))); break;
    }
    return list;
  }, [items, search, sort]);

  // Reset page wenn sich Suche/Sortierung ändert
  useEffect(() => { setPage(0); }, [search, sort]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {/* Suche + Sortierung */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Item suchen…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-400/50 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                sort === s.key
                  ? "bg-sky-500/15 text-sky-300"
                  : "border border-white/10 text-neutral-400 hover:bg-white/5"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {items && (
          <span className="text-sm text-neutral-500 sm:ml-auto">{filtered.length} Items</span>
        )}
      </div>

      {/* Grid */}
      {error ? (
        <div className="rounded-2xl border border-white/10 p-12 text-center text-neutral-500">
          {error}
        </div>
      ) : !items ? (
        <div className="rounded-2xl border border-white/10 p-12 text-center text-neutral-500">
          Lade…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {paged.map((item) => {
              const change =
                item.yesterday && item.yesterday > 0
                  ? ((item.price - item.yesterday) / item.yesterday) * 100
                  : null;
              const spark = sparklines[item.material] ?? [];
              return (
                <Link
                  key={item.material}
                  href={`/items/${item.material.toLowerCase()}`}
                  className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-sky-400/40 hover:bg-sky-400/5"
                >
                  <div className="flex items-center gap-2.5">
                    <ItemIcon material={item.material} size={28} className="shrink-0" />
                    <div className="truncate text-sm font-semibold group-hover:text-sky-300">
                      {formatMaterialName(item.material)}
                    </div>
                  </div>
                  {spark.length > 1 && <MiniSparkline points={spark} className="mt-3" />}
                  <div className="mt-2 text-lg font-bold text-sky-400">
                    ${formatMoney(item.price)}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    {change !== null && Math.abs(change) >= 0.05 ? (
                      <span className={change > 0 ? "text-sky-400" : "text-red-400"}>
                        {formatPct(change)} <span className="text-neutral-600">24h</span>
                      </span>
                    ) : (
                      <span className="text-neutral-600">± 0 % 24h</span>
                    )}
                    <span className="text-neutral-600">Verlauf →</span>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <Pagination page={page} pageCount={pageCount} total={filtered.length} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}

/** Pagination bar */
function Pagination({
  page, pageCount, total, onPage,
}: {
  page: number; pageCount: number; total: number; onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-neutral-500">
        Seite {page + 1} / {pageCount}
        <span className="ml-2 text-neutral-600">({total} gesamt)</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { onPage(0); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page === 0}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default"
        >«</button>
        <button
          onClick={() => { onPage(page - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page === 0}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default"
        >Zurück</button>
        <button
          onClick={() => { onPage(page + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page >= pageCount - 1}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default"
        >Weiter</button>
        <button
          onClick={() => { onPage(pageCount - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page >= pageCount - 1}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default"
        >»</button>
      </div>
    </div>
  );
}

/** Winzige SVG-Sparkline für den Preisverlauf. */
function MiniSparkline({
  points,
  className = "",
}: {
  points: SparklinePoint[];
  className?: string;
}) {
  const W = 160;
  const H = 36;
  const prices = points.map((p) => p.price);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const range = max - min || 1;

  const xs = points.map((_, i) => (i / (points.length - 1)) * W);
  const ys = prices.map((p) => H - ((p - min) / range) * (H - 4) - 2);

  const d =
    xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ") +
    ` L${W},${H} L0,${H} Z`;

  const line = xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`)
    .join(" ");

  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? "#34d399" : "#f87171";

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full ${className}`}
      style={{ height: H }}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={`sg-${isUp}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.3} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={d} fill={`url(#sg-${isUp})`} />
      <path d={line} fill="none" stroke={color} strokeWidth="1.5" />
    </svg>
  );
}
