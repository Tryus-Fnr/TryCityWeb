"use client";

import Link from "next/link";
import { useState } from "react";
import type {
  PlayerDetail,
  PunishmentRow,
  FriendRow,
  PlayerClanInfo,
  AltAccountRow,
  AnticheatFlagRow,
} from "@/lib/queries";
import {
  ShieldBan,
  ShieldAlert,
  VolumeX,
  AlertTriangle,
  Footprints,
  Users,
  Copy,
  ExternalLink,
  Clock,
  CalendarDays,
  Coins,
  Star,
  Gem,
  Link2,
} from "lucide-react";

type Props = {
  player: PlayerDetail;
  punishments: PunishmentRow[];
  friends: FriendRow[];
  clan: PlayerClanInfo | null;
  altAccounts: AltAccountRow[];
  anticheatFlags: AnticheatFlagRow[];
};

type PunishType = "BAN" | "MUTE" | "WARN" | "KICK";

const TABS: { key: PunishType | "ALL"; label: string }[] = [
  { key: "ALL",  label: "Alle" },
  { key: "BAN",  label: "Bans" },
  { key: "MUTE", label: "Mutes" },
  { key: "WARN", label: "Warns" },
  { key: "KICK", label: "Kicks" },
];

const TYPE_STYLE: Record<PunishType, { bg: string; text: string; Icon: React.FC<{ className?: string }> }> = {
  BAN:  { bg: "bg-red-500/10",    text: "text-red-400",    Icon: ShieldBan     },
  MUTE: { bg: "bg-orange-500/10", text: "text-orange-400", Icon: VolumeX       },
  WARN: { bg: "bg-yellow-500/10", text: "text-yellow-400", Icon: AlertTriangle },
  KICK: { bg: "bg-neutral-500/10",text: "text-neutral-400",Icon: Footprints    },
};

