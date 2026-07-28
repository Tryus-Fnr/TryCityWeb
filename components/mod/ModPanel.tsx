"use client";

import { useState } from "react";
import Link from "next/link";
import type {
  UnbanRequestRow, BanRow, PlayerStats,
  RecentPunishmentRow, RecentAnticheatFlagRow,
} from "@/lib/queries";
import {
  Clock, CheckCircle, XCircle, AlertCircle, FileText,
  Users, ShieldBan, Ban, Gavel, VolumeX, TriangleAlert, LogOut, Shield,
} from "lucide-react";

type Tab = "requests" | "bans" | "mutes" | "warns" | "kicks" | "anticheat";

type Props = {
  unbanRequests: UnbanRequestRow[];
  allBans: BanRow[];
  playerStats: PlayerStats;
  mutes: RecentPunishmentRow[];
  warns: RecentPunishmentRow[];
  kicks: RecentPunishmentRow[];
  anticheatFlags: RecentAnticheatFlagRow[];
};

// ── Hilfsfunktionen ──────────────────────────────────────────────────────────

function fmt(ts: number | string) {
  return new Date(Number(ts)).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function ExpiryBadge({ expiresAt, active }: { expiresAt: number | null; active?: boolean }) {
  if (active === false)
    return <span className="rounded-full bg-green-500/10 px-2 py-0.5 text-xs font-semibold text-green-600">Aufgehoben</span>;
  if (expiresAt === null)
    return <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">Permanent</span>;
  if (expiresAt < Date.now())
    return <span className="rounded-full bg-neutral-500/15 px-2 py-0.5 text-xs font-semibold text-neutral-500">Abgelaufen</span>;
  return <span className="text-neutral-500 text-xs">{fmt(expiresAt)}</span>;
}

// ── Wiederverwendbare Strafen-Tabelle (Bans / Mutes / Warns / Kicks) ─────────

function PunishmentTable({
  rows,
  showExpiry = true,
  showActive = true,
}: {
  rows: (BanRow | RecentPunishmentRow)[];
  showExpiry?: boolean;
  showActive?: boolean;
}) {
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const filtered = rows.filter((r) => {
    if (!showInactive && !r.active) return false;
    if (search && !r.targetName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="p-4">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Spieler suchen…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
        />
        {showActive && (
          <label className="flex cursor-pointer items-center gap-2 text-sm text-neutral-400 select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="h-4 w-4 rounded border-white/20 bg-white/5 accent-red-500"
            />
            Aufgehobene anzeigen
          </label>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-neutral-600">
          <Ban className="h-7 w-7" />
          <p className="text-sm">Keine Einträge gefunden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6 text-left text-xs text-neutral-500">
                <th className="pb-2 pr-4 font-medium">Spieler</th>
                <th className="pb-2 pr-4 font-medium">Grund</th>
                <th className="pb-2 pr-4 font-medium">Von</th>
                <th className="pb-2 pr-4 font-medium">Datum</th>
                {showExpiry && <th className="pb-2 font-medium">Läuft ab</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
                  <td className="py-2.5 pr-4">
                    <Link href={`/mod/player/${r.targetUuid}`} className="flex items-center gap-2 hover:text-sky-300 transition-colors">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://mc-heads.net/avatar/${encodeURIComponent(r.targetName)}/24`}
                        alt={r.targetName} width={24} height={24}
                        className={`h-6 w-6 rounded ${!r.active ? "opacity-40" : ""}`}
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className={`font-medium ${r.active ? "text-neutral-200" : "text-neutral-600 line-through"}`}>
                        {r.targetName}
                      </span>
                    </Link>
                  </td>
                  <td className="py-2.5 pr-4 max-w-50">
                    <span className="truncate block text-neutral-400" title={r.reason}>{r.reason}</span>
                  </td>
                  <td className="py-2.5 pr-4 text-neutral-500">
                    {r.staffName ?? <span className="italic text-neutral-700">Unbekannt</span>}
                  </td>
                  <td className="py-2.5 pr-4 text-neutral-500 whitespace-nowrap">{fmt(r.createdAt)}</td>
                  {showExpiry && (
                    <td className="py-2.5 whitespace-nowrap">
                      <ExpiryBadge expiresAt={r.expiresAt} active={r.active} />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Anticheat-Tabelle ─────────────────────────────────────────────────────────

function AnticheatTable({ flags }: { flags: RecentAnticheatFlagRow[] }) {
  const [search, setSearch] = useState("");

  const filtered = flags.filter((f) =>
    !search || f.playerName.toLowerCase().includes(search.toLowerCase()) ||
    f.checkName.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4">
      <input
        type="text"
        placeholder="Spieler oder Check suchen…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-4 w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30"
      />

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-neutral-600">
          <Shield className="h-7 w-7" />
          <p className="text-sm">Keine Flags gefunden.</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/6 text-left text-xs text-neutral-500">
                <th className="pb-2 pr-4 font-medium">Spieler</th>
                <th className="pb-2 pr-4 font-medium">Check</th>
                <th className="pb-2 pr-4 font-medium">Details</th>
                <th className="pb-2 pr-4 font-medium">Server</th>
                <th className="pb-2 pr-4 font-medium">Ping / TPS</th>
                <th className="pb-2 font-medium">Zeitpunkt</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((f) => (
                <tr key={f.id} className="border-b border-white/4 last:border-0 hover:bg-white/2 transition-colors">
                  <td className="py-2 pr-4">
                    <Link href={`/mod/player/${f.playerUuid}`} className="flex items-center gap-2 hover:text-sky-300 transition-colors">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://mc-heads.net/avatar/${encodeURIComponent(f.playerName)}/24`}
                        alt={f.playerName} width={24} height={24}
                        className="h-6 w-6 rounded"
                        style={{ imageRendering: "pixelated" }}
                      />
                      <span className="font-medium text-neutral-200">{f.playerName}</span>
                    </Link>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="font-mono text-xs text-orange-400">{f.checkName}</span>
                    {f.category && <span className="ml-1.5 text-xs text-neutral-600">{f.category}</span>}
                  </td>
                  <td className="py-2 pr-4 max-w-48">
                    <span className="truncate block text-xs text-neutral-500" title={f.details}>{f.details || "–"}</span>
                  </td>
                  <td className="py-2 pr-4 text-xs text-neutral-600">{f.server || "–"}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className={`text-xs ${f.ping > 200 ? "text-red-400" : "text-neutral-500"}`}>
                      {f.ping >= 0 ? `${f.ping} ms` : "–"}
                    </span>
                    <span className="text-neutral-700"> / </span>
                    <span className={`text-xs ${f.tps < 18 ? "text-yellow-500" : "text-neutral-500"}`}>
                      {f.tps.toFixed(1)} TPS
                    </span>
                    {f.lagged && <span className="ml-1 text-xs text-yellow-600">⚠</span>}
                  </td>
                  <td className="py-2 whitespace-nowrap text-xs text-neutral-600">{fmt(f.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Haupt-Komponente ─────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-500/15 text-yellow-400", DONE: "bg-green-500/15 text-green-400",
  FAILED: "bg-red-500/15 text-red-400", APPROVED: "bg-green-500/15 text-green-400",
  DENIED: "bg-red-500/15 text-red-400", PROCESSED: "bg-neutral-500/15 text-neutral-400",
};
const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING: <Clock className="h-3.5 w-3.5" />, DONE: <CheckCircle className="h-3.5 w-3.5" />,
  FAILED: <XCircle className="h-3.5 w-3.5" />, APPROVED: <CheckCircle className="h-3.5 w-3.5" />,
  DENIED: <XCircle className="h-3.5 w-3.5" />, PROCESSED: <CheckCircle className="h-3.5 w-3.5" />,
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: "Ausstehend", DONE: "Erledigt", FAILED: "Fehlgeschlagen",
  APPROVED: "Angenommen", DENIED: "Abgelehnt", PROCESSED: "Verarbeitet",
};
const TYPE_LABELS: Record<string, string> = {
  UNBAN_REQUEST: "Entbannungsantrag", UNMUTE_REQUEST: "Stummschaltung aufheben",
};

export default function ModPanel({
  unbanRequests, allBans, playerStats, mutes, warns, kicks, anticheatFlags,
}: Props) {
  const [tab, setTab] = useState<Tab>("requests");
  const [reqFilter, setReqFilter] = useState<"ALL" | "PENDING" | "DONE" | "FAILED">("ALL");
  const [reqSearch, setReqSearch] = useState("");

  const filteredRequests = unbanRequests.filter((r) => {
    if (reqFilter !== "ALL" && r.status !== reqFilter) return false;
    if (reqSearch && !r.targetName.toLowerCase().includes(reqSearch.toLowerCase())) return false;
    return true;
  });

  const pending  = unbanRequests.filter((r) => r.status === "PENDING").length;
  const done     = unbanRequests.filter((r) => r.status === "DONE" || r.status === "APPROVED").length;
  const activeBanCount = allBans.filter((b) => b.active).length;
  const banRate  = playerStats.total > 0
    ? ((playerStats.banned / playerStats.total) * 100).toFixed(1) : "0.0";

  const TABS: { key: Tab; label: string; icon: React.ReactNode; badge?: number; color: string }[] = [
    { key: "requests",  label: "Anträge",  icon: <AlertCircle className="h-4 w-4" />,    badge: pending,               color: "sky"    },
    { key: "bans",      label: "Bans",     icon: <Ban className="h-4 w-4" />,              badge: activeBanCount,        color: "red"    },
    { key: "mutes",     label: "Mutes",    icon: <VolumeX className="h-4 w-4" />,          badge: mutes.filter(m=>m.active).length, color: "purple" },
    { key: "warns",     label: "Warns",    icon: <TriangleAlert className="h-4 w-4" />,    badge: warns.length,          color: "yellow" },
    { key: "kicks",     label: "Kicks",    icon: <LogOut className="h-4 w-4" />,           badge: kicks.length,          color: "orange" },
    { key: "anticheat", label: "Anticheat",icon: <Shield className="h-4 w-4" />,           badge: anticheatFlags.length, color: "orange" },
  ];

  const colorMap: Record<string, { active: string; badge: string }> = {
    sky:    { active: "border-sky-400 text-sky-300",     badge: "bg-sky-500/20 text-sky-400"      },
    red:    { active: "border-red-400 text-red-300",     badge: "bg-red-500/15 text-red-400"      },
    purple: { active: "border-purple-400 text-purple-300", badge: "bg-purple-500/15 text-purple-400" },
    yellow: { active: "border-yellow-400 text-yellow-300", badge: "bg-yellow-500/15 text-yellow-400" },
    orange: { active: "border-orange-400 text-orange-300", badge: "bg-orange-500/15 text-orange-400" },
  };

  return (
    <div className="flex flex-col gap-6">
      {/* ── Statistiken ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/3 p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-sky-400 shrink-0" />
          <div>
            <p className="text-xs text-neutral-500">Spieler gesamt</p>
            <p className="mt-0.5 text-2xl font-bold text-neutral-100">{playerStats.total.toLocaleString("de-DE")}</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/3 p-4 flex items-center gap-3">
          <ShieldBan className="h-8 w-8 text-red-400 shrink-0" />
          <div>
            <p className="text-xs text-neutral-500">Gebannt</p>
            <p className="mt-0.5 text-2xl font-bold text-red-400">{playerStats.banned.toLocaleString("de-DE")}</p>
            <p className="text-xs text-neutral-600">{banRate}%</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/3 p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-yellow-400 shrink-0" />
          <div>
            <p className="text-xs text-neutral-500">Anträge ausstehend</p>
            <p className="mt-0.5 text-2xl font-bold text-yellow-400">{pending}</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/3 p-4 flex items-center gap-3">
          <Gavel className="h-8 w-8 text-neutral-400 shrink-0" />
          <div>
            <p className="text-xs text-neutral-500">Anträge erledigt</p>
            <p className="mt-0.5 text-2xl font-bold text-green-400">{done}</p>
          </div>
        </div>
      </div>

      {/* ── Quick Link ── */}
      <div className="flex gap-3 flex-wrap">
        <Link href="/mod/players" className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/20">
          <FileText className="h-4 w-4" />
          Spieler-Suche öffnen
        </Link>
      </div>

      {/* ── Haupt-Panel mit Tabs ── */}
      <div className="rounded-xl border border-white/10 bg-white/3">
        {/* Tab-Bar (scrollbar auf kleinen Screens) */}
        <div className="flex overflow-x-auto border-b border-white/10 scrollbar-none">
          {TABS.map(({ key, label, icon, badge, color }) => {
            const c = colorMap[color];
            const isActive = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                className={`flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive ? `border-b-2 ${c.active}` : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {icon}
                {label}
                {badge !== undefined && badge > 0 && (
                  <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${c.badge}`}>{badge}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* ── Entbannungs-Anträge ── */}
        {tab === "requests" && (
          <div>
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 flex-wrap">
                {(["ALL","PENDING","DONE","FAILED"] as const).map((key) => (
                  <button key={key} onClick={() => setReqFilter(key)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      reqFilter === key ? "bg-sky-500/20 text-sky-300" : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                    }`}>
                    {{ ALL: "Alle", PENDING: "Ausstehend", DONE: "Erledigt", FAILED: "Fehlgeschlagen" }[key]}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <input type="text" placeholder="Spieler suchen…" value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
                className="mb-4 w-full rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30"
              />
              {filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-neutral-600">
                  <AlertCircle className="h-8 w-8" /><p className="text-sm">Keine Anträge gefunden.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredRequests.map((r) => (
                    <div key={r.id} className="rounded-lg border border-white/6 bg-white/2 p-4">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`https://mc-heads.net/avatar/${encodeURIComponent(r.targetName)}/32`}
                            alt={r.targetName} width={32} height={32}
                            className="h-8 w-8 rounded-md" style={{ imageRendering: "pixelated" }} />
                          <div>
                            <Link href={`/mod/player/${r.targetUuid}`} className="font-semibold text-neutral-100 hover:text-sky-300 transition-colors">{r.targetName}</Link>
                            <p className="text-xs text-neutral-500">{TYPE_LABELS[r.actionType] ?? r.actionType}</p>
                          </div>
                        </div>
                        <span className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[r.status] ?? "bg-neutral-500/15 text-neutral-400"}`}>
                          {STATUS_ICONS[r.status]}{STATUS_LABEL[r.status] ?? r.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {r.playerMessage
                          ? <div className="rounded-lg bg-black/30 px-3 py-2"><p className="text-xs font-medium text-neutral-500">✍️ Entschuldigung</p><p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-200">{r.playerMessage}</p></div>
                          : <div className="rounded-lg bg-black/20 px-3 py-2"><p className="text-xs font-medium text-neutral-600">✍️ Entschuldigung</p><p className="mt-0.5 text-sm italic text-neutral-600">Nicht angegeben</p></div>
                        }
                        {r.reason && <div className="rounded-lg bg-black/20 px-3 py-2"><p className="text-xs font-medium text-neutral-500">📋 Antrag</p><p className="mt-0.5 text-sm text-neutral-400">{r.reason}</p></div>}
                        {r.resultMessage && <div className="rounded-lg bg-black/20 px-3 py-2"><p className="text-xs font-medium text-neutral-500">✅ Ergebnis</p><p className="mt-0.5 text-sm text-neutral-300">{r.resultMessage}</p></div>}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                        <span>Erstellt: {fmt(r.createdAt)}</span>
                        {r.processedAt && <span>Bearbeitet: {fmt(r.processedAt)}</span>}
                        {r.createdBy && <span>Von: {r.createdBy}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "bans"   && <PunishmentTable rows={allBans} showExpiry showActive />}
        {tab === "mutes"  && <PunishmentTable rows={mutes}   showExpiry showActive />}
        {tab === "warns"  && <PunishmentTable rows={warns}   showExpiry={false} showActive={false} />}
        {tab === "kicks"  && <PunishmentTable rows={kicks}   showExpiry={false} showActive={false} />}
        {tab === "anticheat" && <AnticheatTable flags={anticheatFlags} />}
      </div>
    </div>
  );
}

