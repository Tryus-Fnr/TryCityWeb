"use client";

import { useEffect, useMemo, useState } from "react";
import ItemIcon from "@/components/ItemIcon";
import { formatMaterialName, formatMoney } from "@/lib/format";

type OrderRow = {
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

export default function OrderBrowser() {
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"NEWEST" | "PRICE_ASC" | "PRICE_DESC" | "REMAINING">("NEWEST");

  useEffect(() => {
    fetch("/api/orders")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setOrders(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    let rows = orders;
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          (r.itemName ?? r.material).toLowerCase().includes(q) ||
          r.ownerName.toLowerCase().includes(q)
      );
    }
    if (sort === "NEWEST") rows = [...rows].sort((a, b) => b.createdAt - a.createdAt);
    else if (sort === "PRICE_ASC") rows = [...rows].sort((a, b) => a.pricePerItem - b.pricePerItem);
    else if (sort === "PRICE_DESC") rows = [...rows].sort((a, b) => b.pricePerItem - a.pricePerItem);
    else
      rows = [...rows].sort(
        (a, b) => (b.amount - b.delivered) - (a.amount - a.delivered)
      );
    return rows;
  }, [orders, search, sort]);

  if (loading)
    return (
      <div className="flex h-32 items-center justify-center text-neutral-500">
        Lade Orders…
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-red-400">
        Datenbank nicht erreichbar.
      </div>
    );

  const totalValue = filtered.reduce(
    (sum, r) => sum + (r.amount - r.delivered) * r.pricePerItem,
    0
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Filter-Bar */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Suchen (Item, Auftraggeber…)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-500/50"
        />
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as typeof sort)}
          className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-2 text-sm"
        >
          <option value="NEWEST">Neueste</option>
          <option value="PRICE_ASC">Preis/Stück ↑</option>
          <option value="PRICE_DESC">Preis/Stück ↓</option>
          <option value="REMAINING">Restmenge ↓</option>
        </select>
      </div>

      {/* Übersicht-Kacheln */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-2xl font-bold text-sky-400">{filtered.length}</div>
          <div className="mt-1 text-xs text-neutral-500">Offene Orders</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-2xl font-bold text-emerald-400">
            {filtered.reduce((s, r) => s + r.amount - r.delivered, 0).toLocaleString("de-DE")}
          </div>
          <div className="mt-1 text-xs text-neutral-500">Benötigte Items</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">
            {formatMoney(totalValue)} $
          </div>
          <div className="mt-1 text-xs text-neutral-500">Gesamtwert</div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-10 text-center text-neutral-500">
          Keine offenen Orders gefunden.
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </div>
      )}
    </div>
  );
}

function OrderCard({ order }: { order: OrderRow }) {
  const remaining = order.amount - order.delivered;
  const progress = order.amount > 0 ? (order.delivered / order.amount) * 100 : 0;
  const displayName = order.itemName ?? formatMaterialName(order.material);
  const totalCost = order.amount * order.pricePerItem;
  const remainingCost = remaining * order.pricePerItem;

  return (
    <div className="flex gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-sky-400/30 hover:bg-sky-400/[0.03] transition-colors">
      <div className="shrink-0 pt-0.5">
        <ItemIcon material={order.material} size={44} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <span className="font-semibold text-neutral-100">{displayName}</span>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-neutral-400">
              {order.pricePerItem.toLocaleString("de-DE", { maximumFractionDigits: 2 })} $/Stk
            </span>
            <span className="font-semibold text-emerald-400">{formatMoney(remainingCost)} $</span>
          </div>
        </div>

        <div className="mt-2 flex items-center gap-3 text-sm text-neutral-400">
          <span>Auftraggeber: <span className="text-neutral-200">{order.ownerName}</span></span>
          <span className="text-neutral-600">·</span>
          <span>
            {order.delivered.toLocaleString("de-DE")} / {order.amount.toLocaleString("de-DE")} Stk geliefert
          </span>
          <span className="text-neutral-600">·</span>
          <span className="text-amber-400">
            {remaining.toLocaleString("de-DE")} noch benötigt
          </span>
        </div>

        {/* Fortschrittsbalken */}
        <div className="mt-2 h-1.5 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-sky-500 transition-all"
            style={{ width: `${Math.min(100, progress)}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-neutral-600">
          <span>{progress.toFixed(1)}% geliefert</span>
          <span>Gesamt: {formatMoney(totalCost)} $</span>
        </div>
      </div>
    </div>
  );
}

