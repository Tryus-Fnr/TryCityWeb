"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
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

const RANGES = [
  { key: "14d", label: "14 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "90d", label: "90 Tage" },
  { key: "all", label: "Alles" },
] as const;

export default function ItemDetail({ material }: { material: string }) {
  const [range, setRange] = useState<string>("14d");
  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (r: string) => {
      setLoading(true);
      try {
        const res = await fetch(`/api/items/${material}?range=${r}`);
        setData((await res.json()) as Detail);
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    },
    [material]
  );

  useEffect(() => {
    load(range);
  }, [range, load]);

  const name = formatMaterialName(material);
  // Änderungsmarker nur anzeigen, wenn sie im geladenen Zeitraum liegen
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
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{name}</h1>
          <div className="mt-1 font-mono text-sm text-neutral-500">{material}</div>
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
                ? "bg-emerald-500/15 text-emerald-300"
                : "border border-white/10 text-neutral-400 hover:bg-white/5"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Preis-Graph */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <h2 className="mb-2 px-2 text-sm font-medium text-neutral-400">Preisverlauf</h2>
        {loading ? (
          <div className="flex h-72 items-center justify-center text-neutral-500">Lade…</div>
        ) : !data?.ok || data.history.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-neutral-500">
            {data?.error ?? "Noch keine Verlaufsdaten für diesen Zeitraum."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.history} margin={{ top: 8, right: 8, left: -8, bottom: 0 }}>
              <defs>
                <linearGradient id="price" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
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
                formatter={(value) => [`$${formatMoney(Number(value))}`, "Preis"]}
              />
              {/* Admin-Änderungen als Marker */}
              {visibleChanges.map((c, i) => (
                <ReferenceLine
                  key={i}
                  x={nearestTs(data.history, c.changedAt)}
                  stroke="#f59e0b"
                  strokeDasharray="4 4"
                  label={{
                    value: "Änderung",
                    fill: "#f59e0b",
                    fontSize: 10,
                    position: "insideTopRight",
                  }}
                />
              ))}
              <Area
                type="monotone"
                dataKey="price"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#price)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Volumen-Graph */}
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

/** Nächstliegenden Historie-Zeitstempel zu einem Änderungszeitpunkt finden
 *  (ReferenceLine braucht einen X-Wert, der in den Daten existiert). */
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