function formatDate(ms: number) {
  return new Date(ms).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function formatOnlineTime(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
  return `${h}h ${m}m`;
}

function pingClass(ping: number) {
  if (ping < 0) return "text-neutral-500";
  if (ping > 300) return "text-red-400";
  if (ping > 150) return "text-yellow-400";
  return "text-green-400";
}

function tpsClass(tps: number) {
  if (tps < 16) return "text-red-400";
  if (tps < 19) return "text-yellow-400";
  return "text-green-400";
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function copy() {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <button onClick={copy} className="ml-1.5 text-neutral-500 hover:text-neutral-300 transition-colors" title="Kopieren">
      <Copy className="h-3.5 w-3.5" />
      {copied && <span className="ml-1 text-xs text-green-400">✓</span>}
    </button>
  );
}

export default function ModPlayerDetail({ player, punishments, friends, clan, altAccounts, anticheatFlags }: Props) {
  const [punishTab, setPunishTab] = useState<PunishType | "ALL">("ALL");
  const [acCheckFilter, setAcCheckFilter] = useState<string>("ALL");

  const acChecks = Array.from(new Set(anticheatFlags.map((f) => f.checkName))).sort();
  const visibleFlags = anticheatFlags.filter(
    (f) => acCheckFilter === "ALL" || f.checkName === acCheckFilter
  );

  const visiblePunishments = punishments.filter(
    (p) => punishTab === "ALL" || p.type === punishTab
  );

  const activeBan  = punishments.find((p) => p.type === "BAN"  && p.active);
  const activeMute = punishments.find((p) => p.type === "MUTE" && p.active);

  const countByType = (type: PunishType) => punishments.filter((p) => p.type === type).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://mc-heads.net/avatar/${encodeURIComponent(player.name)}/80`}
          alt={player.name}
          width={80}
          height={80}
          className="h-20 w-20 shrink-0 rounded-xl"
          style={{ imageRendering: "pixelated" }}
        />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-3xl font-bold tracking-tight">{player.name}</h1>
            {activeBan && (
              <span className="rounded-full bg-red-500/15 px-2.5 py-0.5 text-xs font-semibold text-red-400">
                Gebannt
              </span>
            )}
            {activeMute && (
              <span className="rounded-full bg-orange-500/15 px-2.5 py-0.5 text-xs font-semibold text-orange-400">
                Stummgeschaltet
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 text-sm text-neutral-500">
            <span className="font-mono text-xs">{player.uuid}</span>
            <CopyButton text={player.uuid} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              Beigetreten: {formatDate(player.firstJoin)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Zuletzt online: {formatDate(player.lastJoin)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              Spielzeit: {formatOnlineTime(player.onlineTime)}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs mt-1">
            <Link
              href={`/mod/players`}
              className="text-neutral-600 hover:text-neutral-400 transition-colors"
            >
              ← Zurück zur Spielersuche
            </Link>
          </div>
        </div>
      </div>

      {/* Info-Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-neutral-500 flex items-center gap-1"><Coins className="h-3.5 w-3.5" /> Coins</p>
          <p className="mt-1 text-xl font-bold text-amber-400">{player.coins.toLocaleString("de-DE")}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-neutral-500 flex items-center gap-1"><Gem className="h-3.5 w-3.5" /> Gems</p>
          <p className="mt-1 text-xl font-bold text-cyan-400">{player.gems.toLocaleString("de-DE")}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-neutral-500 flex items-center gap-1"><Star className="h-3.5 w-3.5" /> Stars</p>
          <p className="mt-1 text-xl font-bold text-yellow-400">{player.stars.toLocaleString("de-DE")}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-xs text-neutral-500">Server</p>
          <p className="mt-1 text-sm font-semibold text-neutral-200 truncate">
            {player.currentServer ?? player.lastServer ?? "–"}
          </p>
          {player.currentServer && (
            <p className="text-xs text-green-400">Online</p>
          )}
        </div>
      </div>

      {/* Wirtschaft */}
      {(player.balance !== null || player.bankBalance !== null) && (
        <div className="grid grid-cols-2 gap-3">
          {player.balance !== null && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-neutral-500">Kontostand</p>
              <p className="mt-1 text-xl font-bold text-green-400">
                {player.balance.toLocaleString("de-DE")} $
              </p>
            </div>
          )}
          {player.bankBalance !== null && (
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="text-xs text-neutral-500">Bankguthaben</p>
              <p className="mt-1 text-xl font-bold text-blue-400">
                {player.bankBalance.toLocaleString("de-DE")} $
              </p>
            </div>
          )}
        </div>
      )}

      {/* Clan */}
      {clan && (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="mb-2 text-sm font-semibold text-neutral-300">Clan</p>
          <Link
            href={`/clan/${clan.clanId}`}
            className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 hover:border-sky-500/30 hover:bg-sky-500/5 transition-colors"
          >
            <span className="font-bold text-sky-300 text-lg">[{clan.clanTag}]</span>
            <div>
              <p className="font-semibold text-neutral-100">{clan.clanName}</p>
              {clan.rankName && (
                <p className="text-xs text-neutral-500">Rang: {clan.rankName}</p>
              )}
            </div>
            <ExternalLink className="ml-auto h-4 w-4 text-neutral-600" />
          </Link>
        </div>
      )}

      {/* Alt-Accounts */}
      {altAccounts.length > 0 && (
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-orange-400">
            <Link2 className="h-4 w-4" />
            Mögliche Alt-Accounts ({altAccounts.length})
          </p>
          <div className="flex flex-col gap-1.5">
            {altAccounts.map((a) => (
              <Link
                key={a.uuid}
                href={`/mod/player/${a.uuid}`}
                className="flex items-center gap-3 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:border-orange-500/30 hover:bg-orange-500/5 transition-colors"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://mc-heads.net/avatar/${encodeURIComponent(a.name)}/28`}
                  alt={a.name}
                  width={28}
                  height={28}
                  className="h-7 w-7 rounded-md"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-neutral-100">{a.name}</p>
                  <p className="text-xs text-neutral-500">
                    {a.via === "trust" ? "Verknüpft (Trust)" : `Gleiche IP: ${a.sharedIp}`}
                  </p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 shrink-0 text-neutral-600" />
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Strafen */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">
            Strafen
            <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
              {punishments.length}
            </span>
          </h2>
          <div className="flex flex-wrap gap-1.5">
            {TABS.map(({ key, label }) => {
              const count = key === "ALL" ? punishments.length : countByType(key);
              return (
                <button
                  key={key}
                  onClick={() => setPunishTab(key)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                    punishTab === key
                      ? "bg-sky-500/20 text-sky-300"
                      : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                  }`}
                >
                  {label} ({count})
                </button>
              );
            })}
          </div>
        </div>
        <div className="p-4">
          {visiblePunishments.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-600">Keine Einträge.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {visiblePunishments.map((p) => {
                const style = TYPE_STYLE[p.type] ?? TYPE_STYLE["KICK"];
                const { Icon } = style;
                return (
                  <div
                    key={p.id}
                    className={`rounded-lg border border-white/[0.06] p-3 ${p.active ? "border-l-2 border-l-red-500/60" : ""}`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className={`mt-0.5 rounded p-1 ${style.bg}`}>
                        <Icon className={`h-3.5 w-3.5 ${style.text}`} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                          <span className={`text-xs font-bold ${style.text}`}>{p.type}</span>
                          {p.active && (
                            <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                              AKTIV
                            </span>
                          )}
                          <span className="text-xs text-neutral-600">{formatDate(p.createdAt)}</span>
                          {p.expiresAt && (
                            <span className="text-xs text-neutral-600">
                              bis {formatDate(p.expiresAt)}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-sm text-neutral-200">{p.reason || "–"}</p>
                        {p.staffName && (
                          <p className="mt-0.5 text-xs text-neutral-600">von {p.staffName}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Anticheat-Flags */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold">
              <ShieldAlert className="h-5 w-5 text-red-400" />
              Anticheat-Flags
              <span className="ml-1 rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
                {anticheatFlags.length}
              </span>
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              Neueste zuerst · Ping/TPS zum Zeitpunkt des Flags helfen, Lag von echten Hacks zu unterscheiden.
            </p>
          </div>
          {acChecks.length > 0 && (
            <select
              value={acCheckFilter}
              onChange={(e) => setAcCheckFilter(e.target.value)}
              className="rounded-lg border border-white/10 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300"
            >
              <option value="ALL">Alle Checks ({anticheatFlags.length})</option>
              {acChecks.map((c) => (
                <option key={c} value={c}>
                  {c} ({anticheatFlags.filter((f) => f.checkName === c).length})
                </option>
              ))}
            </select>
          )}
        </div>
        <div className="p-4">
          {visibleFlags.length === 0 ? (
            <p className="py-8 text-center text-sm text-neutral-600">Keine Flags.</p>
          ) : (
            <div className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto">
              {visibleFlags.map((f) => {
                const recent = Date.now() - f.createdAt < 10 * 60 * 1000;
                return (
                  <div
                    key={f.id}
                    className={`rounded-lg border border-white/[0.06] p-3 ${
                      f.lagged
                        ? "border-l-2 border-l-orange-500/60"
                        : recent
                          ? "border-l-2 border-l-red-500/50"
                          : ""
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                      <span className="text-sm font-bold text-red-300">{f.checkName}</span>
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-neutral-400">
                        {f.category}
                      </span>
                      {f.lagged && (
                        <span className="rounded-full bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-orange-400">
                          LAG
                        </span>
                      )}
                      {recent && !f.lagged && (
                        <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-red-400">
                          &lt; 10 min
                        </span>
                      )}
                      <span className="text-xs text-neutral-600">{formatDate(f.createdAt)}</span>
                      {f.server && <span className="text-xs text-neutral-600">{f.server}</span>}
                    </div>
                    <p className="mt-1 break-words text-sm text-neutral-300">{f.details || "–"}</p>
                    <p className="mt-0.5 text-xs">
                      <span className={pingClass(f.ping)}>Ping {f.ping < 0 ? "?" : `${f.ping}ms`}</span>
                      <span className="text-neutral-600"> · </span>
                      <span className={tpsClass(f.tps)}>TPS {f.tps.toFixed(1)}</span>
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Freunde */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users className="h-5 w-5 text-neutral-500" />
            Freunde
            <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-neutral-400">
              {friends.length}
            </span>
          </h2>
        </div>
        <div className="p-4">
          {friends.length === 0 ? (
            <p className="py-6 text-center text-sm text-neutral-600">Keine Freunde.</p>
          ) : (
            <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              {friends.map((f) => (
                <Link
                  key={f.friendUuid}
                  href={`/mod/player/${f.friendUuid}`}
                  className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2 hover:border-sky-500/30 hover:bg-sky-500/5 transition-colors"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://mc-heads.net/avatar/${encodeURIComponent(f.friendName)}/28`}
                    alt={f.friendName}
                    width={28}
                    height={28}
                    className="h-7 w-7 rounded-md"
                    style={{ imageRendering: "pixelated" }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-neutral-100">{f.friendName}</p>
                    <p className="text-xs text-neutral-600">
                      seit {new Date(f.friendSince).toLocaleDateString("de-DE")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

