"use client";

import { useEffect, useState } from "react";
import type { ClusterMetricPoint, InfraEvent, InfraNode, MetricRange } from "@/lib/infraTypes";
import EventTimeline from "./EventTimeline";
import MemoryBar from "./MemoryBar";
import MetricChart from "./MetricChart";
import RangePicker from "./RangePicker";
import UsageBar from "./UsageBar";
import { formatBytes, formatPercent, usageTextColor } from "./utils";

type ApiResponse = {
  ok: boolean;
  metrics: ClusterMetricPoint[];
  events: InfraEvent[];
  range: MetricRange;
  error?: string;
};

/**
 * Gesamtauslastung über ALLE aktiven Nodes zusammen.
 *
 * Die Kennzahlen oben kommen aus den Live-Daten, die das Dashboard ohnehin
 * pollt – so bleiben sie garantiert deckungsgleich mit den Kacheln darunter.
 * Nur der Verlauf wird separat geladen, weil er sich nur beim Wechsel des
 * Zeitraums ändert.
 */
export default function ClusterOverview({ nodes }: { nodes: InfraNode[] }) {
  const [range, setRange] = useState<MetricRange>("24h");
  const [history, setHistory] = useState<ApiResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/infra/cluster?range=${range}`, { cache: "no-store" });
        const json = (await res.json()) as ApiResponse;
        if (!cancelled) setHistory(json);
      } catch {
        // Alten Verlauf stehen lassen.
      }
    }

    load();
    // Deutlich seltener als der Live-Poll – der Verlauf wächst nur alle 30 s.
    const timer = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [range]);

  const changeRange = (next: MetricRange) => {
    setRange(next);
    setHistory(null);
  };

  // Nur aktive Nodes zählen – eine offline VPS stellt keine Kapazität bereit.
  const active = nodes.filter((n) => n.online);
  // RAM und Festplatte kennen wir nur von Nodes, auf denen ein Server läuft
  // und die OS-Werte meldet. Die Zahl wird unten ausgewiesen, damit die
  // Gesamtsumme nicht fälschlich als "das ganze Netzwerk" gelesen wird.
  const withOsData = active.filter((n) => n.ramTotal > 0);

  const ramTotal = withOsData.reduce((sum, n) => sum + n.ramTotal, 0);
  // Echter Verbrauch, nicht "total minus frei" - Cache und Puffer sind kein
  // belegter Speicher, sie werden bei Bedarf sofort wieder freigegeben.
  const ramUsed = withOsData.reduce((sum, n) => sum + n.ramUsed, 0);
  const ramBuffers = withOsData.reduce((sum, n) => sum + n.ramBuffers, 0);
  const ramCached = withOsData.reduce((sum, n) => sum + n.ramCached, 0);
  const ramShared = withOsData.reduce((sum, n) => sum + n.ramShared, 0);
  const ramFree = Math.max(0, ramTotal - ramUsed);

  const diskTotal = withOsData.reduce((sum, n) => sum + n.diskTotal, 0);
  const diskFree = withOsData.reduce((sum, n) => sum + n.diskFree, 0);
  const diskUsed = diskTotal - diskFree;

  const cpuValues = active.map((n) => n.cpuSystem).filter((v) => v >= 0);
  const cpuAvg = cpuValues.length > 0 ? cpuValues.reduce((a, b) => a + b, 0) / cpuValues.length : -1;
  const cpuMax = cpuValues.length > 0 ? Math.max(...cpuValues) : -1;
  const hottest = active.find((n) => n.cpuSystem === cpuMax);

  const ramRatio = ramTotal > 0 ? ramUsed / ramTotal : -1;
  const diskRatio = diskTotal > 0 ? diskUsed / diskTotal : -1;

  const chartData = (history?.metrics ?? []).map((p) => ({
    t: p.t,
    cpuAvg: p.cpuAvg,
    cpuMax: p.cpuMax,
    ram: p.ramTotal > 0 ? p.ramUsed / p.ramTotal : 0,
    disk: p.diskTotal > 0 ? p.diskUsed / p.diskTotal : 0,
    nodes: p.nodes,
    services: p.services,
    players: p.players,
  }));

  return (
    <div className="flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Gesamtauslastung</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            Alle {active.length} aktiven Root-Server zusammengerechnet
            {withOsData.length !== active.length &&
              ` · RAM und Speicherplatz von ${withOsData.length} davon`}
          </p>
        </div>
        <RangePicker value={range} onChange={changeRange} />
      </div>

      {/* Kennzahlen */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SummaryCard
          title="CPU"
          headline={formatPercent(cpuAvg)}
          headlineColor={usageTextColor(cpuAvg)}
          subline={
            cpuMax >= 0 && hottest
              ? `Spitzenreiter: ${hottest.nodeId} mit ${formatPercent(cpuMax)}`
              : "keine Messwerte"
          }
        >
          <UsageBar label="Durchschnitt über alle Nodes" ratio={cpuAvg} />
        </SummaryCard>

        <SummaryCard
          title="Arbeitsspeicher"
          headline={formatBytes(ramUsed)}
          headlineColor={usageTextColor(ramRatio)}
          subline={
            ramTotal > 0
              ? `${formatBytes(ramFree)} noch vergebbar von ${formatBytes(ramTotal)}`
              : "keine Betriebssystem-Werte"
          }
        >
          <MemoryBar
            parts={{
              total: ramTotal,
              used: ramUsed,
              buffers: ramBuffers,
              cached: ramCached,
              shared: ramShared,
            }}
          />
        </SummaryCard>

        <SummaryCard
          title="Speicherplatz"
          headline={formatBytes(diskUsed)}
          headlineColor={usageTextColor(diskRatio)}
          subline={
            diskTotal > 0
              ? `${formatBytes(diskFree)} frei von ${formatBytes(diskTotal)}`
              : "keine Betriebssystem-Werte"
          }
        >
          <UsageBar label="belegt" ratio={diskRatio} />
        </SummaryCard>
      </div>

      {/* Verlauf */}
      {history && !history.ok ? (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4 text-center text-sm text-rose-300">
          {history.error ?? "Verlauf konnte nicht geladen werden."}
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div>
            <div className="mb-1 text-xs text-neutral-500">
              Auslastung über alle Nodes · CPU im Mittel und der jeweils höchste Einzelwert
            </div>
            <MetricChart
              data={chartData}
              range={range}
              percent
              mode="line"
              formatValue={(v) => `${Math.round(v * 100)} %`}
              events={history?.events ?? []}
              series={[
                { key: "cpuAvg", label: "CPU Ø", color: "#38bdf8" },
                { key: "cpuMax", label: "CPU höchster Node", color: "#fb7185" },
                { key: "ram", label: "RAM", color: "#34d399" },
                { key: "disk", label: "Speicherplatz", color: "#fbbf24" },
              ]}
            />
          </div>

          <div>
            <div className="mb-1 text-xs text-neutral-500">Nodes, Services und Spieler</div>
            <MetricChart
              data={chartData}
              range={range}
              height={180}
              mode="line"
              events={history?.events ?? []}
              series={[
                { key: "nodes", label: "Nodes", color: "#a78bfa" },
                { key: "services", label: "Services", color: "#60a5fa" },
                { key: "players", label: "Spieler", color: "#f472b6" },
              ]}
            />
          </div>

          <EventTimeline events={history?.events ?? []} />
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  title,
  headline,
  headlineColor,
  subline,
  children,
}: {
  title: string;
  headline: string;
  headlineColor: string;
  subline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-sm text-neutral-500">{title}</div>
      <div className={`mt-0.5 text-2xl font-bold ${headlineColor}`}>{headline}</div>
      <div className="mb-3 text-xs text-neutral-500">{subline}</div>
      {children}
    </div>
  );
}
