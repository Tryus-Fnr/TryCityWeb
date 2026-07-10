"use client";

import { useEffect, useState } from "react";
import { formatMoney } from "@/lib/format";

type BountyRow = {
  targetUuid: string;
  targetName: string;
  amount: number;
};

function getAvatarUrl(name: string) {
  return `https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`;
}

export default function BountyList() {
  const [bounties, setBounties] = useState<BountyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch("/api/bounties")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setBounties(data);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="flex h-32 items-center justify-center text-neutral-500">
        Lade Kopfgelder…
      </div>
    );
  if (error)
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-6 text-center text-red-400">
        Datenbank nicht erreichbar.
      </div>
    );

  if (bounties.length === 0) {
    return (
      <div className="rounded-xl border border-white/10 bg-white/[0.03] p-12 text-center text-neutral-500">
        <div className="text-4xl mb-3">🕊️</div>
        <p>Keine aktiven Kopfgelder.</p>
      </div>
    );
  }

  const totalBounties = bounties.reduce((s, b) => s + b.amount, 0);
  const highest = bounties[0];

  return (
    <div className="flex flex-col gap-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-2xl font-bold text-red-400">{bounties.length}</div>
          <div className="mt-1 text-xs text-neutral-500">Aktive Kopfgelder</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-2xl font-bold text-amber-400">{formatMoney(totalBounties)} $</div>
          <div className="mt-1 text-xs text-neutral-500">Gesamtsumme</div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-center">
          <div className="text-2xl font-bold text-orange-400">{formatMoney(highest.amount)} $</div>
          <div className="mt-1 text-xs text-neutral-500">Höchstes Kopfgeld</div>
        </div>
      </div>

      {/* Liste */}
      <div className="flex flex-col gap-2">
        {bounties.map((b, i) => (
          <BountyCard key={b.targetUuid} bounty={b} rank={i + 1} max={highest.amount} />
        ))}
      </div>
    </div>
  );
}

function BountyCard({ bounty, rank, max }: { bounty: BountyRow; rank: number; max: number }) {
  const barWidth = max > 0 ? (bounty.amount / max) * 100 : 0;

  const rankColor =
    rank === 1
      ? "text-yellow-400"
      : rank === 2
      ? "text-neutral-300"
      : rank === 3
      ? "text-amber-600"
      : "text-neutral-500";

  return (
    <div className="flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-4 hover:border-red-400/30 hover:bg-red-400/[0.02] transition-colors">
      {/* Rang */}
      <span className={`w-8 shrink-0 text-center text-lg font-bold ${rankColor}`}>
        {rank <= 3 ? ["🥇", "🥈", "🥉"][rank - 1] : `#${rank}`}
      </span>

      {/* Avatar */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getAvatarUrl(bounty.targetName)}
        alt={bounty.targetName}
        width={36}
        height={36}
        className="rounded shrink-0"
        style={{ imageRendering: "pixelated" }}
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).src = "/textures/item/player_head.png";
        }}
      />

      {/* Name + Bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-neutral-100">{bounty.targetName}</span>
          <span className="shrink-0 text-sm font-bold text-red-400">
            {formatMoney(bounty.amount)} $
          </span>
        </div>
        <div className="mt-1.5 h-1.5 rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-red-500 transition-all"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

