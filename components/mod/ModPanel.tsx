"use client";

import { useState } from "react";
import Link from "next/link";
import type { UnbanRequestRow, BanRow, PlayerStats } from "@/lib/queries";
import {
  Clock, CheckCircle, XCircle, AlertCircle, FileText,
  Users, ShieldBan, Ban, Gavel,
} from "lucide-react";

type Props = {
  unbanRequests: UnbanRequestRow[];
  activeBans: BanRow[];
  playerStats: PlayerStats;
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-yellow-500/15 text-yellow-400",
  DONE:      "bg-green-500/15 text-green-400",
  FAILED:    "bg-red-500/15 text-red-400",
  APPROVED:  "bg-green-500/15 text-green-400",
  DENIED:    "bg-red-500/15 text-red-400",
  PROCESSED: "bg-neutral-500/15 text-neutral-400",
};

const STATUS_ICONS: Record<string, React.ReactNode> = {
  PENDING:   <Clock className="h-3.5 w-3.5" />,
  DONE:      <CheckCircle className="h-3.5 w-3.5" />,
  FAILED:    <XCircle className="h-3.5 w-3.5" />,
  APPROVED:  <CheckCircle className="h-3.5 w-3.5" />,
  DENIED:    <XCircle className="h-3.5 w-3.5" />,
  PROCESSED: <CheckCircle className="h-3.5 w-3.5" />,
};

const STATUS_LABEL: Record<string, string> = {
  PENDING:   "Ausstehend",
  DONE:      "Erledigt",
  FAILED:    "Fehlgeschlagen",
  APPROVED:  "Angenommen",
  DENIED:    "Abgelehnt",
  PROCESSED: "Verarbeitet",
};

const TYPE_LABELS: Record<string, string> = {
  UNBAN_REQUEST:  "Entbannungsantrag",
  UNMUTE_REQUEST: "Stummschaltung aufheben",
};

