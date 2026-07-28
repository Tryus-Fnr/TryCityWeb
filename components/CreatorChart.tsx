"use client";

import { useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CreatorEarningDay } from "@/lib/queries";

const RANGES = [
  { key: 7, label: "7 T" },
  { key: 14, label: "14 T" },
  { key: 30, label: "30 T" },
] as const;

type Range = (typeof RANGES)[number]["key"];

function fmtLabel(day: string) {
  const [, m, d] = day.split("-");
  return `${d}.${m}.`;
}

function fmtTooltipDate(label: string) {
  const [y, m, d] = label.split("-");
  return `${d}.${m}.${y}`;
}

function fmtGems(v: number) {
  return v.toLocaleString("de-DE");
}

export default function CreatorChart({
  earnings,
}: {
  earnings: CreatorEarningDay[];
}) {
  const [range, setRange] = useState<Range>(30);

  // earnings comes newest-first from the server
  const data = [...earnings].reverse().slice(-range);

  const maxGems = Math.max(1, ...data.map((d) => d.gems));
  const hasData = data.length > 0 && data.some((d) => d.gems > 0);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold text-neutral-100">Verdienst</p>
          <p className="mt-0.5 text-xs text-neutral-500">
            Gems & Käufe im Zeitverlauf
          </p>
        </div>
        <div className="flex gap-1.5">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                range === r.key
                  ? "bg-cyan-500/15 text-cyan-300 ring-1 ring-cyan-500/30"
                  : "border border-white/10 text-neutral-400 hover:bg-white/5"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="mt-5">
        {!hasData ? (
          <div className="flex h-52 items-center justify-center text-sm text-neutral-500">
            Noch keine Einnahmen in diesem Zeitraum.
          </div>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={220}>
              <ComposedChart
                data={data}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="cg-gems" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#22d3ee" stopOpacity={0.85} />
                    <stop
                      offset="100%"
                      stopColor="#22d3ee"
                      stopOpacity={0.25}
                    />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  stroke="rgba(255,255,255,0.05)"
                  vertical={false}
                />

                <XAxis
                  dataKey="day"
                  tickFormatter={fmtLabel}
                  stroke="transparent"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  minTickGap={range > 14 ? 16 : 8}
                  tickLine={false}
                  axisLine={false}
                />

                {/* Left axis – Gems */}
                <YAxis
                  yAxisId="gems"
                  orientation="left"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={55}
                  tickFormatter={(v) =>
                    v >= 1000
                      ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`
                      : String(v)
                  }
                  domain={[0, Math.ceil(maxGems * 1.2)]}
                />

                {/* Right axis – Käufe */}
                <YAxis
                  yAxisId="purchases"
                  orientation="right"
                  tick={{ fill: "#737373", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  allowDecimals={false}
                />

                <Tooltip
                  cursor={{ fill: "rgba(255,255,255,0.04)", radius: 6 }}
                  contentStyle={{
                    background: "#141414",
                    border: "1px solid rgba(255,255,255,0.09)",
                    borderRadius: 10,
                    color: "#ededed",
                    fontSize: 13,
                    padding: "8px 12px",
                    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
                  }}
                  labelStyle={{ color: "#a3a3a3", marginBottom: 4, fontSize: 11 }}
                  labelFormatter={(label) => fmtTooltipDate(String(label))}
                  formatter={(value, name) => {
                    if (name === "gems")
                      return [`💎 ${fmtGems(Number(value))}`, "Gems"];
                    return [String(value), "Käufe"];
                  }}
                />

                <Bar
                  yAxisId="gems"
                  dataKey="gems"
                  fill="url(#cg-gems)"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={32}
                />

                <Line
                  yAxisId="purchases"
                  type="monotone"
                  dataKey="purchases"
                  stroke="#fb923c"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, fill: "#fb923c", strokeWidth: 0 }}
                />
              </ComposedChart>
            </ResponsiveContainer>

            {/* Legend */}
            <div className="mt-3 flex items-center justify-center gap-6 text-xs text-neutral-500">
              <span className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm bg-cyan-400/75" />
                Gems
              </span>
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-5 rounded-full bg-orange-400" />
                Käufe
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


