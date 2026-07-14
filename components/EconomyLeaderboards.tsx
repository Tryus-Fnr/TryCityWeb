"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";

type Entry = { name: string; value: number };

function getAvatarUrl(name: string) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;
}

function formatPlaytime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h`;
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

const rankEmoji = ["🥇", "🥈", "🥉"];
const rankColor = [
  "text-yellow-400",
  "text-neutral-300",
  "text-amber-600",
];

function LeaderboardRow({
  entry,
  rank,
  max,
  formatValue,
  accentClass,
  barClass,
}: {
  entry: Entry;
  rank: number;
  max: number;
  formatValue: (v: number) => string;
  accentClass: string;
  barClass: string;
}) {
  const barWidth = max > 0 ? (entry.value / max) * 100 : 0;
  const rc = rank <= 3 ? rankColor[rank - 1] : "text-neutral-500";

  return (
    <div
      className={`flex items-center gap-3 rounded-none border border-white/10 bg-white/[0.03] px-4 py-3 transition-colors hover:border-white/20 hover:bg-white/[0.05]`}
    >
      {/* Rang */}
      <span className={`w-7 shrink-0 text-center text-base font-bold ${rc}`}>
        {rank <= 3 ? rankEmoji[rank - 1] : `#${rank}`}
      </span>

      {/* Avatar */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAvatarUrl(entry.name)}
        alt={entry.name}
        width={28}
        height={28}
        className="shrink-0"
        style={{ imageRendering: "pixelated" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src =
            "/textures/item/player_head.png";
        }}
      />

      {/* Name + Bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-neutral-100 text-sm truncate">
            {entry.name}
          </span>
          <span className={`shrink-0 text-sm font-bold ${accentClass}`}>
            {formatValue(entry.value)}
          </span>
        </div>
        <div className="mt-1 h-1 bg-white/10">
          <div
            className={`h-full ${barClass} transition-all`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function LeaderboardPanel({
  title,
  emoji,
  apiUrl,
  formatValue,
  accentClass,
  barClass,
  labelColor,
}: {
  title: string;
  emoji: string;
  apiUrl: string;
  formatValue: (v: number) => string;
  accentClass: string;
  barClass: string;
  labelColor: string;
}) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(apiUrl)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setEntries(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [apiUrl]);

  const max = entries.length > 0 ? entries[0].value : 1;

  return (
    <div className="flex flex-col gap-0 flex-1 min-w-0">
      {/* Header – like ingame scoreboard title */}
      <div
        className={`flex items-center gap-2 px-4 py-2.5 border border-white/10 bg-white/[0.06] border-b-0`}
      >
        <span className="text-lg">{emoji}</span>
        <span className={`font-black tracking-wide text-sm uppercase ${labelColor}`}>
          {title}
        </span>
      </div>

      {loading && (
        <div className="border border-white/10 border-t-0 bg-white/[0.02] px-4 py-8 text-center text-xs text-neutral-500">
          Lade…
        </div>
      )}
      {error && (
        <div className="border border-red-500/30 border-t-0 bg-red-500/5 px-4 py-8 text-center text-xs text-red-400">
          Nicht verfügbar
        </div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="border border-white/10 border-t-0 bg-white/[0.02] px-4 py-8 text-center text-xs text-neutral-500">
          Keine Einträge
        </div>
      )}
      {!loading && !error && entries.length > 0 && (
        <div className="flex flex-col">
          {entries.map((e, i) => (
            <div key={e.name} className={i > 0 ? "border-t-0" : ""}>
              <LeaderboardRow
                entry={e}
                rank={i + 1}
                max={max}
                formatValue={formatValue}
                accentClass={accentClass}
                barClass={barClass}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EconomyLeaderboards() {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:gap-4 lg:gap-6">
      <LeaderboardPanel
        title="Top Geld"
        emoji="💰"
        apiUrl="/api/leaderboard/money"
        formatValue={(v) => `${formatMoney(v)} $`}
        accentClass="text-amber-400"
        barClass="bg-amber-500"
        labelColor="text-amber-400"
      />
      <LeaderboardPanel
        title="Top Spielzeit"
        emoji="⏱️"
        apiUrl="/api/leaderboard/playtime"
        formatValue={formatPlaytime}
        accentClass="text-sky-400"
        barClass="bg-sky-500"
        labelColor="text-sky-400"
      />
    </div>
  );
}

