"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatMaterialName, formatMoney, formatPct } from "@/lib/format";

type Item = {
  material: string;
  price: number;
  startValue: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  yesterday: number | null;
};

const SORTS = [
  { key: "price-desc", label: "Höchster Preis" },
  { key: "price-asc", label: "Niedrigster Preis" },
  { key: "change", label: "Größte Änderung" },
  { key: "name", label: "Name A–Z" },
] as const;

export default function ItemBrowser() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string>("price-desc");

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setItems(d.items);
        else setError(d.error ?? "Fehler beim Laden.");
      })
      .catch(() => setError("Fehler beim Laden."));
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
      case "price-desc":
        list.sort((a, b) => b.price - a.price);
        break;
      case "price-asc":
        list.sort((a, b) => a.price - b.price);
        break;
      case "change":
        list.sort((a, b) => changeOf(b) - changeOf(a));
        break;
      case "name":
        list.sort((a, b) =>
          formatMaterialName(a.material).localeCompare(formatMaterialName(b.material))
        );
        break;
    }
    return list;
  }, [items, search, sort]);

  return (
    <div className="flex flex-col gap-4">
      {/* Suche + Sortierung */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Item suchen…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-emerald-400/50 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                sort === s.key
                  ? "bg-emerald-500/15 text-emerald-300"
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => {
            const change =
              item.yesterday && item.yesterday > 0
                ? ((item.price - item.yesterday) / item.yesterday) * 100
                : null;
            return (
              <Link
                key={item.material}
                href={`/items/${item.material.toLowerCase()}`}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-emerald-400/40 hover:bg-emerald-400/5"
              >
                <div className="truncate text-sm font-semibold group-hover:text-emerald-300">
                  {formatMaterialName(item.material)}
                </div>
                <div className="mt-2 text-lg font-bold text-emerald-400">
                  ${formatMoney(item.price)}
                </div>
                <div className="mt-1 flex items-center justify-between text-xs">
                  {change !== null && Math.abs(change) >= 0.05 ? (
                    <span className={change > 0 ? "text-emerald-400" : "text-red-400"}>
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
      )}
    </div>
  );
}
