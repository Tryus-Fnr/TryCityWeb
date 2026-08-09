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
import { ChevronRight, Server, Trophy } from "lucide-react";
import type { PlayerInsights } from "@/lib/playerInsights";
import PlayerPatterns from "@/components/stats/PlayerPatterns";
import {
  AXIS_LINE,
  AXIS_TICK,
  GRID,
  SERIES,
  SERIES_MAX,
  TOOLTIP_STYLE,
  avgLabel,
  germanDateTime,
} from "@/components/stats/chartTheme";

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

  // Rekord und Muster hängen an einem eigenen, deutlich größeren Fenster –
  // ein Tagesverlauf sagt über Wochentage nichts.
  const [insightWindow, setInsightWindow] = useState("90d");
  const [insights, setInsights] = useState<PlayerInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);

  // Die Server-Liste ist Momentaufnahme und Nebensache – erst auf Wunsch.
  const [showServers, setShowServers] = useState(false);

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

  const loadInsights = useCallback(async (w: string) => {
    setInsightsLoading(true);
    try {
      const res = await fetch(`/api/stats/insights?window=${w}`);
      setInsights((await res.json()) as PlayerInsights);
    } catch {
      setInsights(null);
    } finally {
      setInsightsLoading(false);
    }
  }, []);

  useEffect(() => {
    load(range);
  }, [range, load]);

  useEffect(() => {
    loadInsights(insightWindow);
  }, [insightWindow, loadInsights]);

  const fmtTime = (t: number) => {
    const d = new Date(t);
    if (range === "24h") {
      return d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
    }
    return d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
  };

  const record = insights?.ok ? insights.record : null;
  // Ohne Antwort lieber einen Strich als eine glatte Null – sonst sieht ein
  // Datenbankausfall aus wie ein leerer Server.
  const num = (v: number) => (data?.ok ? String(v) : "–");

  return (
    <div className="flex flex-col gap-8">
      {/* ── Kennzahlen ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card label="Aktuell online" value={num(data?.current ?? 0)} accent />

        {/* Der Rekord zählt ab dem Tag, an dem er aufgestellt wurde: wird er
            später noch einmal eingestellt, bleibt das Datum stehen. */}
        <Card
          label="Alltime Spieler Rekord"
          value={record ? String(record.players) : "–"}
          hint={
            record
              ? `aufgestellt am ${germanDateTime(record.at)} Uhr`
              : insightsLoading
                ? "wird geladen …"
                : "noch keine Aufzeichnung"
          }
          icon={<Trophy className="h-4 w-4" />}
        />

        <Card
          label={`Peak (${RANGES.find((r) => r.key === range)?.label})`}
          value={num(data?.peak ?? 0)}
        />
        <Card label="Aktive Server" value={num(data?.servers.length ?? 0)} />
      </div>

      {/* ── Verlauf ── */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold tracking-tight">Verlauf</h2>
            <p className="mt-0.5 text-sm text-neutral-500">
              Spieler gleichzeitig online, alle 5 Minuten gemessen.
            </p>
          </div>
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
        </div>

        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          {!data?.ok || data.points.length === 0 ? (
            <div className="flex h-72 items-center justify-center text-neutral-500">
              {loading ? "Lade …" : (data?.error ?? "Noch keine Daten für diesen Zeitraum.")}
            </div>
          ) : (
            <div className={`transition-opacity ${loading ? "opacity-50" : ""}`}>
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-neutral-400">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: SERIES }} />
                  Ø Spieler
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: "#34d399" }} />
                  Höchststand
                </span>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <defs>
                    <linearGradient id="players" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={SERIES} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={SERIES} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="t"
                    tickFormatter={fmtTime}
                    stroke={AXIS_LINE}
                    tick={AXIS_TICK}
                    minTickGap={40}
                  />
                  <YAxis allowDecimals={false} stroke={AXIS_LINE} tick={AXIS_TICK} />
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    labelFormatter={(t) =>
                      new Date(Number(t)).toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    }
                    formatter={(value, name) => [
                      `${avgLabel(Number(value))} Spieler`,
                      name === "avg" ? "Ø" : "Höchststand",
                    ]}
                  />
                  <Area
                    type="monotone"
                    dataKey="max"
                    stroke={SERIES_MAX}
                    strokeWidth={1.5}
                    fill="none"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="avg"
                    stroke={SERIES}
                    strokeWidth={2}
                    fill="url(#players)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </section>

      {/* ── Auswertungen ── */}
      <PlayerPatterns
        data={insights}
        loading={insightsLoading}
        period={insightWindow}
        onPeriodChange={setInsightWindow}
      />

      {/* ── Server im Moment ── */}
      <div className="overflow-hidden rounded-2xl border border-white/10">
        <button
          type="button"
          onClick={() => setShowServers((v) => !v)}
          aria-expanded={showServers}
          className="flex w-full items-center gap-2 px-4 py-3.5 text-sm font-semibold text-neutral-300 transition-colors hover:bg-white/[0.03]"
        >
          <ChevronRight
            className={`h-4 w-4 text-neutral-500 transition-transform ${showServers ? "rotate-90" : ""}`}
          />
          <Server className="h-4 w-4 text-neutral-500" />
          Server im Moment
          {data?.ok && (
            <span className="text-neutral-500">({data.servers.length})</span>
          )}
          <span className="ml-auto text-xs font-medium text-neutral-600">
            {showServers ? "Einklappen" : "Ausklappen"}
          </span>
        </button>

        {showServers && (
          <div className="border-t border-white/10">
            {!data?.ok || data.servers.length === 0 ? (
              <p className="px-4 py-6 text-sm text-neutral-500">
                {loading ? "Lade …" : "Gerade läuft kein Server."}
              </p>
            ) : (
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
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  hint,
  icon,
  accent = false,
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
      <div className={`text-3xl font-bold ${accent ? "text-sky-400" : ""}`}>{value}</div>
      <div className="mt-1 inline-flex items-center justify-center gap-1.5 text-sm text-neutral-500">
        {icon}
        {label}
      </div>
      {hint && <div className="mt-1 text-xs text-neutral-600">{hint}</div>}
    </div>
  );
}
