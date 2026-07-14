"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatMoney } from "@/lib/format";

type Entry = { uuid: string; name: string; value: number };

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

const rankColors = [
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
  isMod,
}: {
  entry: Entry;
  rank: number;
  max: number;
  formatValue: (v: number) => string;
  accentClass: string;
  barClass: string;
  isMod: boolean;
}) {
  const barWidth = max > 0 ? (entry.value / max) * 100 : 0;
  const rc = rank <= 3 ? rankColors[rank - 1] : "text-neutral-500";

  const nameEl = isMod ? (
    <Link
      href={`/mod/player/${entry.uuid}`}
      className="font-semibold text-neutral-100 text-sm truncate hover:text-white hover:underline transition-colors"
    >
      {entry.name}
    </Link>
  ) : (
    <span className="font-semibold text-neutral-100 text-sm truncate">{entry.name}</span>
  );

  return (
    <div className="flex items-center gap-3 border-b border-white/[0.06] last:border-b-0 bg-white/[0.03] px-4 py-3 transition-colors hover:bg-white/[0.05]">
      {/* Rang */}
      <span className={`w-6 shrink-0 text-center text-sm font-bold tabular-nums ${rc}`}>
        #{rank}
      </span>

      {/* Avatar */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAvatarUrl(entry.name)}
        alt={entry.name}
        width={28}
        height={28}
        className="shrink-0 rounded"
        style={{ imageRendering: "pixelated" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src =
            "/textures/item/player_head.png";
        }}
      />

      {/* Name + Bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          {nameEl}
          <span className={`shrink-0 text-sm font-bold tabular-nums ${accentClass}`}>
            {formatValue(entry.value)}
          </span>
        </div>
        <div className="mt-1.5 h-1 rounded-full bg-white/10">
          <div
            className={`h-full rounded-full ${barClass} transition-all`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function LeaderboardPanel({
  title,
  apiUrl,
  formatValue,
  accentClass,
  barClass,
  labelColor,
  isMod,
}: {
  title: string;
  apiUrl: string;
  formatValue: (v: number) => string;
  accentClass: string;
  barClass: string;
  labelColor: string;
  isMod: boolean;
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
    <div className="flex flex-col flex-1 min-w-0 overflow-hidden rounded-2xl border border-white/10">
      {/* Header */}
      <div className={`px-4 py-3 border-b border-white/10 bg-white/[0.05]`}>
        <span className={`font-black tracking-wide text-sm uppercase ${labelColor}`}>
          {title}
        </span>
      </div>

      {loading && (
        <div className="bg-white/[0.02] px-4 py-8 text-center text-xs text-neutral-500">
          Lade…
        </div>
      )}
      {error && (
        <div className="bg-red-500/5 px-4 py-8 text-center text-xs text-red-400">
          Nicht verfügbar
        </div>
      )}
      {!loading && !error && entries.length === 0 && (
        <div className="bg-white/[0.02] px-4 py-8 text-center text-xs text-neutral-500">
          Keine Einträge
        </div>
      )}
      {!loading && !error && entries.length > 0 && (
        <div className="flex flex-col">
          {entries.map((e, i) => (
            <LeaderboardRow
              key={e.uuid}
              entry={e}
              rank={i + 1}
              max={max}
              formatValue={formatValue}
              accentClass={accentClass}
              barClass={barClass}
              isMod={isMod}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function EconomyLeaderboards({ isMod = false }: { isMod?: boolean }) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      <LeaderboardPanel
        title="Top Geld"
        apiUrl="/api/leaderboard/money"
        formatValue={(v) => `${formatMoney(v)} $`}
        accentClass="text-amber-400"
        barClass="bg-amber-500"
        labelColor="text-amber-400"
        isMod={isMod}
      />
      <LeaderboardPanel
        title="Top Spielzeit"
        apiUrl="/api/leaderboard/playtime"
        formatValue={formatPlaytime}
        accentClass="text-sky-400"
        barClass="bg-sky-500"
        labelColor="text-sky-400"
        isMod={isMod}
      />
    </div>
  );
}
