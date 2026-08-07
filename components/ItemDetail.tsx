"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import ItemIcon from "@/components/ItemIcon";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  BarChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatMaterialName, formatMoney, formatTs } from "@/lib/format";

type Meta = {
  id: number;
  material: string;
  targetPrice: number;
  strength: number; // 0..1
  startAt: string;
  endAt: string;
  state: "PENDING" | "ACTIVE" | "COOLDOWN" | "DONE";
  priceBefore: number | null;
  createdBy: string;
};

type Detail = {
  ok: boolean;
  error?: string;
  currentPrice: number | null;
  settings: {
    startValue: number;
    minPrice: number;
    maxPrice: number;
    trendDays: number;
    gravity: number;
  } | null;
  history: { ts: string; price: number; sold: number }[];
  changes: { changedAt: string; startValue: number; currentPrice: number }[];
  meta: Meta | null;
  metaHistory: Meta[];
};

const META_STATE_TEXT: Record<Meta["state"], string> = {
  PENDING: "wartet auf den nächsten Lauf",
  ACTIVE: "aktiv",
  COOLDOWN: "läuft aus",
  DONE: "beendet",
};

const META_COLOR = "#f472b6";

type MarketPoint = {
  day: string;
  avgAuction: number | null;
  avgOrder: number | null;
};

type MergedPoint = {
  ts: string;
  price: number;
  sold: number;
  avgAuction: number | null;
  avgOrder: number | null;
};

const SERIES = [
  { key: "price",      label: "Shoppreis",      color: "#34d399" },
  { key: "avgAuction", label: "Ø Auktionshaus", color: "#a78bfa" },
  { key: "avgOrder",   label: "Ø Kaufauftrag",  color: "#fb923c" },
] as const;

type SeriesKey = (typeof SERIES)[number]["key"];

/**
 * Achsenbeschriftung. Preise reichen von 0,01 bis in die Tausender – ohne
 * adaptive Nachkommastellen stünden auf einer 0,01er-Achse dreimal "$0,01".
 */
function axisTick(v: number): string {
  const abs = Math.abs(v);
  if (abs === 0) return "$0";
  if (abs >= 1000)
    return `$${(v / 1000).toLocaleString("de-DE", { maximumFractionDigits: 1 })}k`;
  if (abs >= 1) return `$${v.toLocaleString("de-DE", { maximumFractionDigits: 2 })}`;
  return `$${v.toLocaleString("de-DE", { maximumFractionDigits: 4 })}`;
}

const RANGES = [
  { key: "14d", label: "14 Tage" },
  { key: "30d", label: "30 Tage" },
  { key: "90d", label: "90 Tage" },
  { key: "all", label: "Alles" },
] as const;

