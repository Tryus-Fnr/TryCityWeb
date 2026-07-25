"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { InfraService } from "@/lib/infraTypes";
import { environmentLabel, formatBytes, formatPercent, formatUptime, usageTextColor } from "./utils";

type SortKey = "name" | "node" | "cpu" | "heap" | "players";

type Props = {
  services: InfraService[];
  /** Node-Spalte ausblenden, wenn ohnehin nur eine VPS gezeigt wird. */
  showNode?: boolean;
};

/**
 * Tabelle aller Services – auch Proxies, denn deren Auslastung interessiert
 * genauso. Jede Zeile führt auf die Detailseite des Services.
 */
export default function ServiceTable({ services, showNode = true }: Props) {
  const [sort, setSort] = useState<SortKey>("name");
  const [filter, setFilter] = useState("");

  const rows = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const filtered = needle
      ? services.filter(
          (s) =>
            s.serviceName.toLowerCase().includes(needle) ||
            s.taskName.toLowerCase().includes(needle) ||
            s.nodeId.toLowerCase().includes(needle)
        )
      : services;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "cpu":
          return b.cpu - a.cpu;
        case "heap":
          return b.heapUsed - a.heapUsed;
        case "players":
          return b.players - a.players;
        case "node":
          return a.nodeId.localeCompare(b.nodeId) || a.serviceName.localeCompare(b.serviceName);
        default:
          return a.serviceName.localeCompare(b.serviceName);
      }
    });
  }, [services, sort, filter]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Server, Task oder Node suchen…"
          className="min-w-56 flex-1 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-1.5 text-sm outline-none placeholder:text-neutral-600 focus:border-white/20"
        />
        <div className="flex gap-1">
          {(
            [
              ["name", "Name"],
              ["node", "VPS"],
              ["cpu", "CPU"],
              ["heap", "RAM"],
              ["players", "Spieler"],
            ] as [SortKey, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setSort(key)}
              className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                sort === key
                  ? "bg-sky-500/15 text-sky-300"
                  : "border border-white/10 text-neutral-400 hover:bg-white/5"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full min-w-[52rem] text-sm">
          <thead>
            <tr className="bg-white/[0.04] text-left text-neutral-400">
              <th className="px-4 py-3 font-medium">Service</th>
              <th className="px-4 py-3 font-medium">Typ</th>
              {showNode && <th className="px-4 py-3 font-medium">VPS</th>}
              <th className="px-4 py-3 text-right font-medium">CPU</th>
              <th className="px-4 py-3 text-right font-medium">Heap</th>
              <th className="px-4 py-3 text-right font-medium">Threads</th>
              <th className="px-4 py-3 text-right font-medium">Spieler</th>
              <th className="px-4 py-3 text-right font-medium">Laufzeit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => {
              const env = environmentLabel(s.environment);
              const heapRatio = s.heapMax > 0 ? s.heapUsed / s.heapMax : -1;
              return (
                <tr key={s.serviceName} className="border-t border-white/5 hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <Link
                      href={`/infra/service/${encodeURIComponent(s.serviceName)}`}
                      className="font-medium text-sky-300 hover:underline"
                    >
                      {s.serviceName}
                    </Link>
                    <div className="text-xs text-neutral-500">
                      <span
                        className={`mr-1.5 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                          s.online ? "bg-emerald-400" : s.connected ? "bg-amber-400" : "bg-neutral-600"
                        }`}
                      />
                      {s.lifecycle.toLowerCase()}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${env.className}`}>
                      {env.label}
                    </span>
                    <div className="mt-0.5 text-xs text-neutral-500">{s.taskName}</div>
                  </td>
                  {showNode && (
                    <td className="px-4 py-3">
                      <Link
                        href={`/infra/node/${encodeURIComponent(s.nodeId)}`}
                        className="text-neutral-300 hover:text-sky-300 hover:underline"
                      >
                        {s.nodeId || "–"}
                      </Link>
                    </td>
                  )}
                  <td className={`px-4 py-3 text-right tabular-nums ${usageTextColor(s.cpu)}`}>
                    {formatPercent(s.cpu)}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={usageTextColor(heapRatio)}>{formatBytes(s.heapUsed)}</span>
                    {s.heapMax > 0 && (
                      <span className="text-neutral-600"> / {formatBytes(s.heapMax)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-400">{s.threads}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.players}
                    <span className="text-neutral-600"> / {s.maxPlayers}</span>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                    {formatUptime(s.createdAt)}
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={showNode ? 8 : 7} className="px-4 py-8 text-center text-neutral-500">
                  Keine Services gefunden.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
