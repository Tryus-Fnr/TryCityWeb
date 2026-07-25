"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { InfraService, MetricRange, ServiceMetricPoint } from "@/lib/infraTypes";
import MetricChart from "./MetricChart";
import RangePicker from "./RangePicker";
import UsageBar from "./UsageBar";
import { environmentLabel, formatAge, formatBytes, formatPercent, formatUptime } from "./utils";

type DetailResponse = {
  ok: boolean;
  service: InfraService | null;
  metrics: ServiceMetricPoint[];
  range: MetricRange;
  at: number;
  error?: string;
};

type CompareResponse = {
  ok: boolean;
  series: Record<string, ServiceMetricPoint[]>;
};

type LiveResponse = { ok: boolean; services: InfraService[] };

const POLL_MS = 5000;

/** Farbpalette für den Vergleich – bewusst gut unterscheidbar. */
const COMPARE_COLORS = ["#38bdf8", "#f472b6", "#fbbf24", "#a78bfa", "#34d399", "#fb7185", "#60a5fa"];

/**
 * Detailseite eines CloudNet-Services (Server oder Proxy) mit Verlauf und
 * einem direkten Vergleich gegen andere Services.
 */
export default function ServiceDetail({ serviceName }: { serviceName: string }) {
  const [range, setRange] = useState<MetricRange>("24h");
  const [data, setData] = useState<DetailResponse | null>(null);

  const [allServices, setAllServices] = useState<InfraService[]>([]);
  const [compareWith, setCompareWith] = useState<string[]>([]);
  const [rawCompare, setRawCompare] = useState<CompareResponse | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/infra/service/${encodeURIComponent(serviceName)}?range=${range}`,
          { cache: "no-store" }
        );
        const json = (await res.json()) as DetailResponse;
        if (!cancelled) setData(json);
      } catch {
        // Poll-Fehler: alte Ansicht behalten.
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [range, serviceName]);

  // Auswahlliste für den Vergleich
  useEffect(() => {
    let cancelled = false;
    fetch("/api/infra", { cache: "no-store" })
      .then((r) => r.json() as Promise<LiveResponse>)
      .then((r) => {
        if (!cancelled) setAllServices(r.ok ? r.services : []);
      })
      .catch(() => {
        if (!cancelled) setAllServices([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Vergleichsdaten nachladen, wenn Auswahl oder Zeitraum sich ändern
  useEffect(() => {
    if (compareWith.length === 0) return;

    let cancelled = false;
    const names = [serviceName, ...compareWith].join(",");
    fetch(`/api/infra/compare?services=${encodeURIComponent(names)}&range=${range}`, {
      cache: "no-store",
    })
      .then((r) => r.json() as Promise<CompareResponse>)
      .then((r) => {
        if (!cancelled) setRawCompare(r);
      })
      .catch(() => {
        if (!cancelled) setRawCompare(null);
      });
    return () => {
      cancelled = true;
    };
  }, [compareWith, range, serviceName]);

  // Ohne Auswahl gibt es nichts zu vergleichen – abgeleitet statt im Effekt
  // zurückgesetzt, damit beim Abwählen nicht kurz alte Kurven stehen bleiben.
  const compareData = compareWith.length === 0 ? null : rawCompare;

  /** Zeitraumwechsel leert die Ansicht bewusst – sonst mischen sich Auflösungen. */
  const changeRange = (next: MetricRange) => {
    setRange(next);
    setData(null);
  };

  /**
   * Führt die Zeitreihen mehrerer Services zu gemeinsamen Datenpunkten zusammen.
   * Recharts braucht eine Zeile pro Zeitstempel mit einer Spalte je Serie.
   */
  const compareChart = useMemo(() => {
    if (!compareData?.ok) return { data: [], series: [] };
    const names = Object.keys(compareData.series);
    const byTime = new Map<number, Record<string, number>>();

    names.forEach((name) => {
      for (const point of compareData.series[name]) {
        const row = byTime.get(point.t) ?? { t: point.t };
        row[name] = point.cpu;
        byTime.set(point.t, row);
      }
    });

    return {
      data: [...byTime.values()].sort((a, b) => a.t - b.t),
      series: names.map((name, i) => ({
        key: name,
        label: name,
        color: COMPARE_COLORS[i % COMPARE_COLORS.length],
      })),
    };
  }, [compareData]);

  if (!data) {
    return <div className="py-16 text-center text-neutral-500">Lade Server-Daten…</div>;
  }

  if (!data?.ok) {
    return (
      <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-6 text-center text-rose-300">
        {data?.error ?? "Server konnte nicht geladen werden."}
      </div>
    );
  }

  const service = data.service;
  const env = service ? environmentLabel(service.environment) : null;
  const heapRatio = service && service.heapMax > 0 ? service.heapUsed / service.heapMax : -1;
  const playerRatio = service && service.maxPlayers > 0 ? service.players / service.maxPlayers : -1;

  const chartData = data.metrics.map((p) => ({
    t: p.t,
    cpu: p.cpu,
    heap: p.heapUsed,
    players: p.players,
    threads: p.threads,
  }));

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/infra" className="text-sm text-neutral-500 hover:text-sky-300">
            ← Zurück zur Übersicht
          </Link>
          <h1 className="mt-1 flex flex-wrap items-center gap-2 text-3xl font-bold tracking-tight">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                service?.online ? "bg-emerald-400" : service?.connected ? "bg-amber-400" : "bg-neutral-600"
              }`}
            />
            {serviceName}
            {env && (
              <span className={`rounded-md px-2 py-1 text-xs font-medium ${env.className}`}>
                {env.label}
              </span>
            )}
          </h1>
          {service ? (
            <p className="mt-1 text-sm text-neutral-500">
              Task {service.taskName} · läuft auf{" "}
              <Link
                href={`/infra/node/${encodeURIComponent(service.nodeId)}`}
                className="text-sky-300 hover:underline"
              >
                {service.nodeId}
              </Link>
              {service.address && ` · ${service.address}:${service.port}`}
            </p>
          ) : (
            <p className="mt-1 text-sm text-amber-300/80">
              Dieser Server läuft gerade nicht – unten steht nur noch der Verlauf.
            </p>
          )}
        </div>
        {service && (
          <div className="text-right text-xs text-neutral-500">
            <div>Gemessen {formatAge(service.updatedAt)}</div>
            <div>Läuft seit {formatUptime(service.createdAt)}</div>
          </div>
        )}
      </div>

      {/* Aktuelle Werte */}
      {service && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Panel title="CPU" value={formatPercent(service.cpu)}>
            <UsageBar label="Prozess-Auslastung" ratio={service.cpu} />
          </Panel>
          <Panel title="Heap" value={formatBytes(service.heapUsed)}>
            <UsageBar label={`von ${formatBytes(service.heapMax)}`} ratio={heapRatio} />
          </Panel>
          <Panel title="Spieler" value={`${service.players} / ${service.maxPlayers}`}>
            <UsageBar label="Belegung" ratio={playerRatio} />
          </Panel>
          <Panel title="Threads" value={String(service.threads)}>
            <div className="text-xs text-neutral-500">Status: {service.lifecycle.toLowerCase()}</div>
          </Panel>
        </div>
      )}

      {/* Verlauf */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-semibold">Verlauf</h2>
          <RangePicker value={range} onChange={changeRange} />
        </div>

        <div>
          <div className="mb-1 text-xs text-neutral-500">CPU-Auslastung</div>
          <MetricChart
            data={chartData}
            range={range}
            percent
            formatValue={(v) => `${Math.round(v * 100)} %`}
            series={[{ key: "cpu", label: "CPU", color: "#38bdf8" }]}
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-neutral-500">Belegter Heap</div>
          <MetricChart
            data={chartData}
            range={range}
            height={180}
            formatValue={formatBytes}
            series={[{ key: "heap", label: "Heap", color: "#34d399" }]}
          />
        </div>

        <div>
          <div className="mb-1 text-xs text-neutral-500">Spieler und Threads</div>
          <MetricChart
            data={chartData}
            range={range}
            height={180}
            mode="line"
            series={[
              { key: "players", label: "Spieler", color: "#f472b6" },
              { key: "threads", label: "Threads", color: "#a78bfa" },
            ]}
          />
        </div>
      </div>

      {/* Vergleich */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
        <div>
          <h2 className="font-semibold">Mit anderen Servern vergleichen</h2>
          <p className="mt-0.5 text-sm text-neutral-500">
            CPU-Verlauf mehrerer Services übereinander – zeigt, ob ein Server aus der Reihe fällt.
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {allServices
            .filter((s) => s.serviceName !== serviceName)
            .map((s) => {
              const active = compareWith.includes(s.serviceName);
              return (
                <button
                  key={s.serviceName}
                  onClick={() =>
                    setCompareWith((prev) =>
                      active
                        ? prev.filter((n) => n !== s.serviceName)
                        : // Der eigene Server zählt mit, deshalb hier bei 7 kappen.
                          prev.length >= 7
                          ? prev
                          : [...prev, s.serviceName]
                    )
                  }
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? "bg-sky-500/15 text-sky-300"
                      : "border border-white/10 text-neutral-400 hover:bg-white/5"
                  }`}
                >
                  {s.serviceName}
                </button>
              );
            })}
        </div>

        {compareWith.length === 0 ? (
          <div className="flex h-40 items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] text-sm text-neutral-500">
            Wähle oben mindestens einen Server zum Vergleich aus.
          </div>
        ) : (
          <MetricChart
            data={compareChart.data}
            series={compareChart.series}
            range={range}
            percent
            mode="line"
            formatValue={(v) => `${Math.round(v * 100)} %`}
            height={280}
          />
        )}
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
