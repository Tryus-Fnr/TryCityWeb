"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { InfraNode, InfraService, MetricRange, NodeMetricPoint } from "@/lib/infraTypes";
import MetricChart from "./MetricChart";
import RangePicker from "./RangePicker";
import ServiceTable from "./ServiceTable";
import UsageBar from "./UsageBar";
import { formatAge, formatBytes, formatPercent } from "./utils";

type ApiResponse = {
  ok: boolean;
  node: InfraNode;
  services: InfraService[];
  metrics: NodeMetricPoint[];
  range: MetricRange;
  at: number;
  error?: string;
};

const POLL_MS = 5000;

/**
 * Detailseite einer VPS: aktuelle Auslastung, Verlauf und alle CloudNet-Services,
 * die auf dieser Maschine laufen.
 */
export default function NodeDetail({ nodeId }: { nodeId: string }) {
  const [range, setRange] = useState<MetricRange>("24h");
  const [data, setData] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/infra/node/${encodeURIComponent(nodeId)}?range=${range}`, {
          cache: "no-store",
        });
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) setData(json);
      } catch {
        // Beim Poll-Fehler die vorhandene Ansicht stehen lassen.
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [range, nodeId]);

  /** Zeitraumwechsel leert die Ansicht bewusst – sonst mischen sich Auflösungen. */
  const changeRange = (next: MetricRange) => {
    setRange(next);
    setData(null);
  };

  if (!data) {
    return <div className="py-16 text-center text-neutral-500">Lade VPS-Daten…</div>;
  }

  if (!data.ok) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-rose-300">
        {data?.error ?? "VPS konnte nicht geladen werden."}
      </div>
    );
  }

  const node = data.node;
  const ramRatio = node.ramTotal > 0 ? (node.ramTotal - node.ramFree) / node.ramTotal : -1;
  const diskRatio = node.diskTotal > 0 ? (node.diskTotal - node.diskFree) / node.diskTotal : -1;
  const budgetRatio = node.memMaxMb > 0 ? node.memReservedMb / node.memMaxMb : -1;

  // Für das RAM-Diagramm interessiert der Anteil, nicht der absolute Wert –
  // sonst sind VPS mit unterschiedlicher Größe nicht vergleichbar.
  const chartData = data.metrics.map((p) => ({
    t: p.t,
    cpu: p.cpuSystem,
    ram: p.ramTotal > 0 ? p.ramUsed / p.ramTotal : 0,
    disk: p.diskTotal > 0 ? p.diskUsed / p.diskTotal : 0,
    players: p.players,
    services: p.services,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/infra" className="text-sm text-neutral-500 hover:text-sky-300">
            ← Zurück zur Übersicht
          </Link>
          <h1 className="mt-1 flex items-center gap-2 text-3xl font-bold tracking-tight">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                !node.online ? "bg-rose-500" : node.draining ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            {node.nodeId}
          </h1>
          <p className="mt-1 text-sm text-neutral-500">
            {node.host || "keine Adresse"}
            {node.osName && ` · ${node.osName}`}
            {node.cpuCores > 0 && ` · ${node.cpuCores} Kerne`}
            {node.cloudnetVersion && ` · CloudNet ${node.cloudnetVersion}`}
          </p>
        </div>
        <div className="text-right text-xs text-neutral-500">
          <div>Gemessen {formatAge(node.updatedAt)}</div>
          {node.hostUpdatedAt > 0 && <div>OS-Werte {formatAge(node.hostUpdatedAt)}</div>}
        </div>
      </div>

      {/* Aktuelle Auslastung */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel title="CPU (System)" value={formatPercent(node.cpuSystem)}>
          <UsageBar
            label={node.loadAverage >= 0 ? `Load ${node.loadAverage.toFixed(2)}` : "Auslastung"}
            ratio={node.cpuSystem}
          />
        </Panel>
        <Panel title="Arbeitsspeicher" value={formatPercent(ramRatio)}>
          <UsageBar
            label={`${formatBytes(node.ramTotal - node.ramFree)} / ${formatBytes(node.ramTotal)}`}
            ratio={ramRatio}
          />
        </Panel>
        <Panel title="Speicherplatz" value={formatPercent(diskRatio)}>
          <UsageBar
            label={`${formatBytes(node.diskTotal - node.diskFree)} frei: ${formatBytes(node.diskFree)}`}
            ratio={diskRatio}
          />
        </Panel>
        <Panel title="CloudNet-Budget" value={`${node.memReservedMb} MB`}>
          <UsageBar label={`von ${node.memMaxMb} MB reserviert`} ratio={budgetRatio} />
        </Panel>
      </div>

      {/* Verlauf */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Verlauf</h2>
          <RangePicker value={range} onChange={changeRange} />
        </div>

        <div>
          <div className="mb-1 text-xs text-neutral-500">CPU, RAM und Speicherplatz</div>
          <MetricChart
            data={chartData}
            range={range}
            percent
            formatValue={(v) => `${Math.round(v * 100)} %`}
            series={[
              { key: "cpu", label: "CPU", color: "#38bdf8" },
              { key: "ram", label: "RAM", color: "#34d399" },
              { key: "disk", label: "Speicherplatz", color: "#fbbf24" },
            ]}
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-neutral-500">Services und Spieler</div>
          <MetricChart
            data={chartData}
            range={range}
            height={180}
            mode="line"
            series={[
              { key: "services", label: "Services", color: "#a78bfa" },
              { key: "players", label: "Spieler", color: "#f472b6" },
            ]}
          />
        </div>
      </div>

      {/* Services dieser VPS */}
      <div className="flex flex-col gap-3">
        <h2 className="font-semibold">
          Services auf dieser VPS{" "}
          <span className="text-neutral-500">({data.services.length})</span>
        </h2>
        <ServiceTable services={data.services} showNode={false} />
      </div>
    </div>
  );
}

function Panel({
  title,
  value,
  children,
}: {
  title: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className="mt-0.5 mb-3 text-2xl font-bold">{value}</div>
      {children}
    </div>
  );
}
