"use client";

import { useEffect, useMemo, useState } from "react";
import ItemIcon from "@/components/ItemIcon";
import { formatMaterialName, formatMoney } from "@/lib/format";

type AuctionRow = {
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

const CATEGORIES = ["ALL", "BLOCKS", "FOOD", "TOOLS", "WEAPONS", "ARMOR", "MISC", "OTHER"];

function timeLeft(endTime: number): string {
  const diff = endTime - Date.now();
  if (diff <= 0) return "Abgelaufen";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((diff % 60000) / 1000);
  return `${m}m ${s}s`;
}

export default function AuctionBrowser() {
  const [listings, setListings] = useState<AuctionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("ALL");
  const [type, setType] = useState<"ALL" | "INSTANT_BUY" | "AUCTION">("ALL");
  const [sort, setSort] = useState<"NEWEST" | "PRICE_ASC" | "PRICE_DESC">("NEWEST");
  const [, setTick] = useState(0);

  useEffect(() => {
    fetch("/api/auction")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setListings(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  // Timer-Tick für Auktions-Countdown
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const filtered = useMemo(() => {
    let rows = listings;
    if (category !== "ALL") rows = rows.filter((r) => r.category === category);
    if (type !== "ALL") rows = rows.filter((r) => r.listingType === type);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.itemName ?? r.itemMaterial).toLowerCase().includes(q) ||
          r.sellerName.toLowerCase().includes(q)
      );
    }
    if (sort === "NEWEST") rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "PRICE_ASC") rows = [...rows].sort((a, b) => a.price - b.price);
    else rows = [...rows].sort((a, b) => b.price - a.price);
    return rows;
  }, [listings, category, type, search, sort]);

  if (loading)
    return (
      <div className="flex h-32 items-center justify-center text-neutral-500">
        Lade Auktionen…
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-red-400">
        Datenbank nicht erreichbar.
      </div>
    );

  return (
    <div className="flex flex-col gap-4">
      {/* Filter-Bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Suchen (Name, Verkäufer…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500/50"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "ALL" ? "Alle Kategorien" : c}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="ALL">Alle Typen</option>
          <option value="INSTANT_BUY">Sofortkauf</option>
          <option value="AUCTION">Auktion</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="NEWEST">Neueste</option>
          <option value="PRICE_ASC">Preis ↑</option>
          <option value="PRICE_DESC">Preis ↓</option>
        </select>
      </div>

      {/* Zähler */}
      <p className="text-sm text-neutral-500">
        {filtered.length} Einträge{" "}
        {listings.length !== filtered.length && `(von ${listings.length})`}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-500">
          Keine Einträge gefunden.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <AuctionCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function AuctionCard({ item }: { item: AuctionRow }) {
  const isAuction = item.listingType === "AUCTION";
  const displayName = item.itemName ?? formatMaterialName(item.itemMaterial);
  const displayPrice = isAuction
    ? item.currentBid > 0
      ? item.currentBid
      : item.price
    : item.price;

  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-sky-400/30 hover:bg-sky-400/[0.03] transition-colors">
      <div className="shrink-0 pt-0.5">
        <ItemIcon material={item.itemMaterial} size={40} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <span className="truncate font-medium text-neutral-100">{displayName}</span>
          <span
            className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${
              isAuction
                ? "bg-amber-500/15 text-amber-400"
                : "bg-sky-500/15 text-sky-400"
            }`}
          >
            {isAuction ? "Auktion" : "Sofortkauf"}
          </span>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-sm text-neutral-400">von {item.sellerName}</span>
          <span className="text-sm font-semibold text-emerald-400">
            {formatMoney(displayPrice)} $
          </span>
        </div>
        {isAuction && item.currentBidderName && (
          <div className="mt-1 text-xs text-neutral-500">
            Höchstbieter: <span className="text-neutral-300">{item.currentBidderName}</span>
          </div>
        )}
        {isAuction && item.endTime && (
          <div className="mt-1 text-xs text-amber-400/80">
            ⏱ {timeLeft(item.endTime)}
          </div>
        )}
        <div className="mt-1.5 flex items-center gap-2">
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-xs text-neutral-500">
            {item.category}
          </span>
        </div>
      </div>
    </div>
  );
}

