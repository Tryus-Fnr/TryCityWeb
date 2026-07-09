"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type PlayerPoint = { t: number; avg: number; max: number };
type ServerNow = { server: string; online: number; max: number };
type ApiResponse = {
  ok: boolean;
  points: PlayerPoint[];
  servers: ServerNow[];
  peak: number;
  current: number;
  error?: string;
};

const RANGES = [
  { key: "24h", label: "24 Stunden" },
  { key: "7d", label: "7 Tage" },
  { key: "30d", label: "30 Tage" },
] as const;

export default function PlayerStats() {
  const [range, setRange] = useState<string>("24h");
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/stats/players?range=${r}`);
      setData((await res.json()) as ApiResponse);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  const fmtTime = (t: number) => {
    const d = new Date(t);
    if (range === "24h") {
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card label="Aktuell online" value={data ? String(data.current) : "–"} accent />
        <Card label={`Peak (${RANGES.find((r) => r.key === range)?.label})`} value={data ? String(data.peak) : "–"} />
        <Card label="Aktive Server" value={data ? String(data.servers.length) : "–"} />
      </div>

      {/* Zeitraum-Auswahl */}
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

      {/* Graph */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        {loading ? (
          <div className="flex h-72 items-center justify-center text-neutral-500">Lade…</div>
        ) : !data?.ok || data.points.length === 0 ? (
          <div className="flex h-72 items-center justify-center text-neutral-500">
            {data?.error ?? "Noch keine Daten für diesen Zeitraum."}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="players" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#34d399" stopOpacity={0.45} />
                  <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="t"
                tickFormatter={fmtTime}
                stroke="#525252"
                tick={{ fill: "#737373", fontSize: 12 }}
                minTickGap={40}
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
                labelFormatter={(t) =>
                  new Date(Number(t)).toLocaleString("de-DE", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                }
                formatter={(value, name) => [
                  String(value),
                  name === "avg" ? "Ø Spieler" : "Max Spieler",
                ]}
              />
              <Area
                type="monotone"
                dataKey="max"
                stroke="rgba(52,211,153,0.35)"
                strokeWidth={1}
                fill="none"
              />
              <Area
                type="monotone"
                dataKey="avg"
                stroke="#34d399"
                strokeWidth={2}
                fill="url(#players)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Pro-Server-Tabelle */}
      {data?.ok && data.servers.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-white/10">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-white/[0.04] text-left text-neutral-400">
                <th className="px-4 py-3 font-medium">Server</th>
                <th className="px-4 py-3 text-right font-medium">Spieler</th>
                <th className="px-4 py-3 font-medium">Auslastung</th>
              </tr>
            </thead>
            <tbody>
              {data.servers.map((s) => {
                const pct = s.max > 0 ? Math.min(100, (s.online / s.max) * 100) : 0;
                return (
                  <tr key={s.server} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium">{s.server}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {s.online}
                      <span className="text-neutral-500"> / {s.max}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="h-2 w-full max-w-48 overflow-hidden rounded-full bg-white/10">
                        <div
                          className="h-full rounded-full bg-sky-400"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
      <div className={`text-3xl font-bold ${accent ? "text-sky-400" : ""}`}>{value}</div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
    </div>
  );
}
