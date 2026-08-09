"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  PRIME_THRESHOLD,
  WEEKDAYS,
  WEEKDAYS_LONG,
  primeTime,
  weekTrend,
  type PlayerInsights,
} from "@/lib/playerInsights";
import {
  AXIS_LINE,
  AXIS_TICK,
  GRID,
  HIGHLIGHT,
  SERIES,
  TOOLTIP_STYLE,
  avgLabel,
  germanDateTime,
  hourLabel,
} from "./chartTheme";
import PlayerHeatmap from "./PlayerHeatmap";

/**
 * Muster in den Spielerzahlen: zu welcher Uhrzeit und an welchem Wochentag im
 * Schnitt am meisten los ist.
 *
 * Der Zeitraum steht als eine Auswahl über dem ganzen Abschnitt – alle
 * Diagramme darunter zeigen denselben Ausschnitt, sonst vergleicht man
 * unbemerkt Äpfel mit Birnen. Nur der Alltime-Rekord oben auf der Seite hängt
 * nicht daran, der gilt immer.
 */

const WINDOWS = [
  { key: "30d", label: "30 Tage" },
  { key: "90d", label: "90 Tage" },
  { key: "365d", label: "1 Jahr" },
  { key: "all", label: "Gesamt" },
] as const;

type Props = {
  data: PlayerInsights | null;
  loading: boolean;
  period: string;
  onPeriodChange: (key: string) => void;
};

