"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { ClanSummary } from "@/lib/queries";
import ClanTag, { clanPrimaryHex } from "./ClanTag";
import { Search, Users, Crown } from "lucide-react";

export default function ClanBrowser({ clans }: { clans: ClanSummary[] }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return clans;
    return clans.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.tag.toLowerCase().includes(needle) ||
        (c.ownerName ?? "").toLowerCase().includes(needle)
    );
  }, [clans, q]);

  const totalMembers = clans.reduce((sum, c) => sum + c.memberCount, 0);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Clan, Tag oder Anführer…"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2.5 pl-9 pr-3 text-sm text-neutral-200 outline-none transition-colors placeholder:text-neutral-600 focus:border-white/20"
          />
        </div>
        <p className="text-sm text-neutral-600">
          <span className="tabular-nums text-neutral-400">{clans.length}</span> Clans ·{" "}
          <span className="tabular-nums text-neutral-400">{totalMembers}</span> Mitglieder
        </p>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.07] bg-white/[0.02] py-16 text-center text-sm text-neutral-600">
          Kein Clan gefunden.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((clan) => {
            const primary = clanPrimaryHex(clan.color);
            const accent = clan.secondaryColor ? clanPrimaryHex(clan.secondaryColor) : primary;
            return (
              <Link
                key={clan.id}
                href={`/clan/${clan.id}`}
                className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02] p-5 transition-all hover:border-white/15 hover:bg-white/[0.04]"
              >
                <div
                  className="absolute inset-x-0 top-0 h-px opacity-60 transition-opacity group-hover:opacity-100"
                  style={{ background: `linear-gradient(90deg, transparent, ${primary}, ${accent}, transparent)` }}
                />
                <div
                  className="pointer-events-none absolute -right-16 -top-16 h-32 w-32 rounded-full blur-2xl transition-opacity"
                  style={{ background: primary, opacity: 0.07 }}
                />

                <div className="relative">
                  <ClanTag
                    tag={clan.tag}
                    color={clan.color}
                    secondaryColor={clan.secondaryColor}
                    tagStyle={clan.tagStyle}
                    formattingCodes={clan.formattingCodes}
                    brackets
                    className="text-lg tracking-wide"
                  />
                  <h2 className="mt-1.5 truncate text-xl font-semibold text-neutral-100">
                    {clan.name}
                  </h2>

                  {clan.description ? (
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-500">
                      {clan.description}
                    </p>
                  ) : (
                    <p className="mt-2 text-sm italic text-neutral-700">Keine Beschreibung</p>
                  )}

                  <div className="mt-4 flex items-center gap-4 border-t border-white/[0.06] pt-3 text-sm">
                    <span className="flex items-center gap-1.5 text-neutral-400">
                      <Users className="h-3.5 w-3.5 text-neutral-600" />
                      <span className="tabular-nums">{clan.memberCount}</span>
                    </span>
                    {clan.ownerName && (
                      <span className="flex min-w-0 items-center gap-1.5 text-neutral-400">
                        <Crown className="h-3.5 w-3.5 shrink-0 text-amber-400/70" />
                        <span className="truncate">{clan.ownerName}</span>
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
