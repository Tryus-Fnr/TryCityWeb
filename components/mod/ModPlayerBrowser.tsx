"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import type { PlayerRow } from "@/lib/queries";
import { Search } from "lucide-react";

type Props = {
  initial: PlayerRow[];
};

export default function ModPlayerBrowser({ initial }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return initial.slice(0, 100);
    return initial.filter((p) => p.name.toLowerCase().includes(q));
  }, [search, initial]);

  function formatDate(ms: number) {
    return new Date(ms).toLocaleDateString("de-DE");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          placeholder="Spielername suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2 pl-9 pr-3 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30"
        />
      </div>

      <p className="text-xs text-neutral-600">
        {search ? `${filtered.length} Treffer` : `${initial.length} Spieler gesamt – tippe zum Suchen`}
      </p>

      <div className="flex flex-col gap-1.5">
        {filtered.map((p) => (
          <Link
            key={p.uuid}
            href={`/mod/player/${p.uuid}`}
            className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 transition-colors hover:border-sky-500/30 hover:bg-sky-500/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://mc-heads.net/avatar/${encodeURIComponent(p.name)}/32`}
              alt={p.name}
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-md"
              style={{ imageRendering: "pixelated" }}
            />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-neutral-100">{p.name}</p>
              <p className="text-xs text-neutral-500">
                Zuletzt online: {formatDate(p.lastJoin)} &middot; {p.coins.toLocaleString("de-DE")} Coins
              </p>
            </div>
            <span className="shrink-0 text-xs text-neutral-600">
              {p.uuid.slice(0, 8)}…
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