export default function PlayerPatterns({ data, loading, period, onPeriodChange }: Props) {
  const derived = useMemo(() => (data?.ok ? derive(data) : null), [data]);

  const periodLabel = WINDOWS.find((w) => w.key === period)?.label ?? "";

  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Weitere Statistiken</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Muster in den Spielerzahlen – ausgewertet über{" "}
            {period === "all" ? "die gesamte Aufzeichnung" : `die letzten ${periodLabel}`}.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {WINDOWS.map((w) => (
            <button
              key={w.key}
              onClick={() => onPeriodChange(w.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                period === w.key
                  ? "bg-sky-500/15 text-sky-300"
                  : "border border-white/10 text-neutral-400 hover:bg-white/5"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
      </div>

      {!loading && data && !data.ok ? (
        <Panel>
          <p className="py-8 text-center text-neutral-500">
            {data.error ?? "Auswertung nicht möglich."}
          </p>
        </Panel>
      ) : (
        // Beim Umschalten stehen bleiben und nur abblenden – ein Skelett würde
        // die ganze Seite springen lassen.
        <div className={`flex flex-col gap-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          {/* ── Kennzahlen aus den Mustern ── */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Tile
              label="Beste Uhrzeit"
              value={derived ? hourLabel(derived.bestHour.hour) : "–"}
              hint={derived ? `Ø ${avgLabel(derived.bestHour.avg)} Spieler` : undefined}
            />
            <Tile
              label="Bester Wochentag"
              value={derived ? WEEKDAYS_LONG[derived.bestWeekday.day] : "–"}
              hint={derived ? `Ø ${avgLabel(derived.bestWeekday.avg)} Spieler über den Tag` : undefined}
            />
            <Tile
              label="Primetime"
              value={derived?.prime ?? "–"}
              hint={`Stunden mit mindestens ${Math.round(PRIME_THRESHOLD * 100)} % des Bestwerts`}
            />
            <Tile
              label="Ruhigste Uhrzeit"
              value={derived ? hourLabel(derived.quietHour.hour) : "–"}
              hint={derived ? `Ø ${avgLabel(derived.quietHour.avg)} Spieler` : undefined}
            />
            <Tile
              label="Ø im Zeitraum"
              value={data?.ok ? avgLabel(data.avgOverall) : "–"}
              hint="Spieler im Schnitt gleichzeitig online"
            />
            <Tile
              label="Trend"
              value={derived?.trend ?? "–"}
              hint="letzte 7 Tage gegen die 7 davor"
            />
          </div>

          {/* ── Ø nach Uhrzeit ── */}
          <Panel
            title="Ø Spieler nach Uhrzeit"
            subtitle="Über alle Tage gemittelt, Ortszeit. Der Bestwert ist hervorgehoben."
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data?.byHour ?? []}
                margin={{ top: 20, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="hour"
                  stroke={AXIS_LINE}
                  tick={AXIS_TICK}
                  tickFormatter={(h) => String(h).padStart(2, "0")}
                  interval={1}
                />
                <YAxis allowDecimals={false} stroke={AXIS_LINE} tick={AXIS_TICK} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(h) => hourLabel(Number(h))}
                  formatter={(v) => [`${avgLabel(Number(v))} Spieler`, "Ø"]}
                />
                <Bar dataKey="avg" maxBarSize={24} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {(data?.byHour ?? []).map((h) => (
                    <Cell
                      key={h.hour}
                      fill={derived && h.hour === derived.bestHour.hour ? HIGHLIGHT : SERIES}
                    />
                  ))}
                  <LabelList
                    dataKey="avg"
                    content={<PeakLabel peakIndex={derived ? derived.bestHour.hour : -1} />}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          {/* ── Ø nach Wochentag ── */}
          <Panel
            title="Ø Spieler nach Wochentag"
            subtitle="Über den ganzen Tag gemittelt – nicht der Abendwert, sondern der Schnitt über 24 Stunden."
          >
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                data={data?.byWeekday ?? []}
                margin={{ top: 20, right: 8, left: -16, bottom: 0 }}
              >
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis
                  dataKey="day"
                  stroke={AXIS_LINE}
                  tick={AXIS_TICK}
                  tickFormatter={(d) => WEEKDAYS[Number(d)] ?? ""}
                />
                <YAxis allowDecimals={false} stroke={AXIS_LINE} tick={AXIS_TICK} />
                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  contentStyle={TOOLTIP_STYLE}
                  labelFormatter={(d) => WEEKDAYS_LONG[Number(d)] ?? ""}
                  formatter={(v) => [`${avgLabel(Number(v))} Spieler`, "Ø"]}
                />
                <Bar dataKey="avg" maxBarSize={48} radius={[4, 4, 0, 0]} isAnimationActive={false}>
                  {(data?.byWeekday ?? []).map((d) => (
                    <Cell
                      key={d.day}
                      fill={derived && d.day === derived.bestWeekday.day ? HIGHLIGHT : SERIES}
                    />
                  ))}
                  <LabelList
                    dataKey="avg"
                    content={<PeakLabel peakIndex={derived ? derived.bestWeekday.day : -1} />}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          {/* ── Woche × Uhrzeit ── */}
          <Panel
            title="Wochenraster"
            subtitle="Ø Spieler je Wochentag und Stunde – wann in der Woche wirklich etwas los ist."
          >
            <PlayerHeatmap cells={data?.heatmap ?? []} />
          </Panel>

          {/* ── Datenbasis ── */}
          {data?.ok && (
            <p className="text-xs text-neutral-600">
              Aufgezeichnet seit{" "}
              {data.coverage.firstAt !== null ? germanDateTime(data.coverage.firstAt) : "–"} ·{" "}
              {data.coverage.snapshots.toLocaleString("de-DE")} Messungen · alle 5 Minuten vom
              Proxy. Uhrzeiten und Wochentage in deutscher Ortszeit.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

// ─── Ableitungen ────────────────────────────────────────────────────────────

/** Bestwerte und abgeleitete Kennzahlen für die Kacheln über den Diagrammen. */
function derive(data: PlayerInsights) {
  return {
    bestHour: data.byHour.reduce((a, b) => (b.avg > a.avg ? b : a), data.byHour[0]),
    quietHour: data.byHour.reduce((a, b) => (b.avg < a.avg ? b : a), data.byHour[0]),
    bestWeekday: data.byWeekday.reduce((a, b) => (b.avg > a.avg ? b : a), data.byWeekday[0]),
    prime: primeTime(data.byHour.map((h) => h.avg)),
    trend: weekTrend(data.daily.map((d) => d.avg)),
  };
}

// ─── Kleinteile ─────────────────────────────────────────────────────────────

function Panel({
  title,
  subtitle,
  children,
}: {
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 sm:p-5">
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-neutral-200">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="text-xs font-medium uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="mt-1.5 text-2xl font-bold text-neutral-100">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-neutral-500">{hint}</div>}
    </div>
  );
}

/**
 * Beschriftet ausschließlich den Bestwert.
 *
 * Eine Zahl über jedem Balken liest niemand; der eine Wert, um den es geht,
 * soll dagegen auch ohne Überfahren dastehen. Recharts reicht die Maße des
 * Balkens als Eigenschaften herein.
 */
function PeakLabel({
  peakIndex,
  index,
  x,
  y,
  width,
  value,
}: {
  peakIndex: number;
  index?: number;
  x?: number | string;
  y?: number | string;
  width?: number | string;
  value?: number | string;
}) {
  if (index !== peakIndex || value === undefined) return null;
  return (
    <text
      x={Number(x) + Number(width) / 2}
      y={Number(y) - 7}
      textAnchor="middle"
      fill="#e5e5e5"
      fontSize={11}
      fontWeight={600}
    >
      {avgLabel(Number(value))}
    </text>
  );
}
