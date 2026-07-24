"use client";

import { useState } from "react";
import Link from "next/link";
import type { UnbanRequestRow } from "@/lib/queries";
import { Clock, CheckCircle, XCircle, AlertCircle, FileText } from "lucide-react";

type Props = {
  unbanRequests: UnbanRequestRow[];
};

const STATUS_COLORS: Record<string, string> = {
  PENDING:   "bg-yellow-500/15 text-yellow-400",
  DONE:      "bg-green-500/15 text-green-400",
  FAILED:    "bg-red-500/15 text-red-400",
  // Legacy-Werte (falls ältere Einträge vorhanden)
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

export default function ModPanel({ unbanRequests }: Props) {
  const [filter, setFilter] = useState<"ALL" | "PENDING" | "DONE" | "FAILED">("ALL");
  const [search, setSearch] = useState("");

  const filtered = unbanRequests.filter((r) => {
    if (filter !== "ALL" && r.status !== filter) return false;
    if (search && !r.targetName.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const pending = unbanRequests.filter((r) => r.status === "PENDING").length;
  const done    = unbanRequests.filter((r) => r.status === "DONE" || r.status === "APPROVED").length;
  const failed  = unbanRequests.filter((r) => r.status === "FAILED" || r.status === "DENIED").length;

  // created_at ist BIGINT (ms-Timestamp) aus der DB
  function formatDate(ts: number | string) {
    return new Date(Number(ts)).toLocaleString("de-DE", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-neutral-500">Ausstehend</p>
          <p className="mt-1 text-2xl font-bold text-yellow-400">{pending}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-neutral-500">Erledigt</p>
          <p className="mt-1 text-2xl font-bold text-green-400">{done}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
          <p className="text-sm text-neutral-500">Fehlgeschlagen</p>
          <p className="mt-1 text-2xl font-bold text-red-400">{failed}</p>
        </div>
      </div>

      {/* Quick Link */}
      <div className="flex gap-3">
        <Link
          href="/mod/players"
          className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-4 py-2 text-sm font-medium text-sky-300 transition-colors hover:bg-sky-500/20"
        >
          <FileText className="h-4 w-4" />
          Spieler-Suche öffnen
        </Link>
      </div>

      {/* Unban Requests */}
      <div className="rounded-xl border border-white/10 bg-white/[0.03]">
        <div className="flex flex-col gap-3 border-b border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">Entbannungs-Anträge</h2>
          <div className="flex gap-2 flex-wrap">
            {([
              { key: "ALL",     label: "Alle" },
              { key: "PENDING", label: "Ausstehend" },
              { key: "DONE",    label: "Erledigt" },
              { key: "FAILED",  label: "Fehlgeschlagen" },
            ] as const).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`rounded-lg px-3 py-1 text-xs font-medium transition-colors ${
                  filter === key
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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="mb-4 w-full rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2 text-sm text-neutral-200 placeholder-neutral-600 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/30"
          />

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-neutral-600">
              <AlertCircle className="h-8 w-8" />
              <p className="text-sm">Keine Anträge gefunden.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((r) => (
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
                    {/* Nachricht des Spielers (Entschuldigung) */}
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
                    {/* Ticket-Betreff / Antrag-Bezeichnung vom Bot */}
                    {r.reason && (
                      <div className="rounded-lg bg-black/20 px-3 py-2">
                        <p className="text-xs font-medium text-neutral-500">📋 Antrag</p>
                        <p className="mt-0.5 text-sm text-neutral-400">{r.reason}</p>
                      </div>
                    )}
                    {/* Ergebnis nach Bearbeitung */}
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
    </div>
  );
}

