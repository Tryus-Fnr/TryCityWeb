"use client";

import type { ClanDetail } from "@/lib/queries";
import { Users, Coins, Crown, Shield } from "lucide-react";

type Props = {
  clan: ClanDetail;
  memberUuid: string | null;
};

function colorToHex(colorName: string | null): string {
  if (!colorName) return "#94a3b8";
  const map: Record<string, string> = {
    RED: "#ef4444", DARK_RED: "#b91c1c",
    GOLD: "#f59e0b", YELLOW: "#eab308",
    GREEN: "#22c55e", DARK_GREEN: "#15803d",
    AQUA: "#22d3ee", DARK_AQUA: "#0891b2",
    BLUE: "#3b82f6", DARK_BLUE: "#1d4ed8",
    LIGHT_PURPLE: "#a855f7", DARK_PURPLE: "#7c3aed",
    WHITE: "#f8fafc", GRAY: "#94a3b8", DARK_GRAY: "#475569",
    BLACK: "#1e293b",
  };
  return map[colorName.toUpperCase()] ?? "#94a3b8";
}

export default function ClanDetailView({ clan, memberUuid }: Props) {
  const isMember = memberUuid !== null;
  const primaryColor = colorToHex(clan.color);

  const sortedMembers = [...clan.members].sort((a, b) => {
    const pa = a.rankPriority ?? -1;
    const pb = b.rankPriority ?? -1;
    if (pb !== pa) return pb - pa;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <div
          className="absolute inset-0 opacity-5"
          style={{ background: `radial-gradient(ellipse at 50% 0%, ${primaryColor}, transparent 70%)` }}
        />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className="rounded-lg px-3 py-1 text-lg font-bold"
                style={{ color: primaryColor, background: `${primaryColor}20` }}
              >
                [{clan.tag}]
              </span>
              <h1 className="text-3xl font-bold tracking-tight">{clan.name}</h1>
            </div>
            {clan.description && (
              <p className="mt-2 text-sm text-neutral-400 max-w-xl">{clan.description}</p>
            )}
          </div>
          <div className="flex flex-col gap-1 text-right shrink-0">
            <span className="text-xs text-neutral-600">Mitglieder</span>
            <span className="text-2xl font-bold" style={{ color: primaryColor }}>
              {clan.members.length}
            </span>
          </div>
        </div>
      </div>

      {/* Mitglieder-Info (nur für Clan-Mitglieder) */}
      {isMember && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <Coins className="h-3.5 w-3.5" /> Clan-Bank
            </p>
            <p className="mt-1 text-xl font-bold text-amber-400">
              {clan.bankBalance.toLocaleString("de-DE")} $
            </p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <Shield className="h-3.5 w-3.5" /> Ränge
            </p>
            <p className="mt-1 text-xl font-bold text-neutral-200">{clan.ranks.length}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs text-neutral-500 flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Mitglieder
            </p>
            <p className="mt-1 text-xl font-bold text-neutral-200">{clan.members.length}</p>
          </div>
        </div>
      )}

      {/* Ränge (nur für Mitglieder) */}
      {isMember && clan.ranks.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-neutral-300">
            <Crown className="h-4 w-4 text-neutral-500" /> Clan-Ränge
          </h2>
          <div className="flex flex-wrap gap-2">
            {clan.ranks.map((r) => (
              <span
                key={r.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-sm text-neutral-300"
              >
                {r.name}
                <span className="ml-1 text-xs text-neutral-600">({r.priority})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Mitgliederliste */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 p-4">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <Users className="h-5 w-5 text-neutral-500" />
            Mitglieder
          </h2>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {sortedMembers.map((m) => (
              <div
                key={m.uuid}
                className={`flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 ${
                  m.uuid === memberUuid ? "border-sky-500/30 bg-sky-500/5" : ""
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(m.name)}/32`}
                  alt={m.name}
                  width={32}
                  height={32}
                  className="h-8 w-8 shrink-0 rounded-md"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-neutral-100">{m.name}</p>
                  {m.rankName && (
                    <p className="text-xs text-neutral-500">{m.rankName}</p>
                  )}
                  {m.uuid === memberUuid && (
                    <span className="text-xs text-sky-400">Du</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hinweis wenn nicht Mitglied */}
      {!isMember && (
        <p className="text-center text-xs text-neutral-600">
          Melde dich als Clan-Mitglied an, um Bank und Ränge zu sehen.
        </p>
      )}
    </div>
  );
}


