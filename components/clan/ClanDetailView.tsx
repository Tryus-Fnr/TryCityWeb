"use client";

import Link from "next/link";
import { useState } from "react";
import type { ClanDetail } from "@/lib/queries";
import { CLAN_PERMISSIONS } from "@/lib/clanPermissions";
import ClanTag, { clanPrimaryHex } from "./ClanTag";
import { Users, Coins, Crown, Check, Minus, ArrowLeft, ShieldCheck } from "lucide-react";

type Props = {
  clan: ClanDetail;
  memberUuid: string | null;
};

export default function ClanDetailView({ clan, memberUuid }: Props) {
  const isMember = memberUuid !== null;
  const primary = clanPrimaryHex(clan.color);
  const accent = clan.secondaryColor ? clanPrimaryHex(clan.secondaryColor) : primary;
  const [openRank, setOpenRank] = useState<number | null>(null);

  // Ränge kommen bereits nach Priorität AUFSTEIGEND – der erste ist der
  // Anführer-Rang (kleinste Zahl gewinnt, wie Clan.getOwnerRank() im Plugin).
  const groups = clan.ranks.map((rank) => ({
    rank,
    members: clan.members
      .filter((m) => m.rankId === rank.id)
      .sort((a, b) => a.name.localeCompare(b.name)),
  }));

  // Mitglieder ohne gültigen Rang gingen sonst verloren.
  const orphans = clan.members
    .filter((m) => m.rankId === null || !clan.ranks.some((r) => r.id === m.rankId))
    .sort((a, b) => a.name.localeCompare(b.name));

  const ownRank = clan.members.find((m) => m.uuid === memberUuid)?.rankId ?? null;

  return (
    <div className="flex flex-col gap-8">
      <Link
        href="/clans"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
      >
        <ArrowLeft className="h-4 w-4" /> Alle Clans
      </Link>

      {/* ── Kopfbereich ─────────────────────────────────────────────── */}
      <header className="relative overflow-hidden rounded-3xl border border-white/10 bg-neutral-950/60">
        <div
          className="pointer-events-none absolute -top-32 left-1/2 h-64 w-[36rem] -translate-x-1/2 rounded-full blur-3xl"
          style={{ background: `linear-gradient(90deg, ${primary}, ${accent})`, opacity: 0.16 }}
        />
        <div
          className="absolute inset-x-0 top-0 h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${primary}, ${accent}, transparent)` }}
        />

        <div className="relative flex flex-col gap-6 p-7 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <ClanTag
              tag={clan.tag}
              color={clan.color}
              secondaryColor={clan.secondaryColor}
              tagStyle={clan.tagStyle}
              formattingCodes={clan.formattingCodes}
              brackets
              className="text-2xl tracking-wide"
            />
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-neutral-50">{clan.name}</h1>
            {clan.description && (
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-neutral-400">
                {clan.description}
              </p>
            )}
          </div>

          <dl className="flex shrink-0 gap-8">
            <div>
              <dt className="text-xs uppercase tracking-wider text-neutral-600">Mitglieder</dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums" style={{ color: primary }}>
                {clan.members.length}
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wider text-neutral-600">Ränge</dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums text-neutral-300">
                {clan.ranks.length}
              </dd>
            </div>
            {isMember && (
              <div>
                <dt className="flex items-center gap-1 text-xs uppercase tracking-wider text-neutral-600">
                  <Coins className="h-3 w-3" /> Bank
                </dt>
                <dd className="mt-1 text-3xl font-bold tabular-nums text-amber-400">
                  {clan.bankBalance.toLocaleString("de-DE")}
                  <span className="ml-1 text-lg text-amber-400/60">$</span>
                </dd>
              </div>
            )}
          </dl>
        </div>
      </header>

      {/* ── Mitglieder nach Rang ────────────────────────────────────── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-neutral-200">
            <Users className="h-[18px] w-[18px] text-neutral-600" />
            Mitglieder
          </h2>
          {isMember && (
            <span className="text-xs text-neutral-600">
              Klicke auf einen Rang für seine Rechte
            </span>
          )}
        </div>

        {groups.map(({ rank, members }, index) => {
          const isOwnerRank = index === 0;
          const expanded = openRank === rank.id;
          const grantedCount = CLAN_PERMISSIONS.filter((p) => rank.permissions[p.key]).length;

          return (
            <div
              key={rank.id}
              className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]"
            >
              <button
                type="button"
                onClick={() => isMember && setOpenRank(expanded ? null : rank.id)}
                disabled={!isMember}
                className={`flex w-full items-center gap-3 px-5 py-3.5 text-left ${
                  isMember ? "cursor-pointer transition-colors hover:bg-white/[0.03]" : "cursor-default"
                }`}
              >
                {isOwnerRank ? (
                  <Crown className="h-4 w-4 shrink-0 text-amber-400" />
                ) : (
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: primary, opacity: 0.5 }}
                  />
                )}
                <span className="font-semibold text-neutral-100">{rank.name}</span>
                <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs tabular-nums text-neutral-400">
                  {members.length}
                </span>
                {isMember && rank.id === ownRank && (
                  <span className="rounded-full bg-sky-500/15 px-2 py-0.5 text-xs text-sky-300">
                    Dein Rang
                  </span>
                )}
                <span className="ml-auto flex items-center gap-3 text-xs text-neutral-600">
                  {isMember && (
                    <span className="hidden sm:inline">
                      {grantedCount} / {CLAN_PERMISSIONS.length} Rechte
                    </span>
                  )}
                  <span className="tabular-nums">#{rank.priority}</span>
                </span>
              </button>

              {/* Rechte-Matrix – nur für eingeloggte Clan-Mitglieder */}
              {isMember && expanded && (
                <div className="border-t border-white/[0.07] bg-black/20 px-5 py-4">
                  <p className="mb-3 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-neutral-500">
                    <ShieldCheck className="h-3.5 w-3.5" /> Rechte dieses Rangs
                  </p>
                  <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {CLAN_PERMISSIONS.map((perm) => {
                      const granted = rank.permissions[perm.key];
                      return (
                        <div
                          key={perm.key}
                          title={perm.desc}
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm ${
                            granted ? "text-neutral-200" : "text-neutral-600"
                          }`}
                        >
                          {granted ? (
                            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          ) : (
                            <Minus className="h-3.5 w-3.5 shrink-0 text-neutral-700" />
                          )}
                          {perm.label}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Mitglieder des Rangs */}
              <div className="border-t border-white/[0.07] p-3">
                {members.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-neutral-600">
                    Diesen Rang hat aktuell niemand.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                    {members.map((m) => (
                      <MemberCard key={m.uuid} name={m.name} isSelf={m.uuid === memberUuid} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {orphans.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
            <div className="px-5 py-3.5 text-sm font-semibold text-neutral-400">
              Ohne Rang
              <span className="ml-2 rounded-full bg-white/[0.06] px-2 py-0.5 text-xs tabular-nums text-neutral-500">
                {orphans.length}
              </span>
            </div>
            <div className="border-t border-white/[0.07] p-3">
              <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                {orphans.map((m) => (
                  <MemberCard key={m.uuid} name={m.name} isSelf={m.uuid === memberUuid} />
                ))}
              </div>
            </div>
          </div>
        )}
      </section>

      {!isMember && (
        <p className="rounded-xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 text-center text-sm text-neutral-500">
          Melde dich als Mitglied dieses Clans an, um Bank und Rang-Rechte zu sehen.
        </p>
      )}
    </div>
  );
}

function MemberCard({ name, isSelf }: { name: string; isSelf: boolean }) {
  return (
    <div
      className={`flex items-center gap-2.5 rounded-xl border px-3 py-2 transition-colors ${
        isSelf
          ? "border-sky-500/30 bg-sky-500/[0.07]"
          : "border-white/[0.05] bg-white/[0.02] hover:border-white/10"
      }`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`https://mc-heads.net/avatar/${encodeURIComponent(name)}/32`}
        alt=""
        width={32}
        height={32}
        className="h-8 w-8 shrink-0 rounded-lg"
        style={{ imageRendering: "pixelated" }}
      />
      <span className="truncate text-sm font-medium text-neutral-100">{name}</span>
      {isSelf && <span className="ml-auto shrink-0 text-xs text-sky-400">Du</span>}
    </div>
  );
}