function formatDate(ts: number | string) {
  return new Date(Number(ts)).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function ModPanel({ unbanRequests, activeBans, playerStats }: Props) {
  const [tab, setTab] = useState<"requests" | "bans">("requests");

  // Entbannungs-Anträge Filter
  const [reqFilter, setReqFilter] = useState<"ALL" | "PENDING" | "DONE" | "FAILED">("ALL");
  const [reqSearch, setReqSearch] = useState("");

  // Ban-Liste Filter
  const [banSearch, setBanSearch] = useState("");

  const filteredRequests = unbanRequests.filter((r) => {
    if (reqFilter !== "ALL" && r.status !== reqFilter) return false;
    if (reqSearch && !r.targetName.toLowerCase().includes(reqSearch.toLowerCase())) return false;
    return true;
  });

  const filteredBans = activeBans.filter((b) =>
    !banSearch || b.targetName.toLowerCase().includes(banSearch.toLowerCase())
  );

  const pending = unbanRequests.filter((r) => r.status === "PENDING").length;
  const done    = unbanRequests.filter((r) => r.status === "DONE" || r.status === "APPROVED").length;

  const banRate = playerStats.total > 0
    ? ((playerStats.banned / playerStats.total) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="flex flex-col gap-6">

      {/* ── Spieler-Statistiken ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-sky-400 shrink-0" />
          <div>
            <p className="text-xs text-neutral-500">Spieler gesamt</p>
            <p className="mt-0.5 text-2xl font-bold text-neutral-100">
              {playerStats.total.toLocaleString("de-DE")}
            </p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
          <ShieldBan className="h-8 w-8 text-red-400 shrink-0" />
          <div>
            <p className="text-xs text-neutral-500">Gebannt</p>
            <p className="mt-0.5 text-2xl font-bold text-red-400">
              {playerStats.banned.toLocaleString("de-DE")}
            </p>
            <p className="text-xs text-neutral-600">{banRate}%</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
          <Clock className="h-8 w-8 text-yellow-400 shrink-0" />
          <div>
            <p className="text-xs text-neutral-500">Anträge ausstehend</p>
            <p className="mt-0.5 text-2xl font-bold text-yellow-400">{pending}</p>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 flex items-center gap-3">
          <Gavel className="h-8 w-8 text-neutral-400 shrink-0" />
          <div>
            <p className="text-xs text-neutral-500">Anträge erledigt</p>
            <p className="mt-0.5 text-2xl font-bold text-green-400">{done}</p>
          </div>
        </div>
      </div>

      {/* ── Quick Links ── */}
      <div className="flex gap-3 flex-wrap">
        <Link
          href="/mod/players"
          className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
        >
          <FileText className="h-4 w-4" />
          Spieler-Suche öffnen
        </Link>
      </div>

      {/* ── Tabs ── */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        {/* Tab-Bar */}
        <div className="flex border-b border-white/10">
          <button
            onClick={() => setTab("requests")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              tab === "requests"
                ? "border-b-2 border-sky-400 text-sky-300"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <AlertCircle className="h-4 w-4" />
            Entbannungs-Anträge
            {pending > 0 && (
              <span className="rounded-full bg-yellow-500/20 px-1.5 py-0.5 text-xs font-bold text-yellow-400">
                {pending}
              </span>
            )}
          </button>
          <button
            onClick={() => setTab("bans")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-colors ${
              tab === "bans"
                ? "border-b-2 border-red-400 text-red-300"
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <Ban className="h-4 w-4" />
            Alle Bans
            <span className="rounded-full bg-red-500/15 px-1.5 py-0.5 text-xs font-bold text-red-400">
              {activeBans.length}
            </span>
          </button>
        </div>

        {/* ── Tab: Entbannungs-Anträge ── */}
        {tab === "requests" && (
          <div>
            <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-2 flex-wrap">
                {([
                  { key: "ALL",     label: "Alle" },
                  { key: "PENDING", label: "Ausstehend" },
                  { key: "DONE",    label: "Erledigt" },
                  { key: "FAILED",  label: "Fehlgeschlagen" },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setReqFilter(key)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                      reqFilter === key
                        ? "bg-sky-500/20 text-sky-300"
                        : "text-neutral-500 hover:bg-white/5 hover:text-neutral-300"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="p-4">
              <input
                type="text"
                placeholder="Spieler suchen…"
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
                className="mb-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30"
              />
              {filteredRequests.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-12 text-neutral-600">
                  <AlertCircle className="h-8 w-8" />
                  <p className="text-sm">Keine Anträge gefunden.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {filteredRequests.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-4"
                    >
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-center gap-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://mc-heads.net/avatar/${encodeURIComponent(r.targetName)}/32`}
                            alt={r.targetName}
                            width={32}
                            height={32}
                            className="h-8 w-8 rounded-md"
                            style={{ imageRendering: "pixelated" }}
                          />
                          <div>
                            <Link
                              href={`/mod/player/${r.targetUuid}`}
                              className="font-semibold text-neutral-100 hover:text-sky-300 transition-colors"
                            >
                              {r.targetName}
                            </Link>
                            <p className="text-xs text-neutral-500">
                              {TYPE_LABELS[r.actionType] ?? r.actionType}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                              STATUS_COLORS[r.status] ?? "bg-neutral-500/15 text-neutral-400"
                            }`}
                          >
                            {STATUS_ICONS[r.status]}
                            {STATUS_LABEL[r.status] ?? r.status}
                          </span>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2">
                        {r.playerMessage ? (
                          <div className="rounded-lg bg-black/30 px-3 py-2">
                            <p className="text-xs font-medium text-neutral-500">✍️ Entschuldigung des Spielers</p>
                            <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-200">{r.playerMessage}</p>
                          </div>
                        ) : (
                          <div className="rounded-lg bg-black/20 px-3 py-2">
                            <p className="text-xs font-medium text-neutral-600">✍️ Entschuldigung des Spielers</p>
                            <p className="mt-0.5 text-sm italic text-neutral-600">Nicht angegeben</p>
                          </div>
                        )}
                        {r.reason && (
                          <div className="rounded-lg bg-black/20 px-3 py-2">
                            <p className="text-xs font-medium text-neutral-500">📋 Antrag</p>
                            <p className="mt-0.5 text-sm text-neutral-400">{r.reason}</p>
                          </div>
                        )}
                        {r.resultMessage && (
                          <div className="rounded-lg bg-black/20 px-3 py-2">
                            <p className="text-xs font-medium text-neutral-500">✅ Ergebnis</p>
                            <p className="mt-0.5 text-sm text-neutral-300">{r.resultMessage}</p>
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-neutral-600">
                        <span>Erstellt: {formatDate(r.createdAt)}</span>
                        {r.processedAt && <span>Bearbeitet: {formatDate(r.processedAt)}</span>}
                        {r.createdBy && <span>Von: {r.createdBy}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Tab: Ban-Liste ── */}
        {tab === "bans" && (
          <div className="p-4">
            <input
              type="text"
              placeholder="Spieler suchen…"
              value={banSearch}
              onChange={(e) => setBanSearch(e.target.value)}
              className="mb-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/30"
            />

            {filteredBans.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-12 text-neutral-600">
                <Ban className="h-8 w-8" />
                <p className="text-sm">Keine Bans gefunden.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/[0.06] text-left text-xs text-neutral-500">
                      <th className="pb-2 pr-4 font-medium">Spieler</th>
                      <th className="pb-2 pr-4 font-medium">Grund</th>
                      <th className="pb-2 pr-4 font-medium">Von</th>
                      <th className="pb-2 pr-4 font-medium">Datum</th>
                      <th className="pb-2 font-medium">Läuft ab</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBans.map((ban) => (
                      <tr
                        key={ban.id}
                        className="border-b border-white/[0.04] last:border-0 hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="py-2.5 pr-4">
                          <Link
                            href={`/mod/player/${ban.targetUuid}`}
                            className="flex items-center gap-2 hover:text-sky-300 transition-colors"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={`https://mc-heads.net/avatar/${encodeURIComponent(ban.targetName)}/24`}
                              alt={ban.targetName}
                              width={24}
                              height={24}
                              className="h-6 w-6 rounded"
                              style={{ imageRendering: "pixelated" }}
                            />
                            <span className="font-medium text-neutral-200">{ban.targetName}</span>
                          </Link>
                        </td>
                        <td className="py-2.5 pr-4 max-w-[200px]">
                          <span
                            className="text-neutral-400 truncate block"
                            title={ban.reason}
                          >
                            {ban.reason}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4 text-neutral-500">
                          {ban.staffName ?? <span className="italic text-neutral-700">Unbekannt</span>}
                        </td>
                        <td className="py-2.5 pr-4 text-neutral-500 whitespace-nowrap">
                          {formatDate(ban.createdAt)}
                        </td>
                        <td className="py-2.5 whitespace-nowrap">
                          {ban.expiresAt === null ? (
                            <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-semibold text-red-400">
                              Permanent
                            </span>
                          ) : ban.expiresAt < Date.now() ? (
                            <span className="rounded-full bg-neutral-500/15 px-2 py-0.5 text-xs font-semibold text-neutral-500">
                              Abgelaufen
                            </span>
                          ) : (
                            <span className="text-neutral-500 text-xs">
                              {formatDate(ban.expiresAt)}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

