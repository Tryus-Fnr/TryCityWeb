"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InfraNode, InfraService } from "@/lib/infraTypes";
import ClusterOverview from "./ClusterOverview";
import MemoryBar from "./MemoryBar";
import ServiceTable from "./ServiceTable";
import UsageBar from "./UsageBar";
import { formatAge, formatBytes } from "./utils";

type ApiResponse = {
  ok: boolean;
  nodes: InfraNode[];
  services: InfraService[];
  at: number;
  error?: string;
};

/** Wie oft der Live-Zustand nachgeladen wird. Der Proxy misst alle 30 s. */
const POLL_MS = 5000;

/**
 * Übersicht aller VPS und aller CloudNet-Services.
 *
 * Pollt statt Server-Sent-Events, weil die Daten ohnehin aus MySQL kommen und
 * ein Intervall hier robuster ist als eine offene Verbindung hinter dem
 * Reverse-Proxy. Neue Services erscheinen automatisch, weil jede Antwort die
 * vollständige Liste enthält.
 */
export default function InfraDashboard() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [view, setView] = useState<"nodes" | "services">("nodes");
  const [stale, setStale] = useState(false);

  useEffect(() => {
    // `cancelled` verhindert setState nach dem Unmount – der Poll kann noch
    // unterwegs sein, wenn die Seite schon gewechselt wurde.
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch("/api/infra", { cache: "no-store" });
        const json = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setData(json);
        setStale(false);
      } catch {
        // Netzwerkfehler: alte Daten stehen lassen, aber sichtbar markieren.
        if (!cancelled) setStale(true);
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  if (!data) {
    return <div className="py-16 text-center text-neutral-500">Lade Infrastruktur…</div>;
  }

  if (!data.ok) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-rose-300">
        {data?.error ?? "Infrastruktur-Daten konnten nicht geladen werden."}
      </div>
    );
  }

  const totalPlayers = data.services.reduce((sum, s) => sum + s.players, 0);
  const onlineNodes = data.nodes.filter((n) => n.online).length;

  return (
    <div className="flex flex-col gap-6">
      {/* Kennzahlen */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Root-Server" value={`${onlineNodes} / ${data.nodes.length}`} accent />
        <Stat label="Services" value={String(data.services.length)} />
        <Stat label="Spieler" value={String(totalPlayers)} />
        <Stat
          label="Aktualisiert"
          value={stale ? "getrennt" : formatAge(data.at)}
          muted={stale}
        />
      </div>

      {/* Gesamtauslastung über alle Nodes */}
      <ClusterOverview nodes={data.nodes} />

      {/* Umschalter */}
      <div className="flex gap-2">
        {(
          [
            ["nodes", "Nach VPS"],
            ["services", "Alle Server"],
          ] as ["nodes" | "services", string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setView(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              view === key
                ? "bg-sky-500/15 text-sky-300"
                : "border border-white/10 text-neutral-400 hover:bg-white/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {view === "nodes" ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {data.nodes.map((node) => (
            <NodeCard
              key={node.nodeId}
              node={node}
              services={data.services.filter((s) => s.nodeId === node.nodeId)}
            />
          ))}
          {data.nodes.length === 0 && (
            <div className="col-span-full rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-center text-neutral-500">
              Noch keine Node-Daten erfasst. Läuft der Proxy mit aktueller Version?
            </div>
          )}
        </div>
      ) : (
        <ServiceTable services={data.services} />
      )}
    </div>
  );
}

/** Kachel einer VPS – führt per Klick auf die Detailseite. */
function NodeCard({ node, services }: { node: InfraNode; services: InfraService[] }) {
  const diskRatio = node.diskTotal > 0 ? (node.diskTotal - node.diskFree) / node.diskTotal : -1;
  const budgetRatio = node.memMaxMb > 0 ? node.memReservedMb / node.memMaxMb : -1;
  const hasOsData = node.ramTotal > 0;

  return (
    <Link
      href={`/infra/node/${encodeURIComponent(node.nodeId)}`}
      className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.05]"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                !node.online ? "bg-rose-500" : node.draining ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            <span className="font-semibold">{node.nodeId}</span>
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            {node.host || "–"}
            {node.cpuCores > 0 && ` · ${node.cpuCores} Kerne`}
          </div>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <div className="text-sm font-medium text-neutral-300">{services.length} Services</div>
          <div>{node.players} Spieler</div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <UsageBar label="CPU (System)" ratio={node.cpuSystem} />
        {hasOsData ? (
          <>
            <MemoryBar node={node} />
            <UsageBar
              label="Speicherplatz"
              ratio={diskRatio}
              detail={`${formatBytes(node.diskTotal - node.diskFree)} / ${formatBytes(node.diskTotal)}`}
            />
          </>
        ) : (
          <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300/80">
            Keine Betriebssystem-Werte – auf dieser VPS läuft gerade kein Server, der sie melden
            könnte.
          </div>
        )}
        <UsageBar
          label="CloudNet-Budget"
          ratio={budgetRatio}
          detail={`${node.memReservedMb} / ${node.memMaxMb} MB`}
        />
      </div>

      <div className="flex items-center justify-between border-t border-white/5 pt-3 text-xs text-neutral-500">
        <span>Gemessen {formatAge(node.updatedAt)}</span>
        <span>{node.cloudnetVersion}</span>
      </div>
    </Link>
  );
}

function Stat({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 text-center">
      <div
        className={`text-2xl font-bold ${
          muted ? "text-rose-400" : accent ? "text-sky-400" : ""
        }`}
      >
        {value}
      </div>
      <div className="mt-1 text-sm text-neutral-500">{label}</div>
    </div>
  );
}
