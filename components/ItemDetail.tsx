"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ItemIcon from "@/components/ItemIcon";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  BarChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMaterialName, formatMoney, formatTs } from "@/lib/format";

type Detail = {
  ok: boolean;
  error?: string;
  currentPrice: number | null;
  settings: {
    startValue: number;
    minPrice: number;
    maxPrice: number;
    trendDays: number;
    gravity: number;
  } | null;
  history: { ts: string; price: number; sold: number }[];
  changes: { changedAt: string; startValue: number; currentPrice: number }[];
};

type MarketPoint = {
  day: string;
  avgAuction: number | null;
  avgOrder: number | null;
};

type MergedPoint = {
  ts: string;
  price: number;
  sold: number;
  avgAuction: number | null;
  avgOrder: number | null;
};

const SERIES = [
  { key: "price",      label: "Shoppreis",      color: "#34d399" },
  { key: "avgAuction", label: "Ø Auktionshaus", color: "#a78bfa" },
  { key: "avgOrder",   label: "Ø Kaufauftrag",  color: "#fb923c" },
] as const;

const RANGES = [
  { key: "14d", label: "14 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "90d", label: "90 Tage" },
  { key: "all", label: "Alles" },
] as const;

export default function ItemDetail({ material }: { material: string }) {
  const [range, setRange] = useState<string>("14d");
  const [data, setData] = useState<Detail | null>(null);
  const [market, setMarket] = useState<MarketPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const load = useCallback(
    async (r: string) => {
      setLoading(true);
      try {
        const [detailRes, marketRes] = await Promise.all([
          fetch(`/api/items/${material}?range=${r}`),
          fetch(`/api/items/${material}/market?range=${r}`),
        ]);
        setData((await detailRes.json()) as Detail);
        const mj = await marketRes.json();
        setMarket(mj.ok && Array.isArray(mj.data) ? mj.data : []);
      } catch {
        setData(null);
        setMarket([]);
      } finally {
        setLoading(false);
      }
    },
    [material]
  );

  useEffect(() => { load(range); }, [range, load]);

  // Merge price history with daily market averages
  const merged = useMemo<MergedPoint[]>(() => {
    if (!data?.history) return [];
    const byDay = new Map<string, { avgAuction: number | null; avgOrder: number | null }>();
    for (const m of market) byDay.set(m.day, { avgAuction: m.avgAuction, avgOrder: m.avgOrder });
    return data.history.map((h) => {
      const day = h.ts.split(" ")[0]; // "2026-07-13"
      const mkt = byDay.get(day);
      return { ...h, avgAuction: mkt?.avgAuction ?? null, avgOrder: mkt?.avgOrder ?? null };
    });
  }, [data?.history, market]);

  const toggleSeries = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const name = formatMaterialName(material);
  const firstTs = data?.history[0]?.ts ?? null;
  const visibleChanges =
    data?.changes.filter((c) => firstTs !== null && c.changedAt >= firstTs) ?? [];

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/items" className="text-sm text-neutral-500 hover:text-neutral-300">
            ← Alle Items
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <ItemIcon material={material} size={40} />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
              <div className="mt-0.5 font-mono text-sm text-neutral-500">{material}</div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-neutral-500">Aktueller Verkaufspreis</div>
          <div className="text-4xl font-extrabold text-emerald-400">
            {data?.currentPrice !== null && data?.currentPrice !== undefined
              ? `$${formatMoney(data.currentPrice)}`
              : "–"}
          </div>
        </div>
      </div>

      {/* Einstellungen */}
      {data?.settings && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard label="StartWert" value={`$${formatMoney(data.settings.startValue)}`} />
          <InfoCard label="Untergrenze" value={`$${formatMoney(data.settings.minPrice)}`} />
          <InfoCard label="Obergrenze" value={`$${formatMoney(data.settings.maxPrice)}`} />
          <InfoCard label="Trend-Zeitraum" value={`${data.settings.trendDays} Tage`} />
        </div>
      )}

      {/* Zeitraum */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              range === r.key
                ? "bg-sky-500/15 text-sky-300"
                : "border border-white/10 text-neutral-400 hover:bg-white/5"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Kombinierter Preisvergleich-Graph ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-1 px-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Preisvergleich</h2>
          <span className="text-xs text-neutral-600">Legende anklicken zum Ein-/Ausblenden</span>
        </div>

        {loading ? (
          <div className="flex h-80 items-center justify-center text-neutral-500">Lade…</div>
        ) : !data?.ok || merged.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-neutral-500">
            {data?.error ?? "Keine Daten für diesen Zeitraum."}
          </div>
        ) : (
          <>
            {/* Klickbare Legende */}
            <div className="mb-4 flex flex-wrap gap-3 px-2">
              {SERIES.map((s) => {
                const off = hidden.has(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSeries(s.key)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all border"
                    style={{
                      borderColor: off ? "rgba(255,255,255,0.1)" : s.color + "55",
                      background: off ? "transparent" : s.color + "14",
                      color: off ? "#525252" : s.color,
                      opacity: off ? 0.5 : 1,
                    }}
                  >
                    <span
                      className="inline-block h-2 w-4 rounded-full"
                      style={{ background: off ? "#525252" : s.color }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={merged} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad-price" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis
                  dataKey="ts"
                  tickFormatter={formatTs}
                  stroke="#525252"
                  tick={{ fill: "#737373", fontSize: 12 }}
                  minTickGap={60}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  stroke="#525252"
                  tick={{ fill: "#737373", fontSize: 12 }}
                  tickFormatter={(v) => `$${v}`}
                />
                <Tooltip
                  contentStyle={{
                    background: "#171717",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#ededed",
                  }}
                  labelFormatter={(ts) => formatTs(String(ts))}
                  formatter={(value, key) => {
                    const s = SERIES.find((x) => x.key === key);
                    return [`$${formatMoney(Number(value))}`, s?.label ?? String(key)];
                  }}
                  filterNull
                />
                {/* Admin-Änderungsmarker */}
                {visibleChanges.map((c, i) => (
                  <ReferenceLine
                    key={i}
                    x={nearestTs(data.history, c.changedAt)}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: "Änderung", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }}
                  />
                ))}
                {/* Shoppreis als Area */}
                <Area
                  type="monotone"
                  dataKey="price"
                  stroke="#34d399"
                  strokeWidth={hidden.has("price") ? 0 : 2}
                  fill={hidden.has("price") ? "none" : "url(#grad-price)"}
                  hide={hidden.has("price")}
                  dot={false}
                  legendType="none"
                />
                {/* Ø Auktionshaus */}
                <Line
                  type="monotone"
                  dataKey="avgAuction"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  hide={hidden.has("avgAuction")}
                  legendType="none"
                />
                {/* Ø Kaufauftrag */}
                <Line
                  type="monotone"
                  dataKey="avgOrder"
                  stroke="#fb923c"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  hide={hidden.has("avgOrder")}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Volumen-Graph (bleibt separat) */}
      {data?.ok && data.history.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-2 px-2 text-sm font-medium text-neutral-400">
            Verkauftes Volumen pro Lauf
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.history} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={formatTs}
                stroke="#525252"
                tick={{ fill: "#737373", fontSize: 12 }}
                minTickGap={60}
              />
              <YAxis
                allowDecimals={false}
                stroke="#525252"
                tick={{ fill: "#737373", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#171717",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  color: "#ededed",
                }}
                labelFormatter={(ts) => formatTs(String(ts))}
                formatter={(value) => [String(value), "Verkauft"]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="sold" fill="rgba(52,211,153,0.5)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function nearestTs(history: { ts: string }[], target: string): string {
  let best = history[0]?.ts ?? target;
  for (const h of history) {
    if (h.ts <= target) best = h.ts;
    else break;
  }
  return best;
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{label}</div>
    </div>
  );
}