export default function ItemDetail({
  material,
  isAdmin = false,
}: {
  material: string;
  isAdmin?: boolean;
}) {
  const [range, setRange] = useState<string>("14d");
  const [data, setData] = useState<Detail | null>(null);
  const [market, setMarket] = useState<MarketPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  // Jede Serie auf ihrer eigenen Y-Achse. Nötig, weil ein Shoppreis von $0,01 neben
  // einem Auktionsschnitt von $500 auf einer gemeinsamen Achse eine flache Linie wäre.
  const [splitScales, setSplitScales] = useState(true);
  const [showTurns, setShowTurns] = useState(true);

  const load = useCallback(
    async (r: string) => {
      setLoading(true);
      try {
        const [detailRes, marketRes] = await Promise.all([
          fetch(`/api/items/${material}?range=${r}`),
          fetch(`/api/items/${material}/market?range=${r}`),
        ]);
        setData((await detailRes.json()) as Detail);
        const mj = await marketRes.json();
        setMarket(mj.ok && Array.isArray(mj.data) ? mj.data : []);
      } catch {
        setData(null);
        setMarket([]);
      } finally {
        setLoading(false);
      }
    },
    [material]
  );

  useEffect(() => { load(range); }, [range, load]);

  // Merge price history with daily market averages
  const merged = useMemo<MergedPoint[]>(() => {
    if (!data?.history) return [];
    const byDay = new Map<string, { avgAuction: number | null; avgOrder: number | null }>();
    for (const m of market) byDay.set(m.day, { avgAuction: m.avgAuction, avgOrder: m.avgOrder });
    return data.history.map((h) => {
      const day = h.ts.split(" ")[0]; // "2026-07-13"
      const mkt = byDay.get(day);
      return { ...h, avgAuction: mkt?.avgAuction ?? null, avgOrder: mkt?.avgOrder ?? null };
    });
  }, [data?.history, market]);

  // Serien ohne einen einzigen Datenpunkt bekommen keine Achse – sonst stünde eine
  // leere "$0"-Skala im Diagramm.
  const hasData = useMemo(
    () => ({
      price:      merged.some((p) => p.price !== null && p.price !== undefined),
      avgAuction: merged.some((p) => p.avgAuction !== null),
      avgOrder:   merged.some((p) => p.avgOrder !== null),
    }),
    [merged]
  );

  /** Achse, an der sich Gitternetz und Änderungsmarker orientieren. */
  const primaryAxisId: string = splitScales
    ? SERIES.find((s) => hasData[s.key] && !hidden.has(s.key))?.key ?? "price"
    : "shared";
  const axisIdOf = (key: SeriesKey) => (splitScales ? key : "shared");

  const toggleSeries = (key: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  /**
   * Wendepunkte des Shoppreises: Stellen, an denen die Kurve die Richtung
   * wechselt. Flache Stücke werden übersprungen, sonst würde jede Pause als
   * Wende zählen.
   */
  const turningIdx = useMemo(() => {
    const set = new Set<number>();
    let prevDir = 0;
    for (let i = 1; i < merged.length; i++) {
      const d = merged[i].price - merged[i - 1].price;
      if (Math.abs(d) < 1e-9) continue;
      const dir = d > 0 ? 1 : -1;
      if (prevDir !== 0 && dir !== prevDir) set.add(i - 1);
      prevDir = dir;
    }
    return set;
  }, [merged]);

  const name = formatMaterialName(material);
  const firstTs = data?.history[0]?.ts ?? null;
  const lastTs = data?.history[data.history.length - 1]?.ts ?? null;
  const visibleChanges =
    data?.changes.filter((c) => firstTs !== null && c.changedAt >= firstTs) ?? [];

  /** Metas als schattierte Bänder im Graphen – laufende und bereits beendete. */
  const metaBands = useMemo(() => {
    if (!data?.history?.length || firstTs === null || lastTs === null) return [];
    const all = [...(data.metaHistory ?? []), ...(data.meta ? [data.meta] : [])];
    return all
      .filter((m) => m.endAt >= firstTs && m.startAt <= lastTs)
      .map((m) => ({
        meta: m,
        x1: nearestTs(data.history, m.startAt < firstTs ? firstTs : m.startAt),
        x2: nearestTs(data.history, m.endAt > lastTs ? lastTs : m.endAt),
      }));
  }, [data?.history, data?.meta, data?.metaHistory, firstTs, lastTs]);

  return (
    <div className="flex flex-col gap-6">
      {/* Kopf */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/items" className="text-sm text-neutral-500 hover:text-neutral-300">
            ← Alle Items
          </Link>
          <div className="mt-2 flex items-center gap-3">
            <ItemIcon material={material} size={40} />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{name}</h1>
              <div className="mt-0.5 font-mono text-sm text-neutral-500">{material}</div>
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm text-neutral-500">Aktueller Verkaufspreis</div>
          <div className="text-4xl font-extrabold text-emerald-400">
            {data?.currentPrice !== null && data?.currentPrice !== undefined
              ? `$${formatMoney(data.currentPrice)}`
              : "–"}
          </div>
        </div>
      </div>

      {/* Laufende Meta – für alle sichtbar */}
      {data?.meta && (
        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: META_COLOR + "40", background: META_COLOR + "12" }}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="rounded-full px-2.5 py-0.5 text-xs font-bold tracking-wide"
              style={{ background: META_COLOR + "26", color: META_COLOR }}
            >
              META
            </span>
            <span className="font-semibold" style={{ color: META_COLOR }}>
              Zielpreis ${formatMoney(data.meta.targetPrice)}
            </span>
            <span className="text-sm text-neutral-400">
              Stärke {Math.round(data.meta.strength * 100)} % ·{" "}
              {META_STATE_TEXT[data.meta.state]} · bis {formatTs(data.meta.endAt)}
            </span>
          </div>
          <p className="mt-1.5 text-xs text-neutral-500">
            Metas heben den Verkaufspreis befristet an. Sie greifen beim nächsten
            Anpassungslauf (00:00 bzw. 12:00), danach geht der Preis genauso schnell
            wieder zurück.
          </p>
        </div>
      )}

      {/* Meta verwalten – nur für Admins */}
      {isAdmin && (
        <MetaEditor
          material={material}
          meta={data?.meta ?? null}
          currentPrice={data?.currentPrice ?? null}
          onChanged={() => load(range)}
        />
      )}

      {/* Einstellungen */}
      {data?.settings && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <InfoCard label="StartWert" value={`$${formatMoney(data.settings.startValue)}`} />
          <InfoCard label="Untergrenze" value={`$${formatMoney(data.settings.minPrice)}`} />
          <InfoCard label="Obergrenze" value={`$${formatMoney(data.settings.maxPrice)}`} />
          <InfoCard label="Trend-Zeitraum" value={`${data.settings.trendDays} Tage`} />
        </div>
      )}

      {/* Zeitraum */}
      <div className="flex gap-2">
        {RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              range === r.key
                ? "bg-sky-500/15 text-sky-300"
                : "border border-white/10 text-neutral-400 hover:bg-white/5"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Kombinierter Preisvergleich-Graph ── */}
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-1 px-2 flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-400">Preisvergleich</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSplitScales((v) => !v)}
              title={
                splitScales
                  ? "Jede Serie hat ihre eigene Skala – die Höhen der Linien sind untereinander NICHT vergleichbar."
                  : "Alle Serien auf einer Skala – Höhen sind direkt vergleichbar, kleine Werte aber ggf. platt."
              }
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                splitScales
                  ? "border-sky-400/40 bg-sky-500/15 text-sky-300"
                  : "border-white/10 text-neutral-400 hover:bg-white/5"
              }`}
            >
              Eigene Skala je Serie
            </button>
            <button
              onClick={() => setShowTurns((v) => !v)}
              title="Markiert die Stellen, an denen der Shoppreis die Richtung wechselt."
              className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                showTurns
                  ? "border-emerald-400/40 bg-emerald-500/15 text-emerald-300"
                  : "border-white/10 text-neutral-400 hover:bg-white/5"
              }`}
            >
              Wendepunkte
            </button>
            <span className="text-xs text-neutral-600">Legende anklicken zum Ein-/Ausblenden</span>
          </div>
        </div>

        {loading ? (
          <div className="flex h-80 items-center justify-center text-neutral-500">Lade…</div>
        ) : !data?.ok || merged.length === 0 ? (
          <div className="flex h-80 items-center justify-center text-neutral-500">
            {data?.error ?? "Keine Daten für diesen Zeitraum."}
          </div>
        ) : (
          <>
            {/* Klickbare Legende */}
            <div className="mb-4 flex flex-wrap gap-3 px-2">
              {SERIES.map((s) => {
                const off = hidden.has(s.key);
                return (
                  <button
                    key={s.key}
                    onClick={() => toggleSeries(s.key)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all border"
                    style={{
                      borderColor: off ? "rgba(255,255,255,0.1)" : s.color + "55",
                      background: off ? "transparent" : s.color + "14",
                      color: off ? "#525252" : s.color,
                      opacity: off ? 0.5 : 1,
                    }}
                  >
                    <span
                      className="inline-block h-2 w-4 rounded-full"
                      style={{ background: off ? "#525252" : s.color }}
                    />
                    {s.label}
                  </button>
                );
              })}
            </div>

            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart
                data={merged}
                margin={{ top: 8, right: splitScales ? 0 : 8, left: splitScales ? 0 : -8, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="grad-price" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#34d399" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid
                  yAxisId={primaryAxisId}
                  stroke="rgba(255,255,255,0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="ts"
                  tickFormatter={formatTs}
                  stroke="#525252"
                  tick={{ fill: "#737373", fontSize: 12 }}
                  minTickGap={60}
                />
                {/* Eine Achse pro Serie (in der Serienfarbe), damit $0,01 neben $500
                    nicht zur flachen Linie wird – oder eine gemeinsame Achse. */}
                {splitScales ? (
                  SERIES.map((s) => (
                    <YAxis
                      key={s.key}
                      yAxisId={s.key}
                      orientation={s.key === "price" ? "left" : "right"}
                      domain={["auto", "auto"]}
                      width={58}
                      stroke={s.color}
                      tick={{ fill: s.color, fontSize: 11 }}
                      tickFormatter={axisTick}
                      hide={hidden.has(s.key) || !hasData[s.key]}
                    />
                  ))
                ) : (
                  <YAxis
                    yAxisId="shared"
                    domain={["auto", "auto"]}
                    stroke="#525252"
                    tick={{ fill: "#737373", fontSize: 12 }}
                    tickFormatter={axisTick}
                  />
                )}
                <Tooltip
                  contentStyle={{
                    background: "#171717",
                    border: "1px solid rgba(255,255,255,0.1)",
                    borderRadius: 12,
                    color: "#ededed",
                  }}
                  labelFormatter={(ts) => formatTs(String(ts))}
                  formatter={(value, key) => {
                    const s = SERIES.find((x) => x.key === key);
                    return [`$${formatMoney(Number(value))}`, s?.label ?? String(key)];
                  }}
                  filterNull
                />
                {/* Meta-Zeiträume als schattiertes Band */}
                {metaBands.map((b) => (
                  <ReferenceArea
                    key={`meta-${b.meta.id}`}
                    yAxisId={primaryAxisId}
                    x1={b.x1}
                    x2={b.x2}
                    fill={META_COLOR}
                    fillOpacity={0.12}
                    stroke={META_COLOR}
                    strokeOpacity={0.35}
                    label={{ value: "Meta", fill: META_COLOR, fontSize: 10, position: "insideTop" }}
                  />
                ))}
                {/* Admin-Änderungsmarker */}
                {visibleChanges.map((c, i) => (
                  <ReferenceLine
                    key={i}
                    yAxisId={primaryAxisId}
                    x={nearestTs(data.history, c.changedAt)}
                    stroke="#f59e0b"
                    strokeDasharray="4 4"
                    label={{ value: "Änderung", fill: "#f59e0b", fontSize: 10, position: "insideTopRight" }}
                  />
                ))}
                {/* Shoppreis als Area */}
                <Area
                  type="monotone"
                  yAxisId={axisIdOf("price")}
                  dataKey="price"
                  stroke="#34d399"
                  strokeWidth={hidden.has("price") ? 0 : 2}
                  fill={hidden.has("price") ? "none" : "url(#grad-price)"}
                  hide={hidden.has("price")}
                  dot={
                    showTurns && !hidden.has("price")
                      ? (props: {
                          cx?: number;
                          cy?: number;
                          index?: number;
                          key?: React.Key | null;
                        }) => {
                          const { cx, cy, index, key } = props;
                          if (
                            cx === undefined ||
                            cy === undefined ||
                            index === undefined ||
                            !turningIdx.has(index)
                          ) {
                            return <g key={key} />;
                          }
                          return (
                            <circle
                              key={key}
                              cx={cx}
                              cy={cy}
                              r={3.5}
                              fill="#0a0a0a"
                              stroke="#34d399"
                              strokeWidth={1.8}
                            />
                          );
                        }
                      : false
                  }
                  legendType="none"
                />
                {/* Ø Auktionshaus */}
                <Line
                  type="monotone"
                  yAxisId={axisIdOf("avgAuction")}
                  dataKey="avgAuction"
                  stroke="#a78bfa"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  hide={hidden.has("avgAuction")}
                  legendType="none"
                />
                {/* Ø Kaufauftrag */}
                <Line
                  type="monotone"
                  yAxisId={axisIdOf("avgOrder")}
                  dataKey="avgOrder"
                  stroke="#fb923c"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  hide={hidden.has("avgOrder")}
                  legendType="none"
                />
              </ComposedChart>
            </ResponsiveContainer>
          </>
        )}
      </div>

      {/* Volumen-Graph (bleibt separat) */}
      {data?.ok && data.history.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
          <h2 className="mb-2 px-2 text-sm font-medium text-neutral-400">
            Verkauftes Volumen pro Lauf
          </h2>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={data.history} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis
                dataKey="ts"
                tickFormatter={formatTs}
                stroke="#525252"
                tick={{ fill: "#737373", fontSize: 12 }}
                minTickGap={60}
              />
              <YAxis
                allowDecimals={false}
                stroke="#525252"
                tick={{ fill: "#737373", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#171717",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 12,
                  color: "#ededed",
                }}
                labelFormatter={(ts) => formatTs(String(ts))}
                formatter={(value) => [String(value), "Verkauft"]}
                cursor={{ fill: "rgba(255,255,255,0.04)" }}
              />
              <Bar dataKey="sold" fill="rgba(52,211,153,0.5)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function nearestTs(history: { ts: string }[], target: string): string {
  let best = history[0]?.ts ?? target;
  for (const h of history) {
    if (h.ts <= target) best = h.ts;
    else break;
  }
  return best;
}

/**
 * Meta setzen und beenden – nur für Admins sichtbar.
 *
 * Geschrieben wird nur die Meta selbst, nie der Preis. Den setzt das
 * Minecraft-Netzwerk beim nächsten Anpassungslauf. Die Grenzen sind dieselben
 * wie ingame bei /dynprice meta.
 */
function MetaEditor({
  material,
  meta,
  currentPrice,
  onChanged,
}: {
  material: string;
  meta: Meta | null;
  currentPrice: number | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState("");
  const [strength, setStrength] = useState("100");
  const [hours, setHours] = useState("48");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Vorbelegung: laufende Meta, sonst doppelter aktueller Preis.
  useEffect(() => {
    if (meta) {
      setTarget(String(meta.targetPrice));
      setStrength(String(Math.round(meta.strength * 100)));
    } else if (currentPrice !== null) {
      setTarget(String(Math.round(currentPrice * 2 * 10000) / 10000));
    }
  }, [meta, currentPrice]);

  async function send(method: "POST" | "DELETE") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/items/${material}/meta`, {
        method,
        headers: method === "POST" ? { "Content-Type": "application/json" } : undefined,
        body:
          method === "POST"
            ? JSON.stringify({
                targetPrice: Number(target.replace(",", ".")),
                strength: Number(strength.replace(",", ".")),
                hours: Number(hours.replace(",", ".")),
              })
            : undefined,
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      setOpen(false);
      onChanged();
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-neutral-300">Meta verwalten</h2>
          <p className="mt-0.5 text-xs text-neutral-500">
            Befristete Preis-Anhebung. Greift beim nächsten Anpassungslauf, nicht sofort.
          </p>
        </div>
        <div className="flex gap-2">
          {meta && (
            <button
              onClick={() => send("DELETE")}
              disabled={busy}
              className="rounded-lg border border-red-400/30 bg-red-500/10 px-3 py-1.5 text-sm font-medium text-red-300 transition-colors hover:bg-red-500/20 disabled:opacity-50"
            >
              Meta beenden
            </button>
          )}
          <button
            onClick={() => setOpen((v) => !v)}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5"
          >
            {open ? "Schließen" : meta ? "Meta ersetzen" : "Meta setzen"}
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <MetaField
              label="Zielpreis ($)"
              value={target}
              onChange={setTarget}
              hint={currentPrice !== null ? `aktuell $${formatMoney(currentPrice)}` : undefined}
            />
            <MetaField
              label="Stärke (%)"
              value={strength}
              onChange={setStrength}
              hint="100 % = voller Sprung beim nächsten Lauf"
            />
            <MetaField
              label="Laufzeit (Stunden)"
              value={hours}
              onChange={setHours}
              hint="danach geht der Preis zurück"
            />
          </div>
          {error && <div className="text-sm text-red-400">{error}</div>}
          <div>
            <button
              onClick={() => send("POST")}
              disabled={busy}
              className="rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-300 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
            >
              {busy ? "Speichert…" : "Meta setzen"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MetaField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-neutral-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="rounded-lg border border-white/10 bg-black/30 px-3 py-1.5 text-sm text-neutral-100 outline-none focus:border-emerald-400/50"
      />
      {hint && <span className="text-[11px] text-neutral-600">{hint}</span>}
    </label>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center">
      <div className="text-lg font-bold">{value}</div>
      <div className="mt-0.5 text-xs text-neutral-500">{label}</div>
    </div>
  );
}

