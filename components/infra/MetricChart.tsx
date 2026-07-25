"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { makeTimeFormatter } from "./utils";

export type Series = {
  key: string;
  label: string;
  color: string;
};

type Props = {
  /** Datenpunkte, jeweils mit `t` (Zeitstempel) plus einem Feld je Serie. */
  data: Record<string, number>[];
  series: Series[];
  range: string;
  /** Achsenbeschriftung – z.B. Prozent oder GiB. */
  formatValue?: (value: number) => string;
  /** Y-Achse auf 0..1 festnageln (für Prozentwerte). */
  percent?: boolean;
  height?: number;
  /** Mehrere Serien werden als Linien gezeichnet, eine einzelne als Fläche. */
  mode?: "area" | "line";
};

/**
 * Zeitreihen-Diagramm für Infrastruktur-Werte.
 *
 * Bewusst eine Komponente für alle Ansichten: Node-CPU, Service-Heap und der
 * Server-Vergleich sollen identisch aussehen, damit man Kurven nebeneinander
 * lesen kann.
 */
export default function MetricChart({
  data,
  series,
  range,
  formatValue,
  percent = false,
  height = 240,
  mode,
}: Props) {
  const fmtTime = makeTimeFormatter(range);
  const chartMode = mode ?? (series.length > 1 ? "line" : "area");

  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-neutral-500"
        style={{ height }}
      >
        Noch keine Messwerte für diesen Zeitraum.
      </div>
    );
  }

  const tooltip = (
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
        formatValue ? formatValue(Number(value)) : String(value),
        series.find((s) => s.key === name)?.label ?? String(name),
      ]}
    />
  );

  const axes = (
    <>
      <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
      <XAxis
        dataKey="t"
        tickFormatter={fmtTime}
        stroke="#525252"
        tick={{ fill: "#737373", fontSize: 12 }}
        minTickGap={40}
      />
      <YAxis
        stroke="#525252"
        tick={{ fill: "#737373", fontSize: 12 }}
        domain={percent ? [0, 1] : ["auto", "auto"]}
        tickFormatter={(v) => (formatValue ? formatValue(Number(v)) : String(v))}
        width={64}
      />
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {chartMode === "area" ? (
        <AreaChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity={0.4} />
                <stop offset="100%" stopColor={s.color} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>
          {axes}
          {tooltip}
          {series.map((s) => (
            <Area
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              fill={`url(#grad-${s.key})`}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </AreaChart>
      ) : (
        <LineChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          {axes}
          {tooltip}
          <Legend
            wrapperStyle={{ fontSize: 12, color: "#a3a3a3" }}
            formatter={(name) => series.find((s) => s.key === name)?.label ?? String(name)}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              type="monotone"
              dataKey={s.key}
              stroke={s.color}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
              connectNulls
            />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
