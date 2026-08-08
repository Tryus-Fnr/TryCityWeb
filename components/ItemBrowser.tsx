"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCount, formatMaterialName, formatMoney, formatPct } from "@/lib/format";
import { buildHaystack, matchesHaystack } from "@/lib/itemNames";
import ItemIcon from "@/components/ItemIcon";

type Item = {
  material: string;
  price: number;
  startValue: number | null;
  minPrice: number | null;
  maxPrice: number | null;
  /** Preis beim vorherigen Anpassungslauf */
  previous: number | null;
  /** Deutscher Item-Name, kommt aus der Schnittstelle mit */
  de?: string | null;
};

/** Ein Anpassungslauf: Zeitpunkt und Preis. Spiegelt lib/queries.ts. */
type SparklinePoint = { ts: string; price: number };

const SORTS = [
  { key: "price-desc", label: "Höchster Preis" },
  { key: "price-asc", label: "Niedrigster Preis" },
  // Zwei Blickwinkel auf dieselbe Bewegung: prozentual bringt günstige Items
  // nach oben (ein Cent auf drei sind 33 %), in Dollar die teuren.
  { key: "change-pct", label: "Größte Änderung in %" },
  { key: "change-abs", label: "Größte Änderung in $" },
  { key: "sold48h", label: "Meist verkauft 48h" },
  { key: "name", label: "Name A–Z" },
] as const;

const PAGE_SIZE = 50;

/** Angezeigter Name: deutsch, wenn vorhanden – sonst der englische aus dem Material. */
const nameOf = (i: Item) => i.de || formatMaterialName(i.material);

export default function ItemBrowser() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<string>("price-desc");
  const [sparklines, setSparklines] = useState<Record<string, SparklinePoint[]>>({});
  const [sold48h, setSold48h] = useState<Record<string, number>>({});
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/items")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) setItems(d.items);
        else setError(d.error ?? "Fehler beim Laden.");
      })
      .catch(() => setError("Fehler beim Laden."));

    fetch("/api/items/sparklines")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSparklines(d.sparklines); })
      .catch(() => {/* silent */});

    fetch("/api/items/sold48h")
      .then((r) => r.json())
      .then((d) => { if (d.ok) setSold48h(d.sold48h); })
      .catch(() => {/* silent */});
  }, []);

  // Suchtext je Item einmal vorbereiten, nicht bei jedem Tastendruck neu.
  const haystacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of items ?? []) map.set(i.material, buildHaystack(i.material, i.de));
    return map;
  }, [items]);

  const filtered = useMemo(() => {
    if (!items) return [];
    // Deutsch und Englisch gleichzeitig, genau wie im Spiel: "Eichenholzbretter",
    // "oak planks" und "holz eichen" führen alle zum selben Item.
    let list = items.filter((i) =>
      matchesHaystack(haystacks.get(i.material) ?? i.material.toLowerCase(), search)
    );
    // Beide nach dem BETRAG der Änderung: ein starker Rückgang ist genauso
    // interessant wie ein starker Anstieg.
    const changePct = (i: Item) =>
      i.previous && i.previous > 0 ? Math.abs((i.price - i.previous) / i.previous) : 0;
    const changeAbs = (i: Item) =>
      i.previous && i.previous > 0 ? Math.abs(i.price - i.previous) : 0;
    list = [...list];
    switch (sort) {
      case "price-desc": list.sort((a, b) => b.price - a.price); break;
      case "price-asc":  list.sort((a, b) => a.price - b.price); break;
      case "change-pct": list.sort((a, b) =>
                           (changePct(b) - changePct(a)) ||
                           nameOf(a).localeCompare(nameOf(b), "de")
                         ); break;
      case "change-abs": list.sort((a, b) =>
                           (changeAbs(b) - changeAbs(a)) ||
                           nameOf(a).localeCompare(nameOf(b), "de")
                         ); break;
      case "name":       list.sort((a, b) => nameOf(a).localeCompare(nameOf(b), "de")); break;
      // Bei gleicher Stückzahl (z.B. beide 0) nach Namen – sonst springt die
      // Reihenfolge bei jedem Neuladen, weil sort() dort nichts festlegt.
      case "sold48h":    list.sort((a, b) =>
                           ((sold48h[b.material] ?? 0) - (sold48h[a.material] ?? 0)) ||
                           nameOf(a).localeCompare(nameOf(b), "de")
                         ); break;
    }
    return list;
  }, [items, search, sort, sold48h, haystacks]);

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE);
  // Auf Seite eins zurück setzen Suche und Sortierung direkt im Klick; hier wird
  // nur abgefangen, dass eine gefilterte Liste kürzer ist als die alte Seitenzahl.
  const safePage = Math.min(page, Math.max(0, pageCount - 1));
  const paged = filtered.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-4">
      {/* Suche + Sortierung */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(0); }}
          placeholder="Item suchen (deutsch oder englisch)…"
          className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-400/50 sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-2">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => { setSort(s.key); setPage(0); }}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                sort === s.key
                  ? "bg-sky-500/15 text-sky-300"
                  : "border border-white/10 text-neutral-400 hover:bg-white/5"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {items && (
          <span className="text-sm text-neutral-500 sm:ml-auto">{filtered.length} Items</span>
        )}
      </div>

      {/* Grid */}
      {error ? (
        <div className="rounded-2xl border border-white/10 p-12 text-center text-neutral-500">
          {error}
        </div>
      ) : !items ? (
        <div className="rounded-2xl border border-white/10 p-12 text-center text-neutral-500">
          Lade…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {paged.map((item) => {
              const change =
                item.previous && item.previous > 0
                  ? ((item.price - item.previous) / item.previous) * 100
                  : null;
              // Auch als Betrag, damit die Sortierung „in $" sichtbar wird.
              const changeAbs =
                item.previous && item.previous > 0 ? item.price - item.previous : null;
              const spark = sparklines[item.material] ?? [];
              return (
                <Link
                  key={item.material}
                  href={`/items/${item.material.toLowerCase()}`}
                  className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-sky-400/40 hover:bg-sky-400/5"
                >
                  <div className="flex items-center gap-2.5">
                    <ItemIcon material={item.material} size={28} className="shrink-0" />
                    <div
                      className="truncate text-sm font-semibold group-hover:text-sky-300"
                      title={formatMaterialName(item.material)}
                    >
                      {item.de || formatMaterialName(item.material)}
                    </div>
                  </div>
                  {spark.length > 1 && <MiniSparkline points={spark} className="mt-3" />}
                  <div className="mt-2 text-lg font-bold text-emerald-400">
                    ${formatMoney(item.price)}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs">
                    {change !== null && Math.abs(change) >= 0.05 ? (
                      <span className={change > 0 ? "text-emerald-400" : "text-red-400"}>
                        {formatPct(change)}
                        {changeAbs !== null && (
                          <span className="text-neutral-500">
                            {" "}
                            ({changeAbs > 0 ? "+" : "−"}${formatMoney(Math.abs(changeAbs))})
                          </span>
                        )}{" "}
                        <span className="text-neutral-600">12h</span>
                      </span>
                    ) : (
                      <span className="text-neutral-600">± 0 % 12h</span>
                    )}
                    {/* Bei "Meist verkauft" die Zahl zeigen, nach der sortiert wird –
                        eine Rangliste ohne den Wert dahinter ist nicht nachvollziehbar. */}
                    {sort === "sold48h" ? (
                      <span className="text-sky-300">
                        {formatCount(sold48h[item.material] ?? 0)}
                        <span className="text-neutral-600"> verkauft</span>
                      </span>
                    ) : (
                      <span className="text-neutral-600">Verlauf →</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Pagination */}
          {pageCount > 1 && (
            <Pagination page={safePage} pageCount={pageCount} total={filtered.length} onPage={setPage} />
          )}
        </>
      )}
    </div>
  );
}

/** Pagination bar */
function Pagination({
  page, pageCount, total, onPage,
}: {
  page: number; pageCount: number; total: number; onPage: (p: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <span className="text-sm text-neutral-500">
        Seite {page + 1} / {pageCount}
        <span className="ml-2 text-neutral-600">({total} gesamt)</span>
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => { onPage(0); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page === 0}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default"
        >«</button>
        <button
          onClick={() => { onPage(page - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page === 0}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default"
        >Zurück</button>
        <button
          onClick={() => { onPage(page + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page >= pageCount - 1}
          className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default"
        >Weiter</button>
        <button
          onClick={() => { onPage(pageCount - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          disabled={page >= pageCount - 1}
          className="rounded-lg border border-white/10 px-2.5 py-1.5 text-sm text-neutral-400 transition-colors hover:bg-white/5 disabled:opacity-30 disabled:cursor-default"
        >»</button>
      </div>
    </div>
  );
}

const SPARK_UP = "#34d399";
const SPARK_DOWN = "#f87171";

/** Eine Tageskerze: Eröffnung, Hoch, Tief, Schluss. */
type Candle = { day: string; open: number; high: number; low: number; close: number };

/**
 * Fasst die einzelnen Anpassungsläufe zu Tageskerzen zusammen.
 *
 * Eröffnung ist der Preis des ersten Laufs des Tages, Schluss der des letzten;
 * Hoch und Tief die Spannweite dazwischen. Bei den üblichen zwei Läufen pro Tag
 * fallen Docht und Körper zusammen – wurde an einem Tag zusätzlich von Hand
 * angepasst, entstehen sichtbare Dochte.
 */
function toCandles(points: SparklinePoint[]): Candle[] {
  const byDay = new Map<string, number[]>();
  for (const p of points) {
    const day = p.ts.slice(0, 10);
    const list = byDay.get(day);
    if (list) list.push(p.price);
    else byDay.set(day, [p.price]);
  }
  const all = [...byDay.entries()].map(([day, prices]) => ({
    day,
    open: prices[0],
    close: prices[prices.length - 1],
    high: Math.max(...prices),
    low: Math.min(...prices),
  }));
  // 14 Läufe verteilen sich über 8 Kalendertage, weil der älteste angebrochen
  // ist. Der wird abgeschnitten – sonst stünden acht Kerzen unter „7 Tage".
  return all.slice(-7);
}

/**
 * Kerzenchart des Preisverlaufs der letzten 7 Tage.
 *
 * Grün, wenn der Tag höher geschlossen hat als er eröffnet wurde, sonst rot.
 * Die frühere Linie war durchgehend einfarbig nach „erster gegen letzter Punkt"
 * über 14 Tage – daneben stand aber die Änderung der letzten 12 Stunden, und
 * beides konnte einander widersprechen. Kerzen zeigen jeden Tag für sich.
 */
function MiniSparkline({
  points,
  className = "",
}: {
  points: SparklinePoint[];
  className?: string;
}) {
  const candles = toCandles(points);
  if (candles.length === 0) return null;

  const W = 160;
  const H = 36;
  const PAD = 2;

  const min = Math.min(...candles.map((c) => c.low));
  const max = Math.max(...candles.map((c) => c.high));
  const range = max - min || 1;
  const y = (v: number) => H - PAD - ((v - min) / range) * (H - 2 * PAD);

  // Feste Breite je Tag, damit die Kerzen bei wenigen Tagen nicht auseinander-
  // gezogen werden – ein Tag mit Lücke soll auch als Lücke sichtbar bleiben.
  const slot = W / Math.max(candles.length, 7);
  const bodyW = Math.max(3, slot * 0.6);

  return (
    <div className={`relative ${className}`}>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ height: H }}
        role="img"
        aria-label="Preisverlauf der letzten 7 Tage als Tageskerzen"
      >
        {candles.map((c, i) => {
          const cx = i * slot + slot / 2;
          const up = c.close >= c.open;
          const color = up ? SPARK_UP : SPARK_DOWN;
          const yOpen = y(c.open);
          const yClose = y(c.close);
          const top = Math.min(yOpen, yClose);
          // Mindesthöhe, damit ein unveränderter Tag nicht unsichtbar wird.
          const height = Math.max(1, Math.abs(yClose - yOpen));
          return (
            <g key={c.day}>
              <line
                x1={cx}
                x2={cx}
                y1={y(c.high)}
                y2={y(c.low)}
                stroke={color}
                strokeWidth="1"
                opacity={0.8}
              />
              <rect
                x={cx - bodyW / 2}
                y={top}
                width={bodyW}
                height={height}
                fill={color}
                rx={0.5}
              />
            </g>
          );
        })}
      </svg>
      {/* Ohne Beschriftung war nicht erkennbar, welcher Zeitraum gemeint ist. */}
      <span className="pointer-events-none absolute right-0 top-0 text-[9px] leading-none text-neutral-600">
        7 Tage
      </span>
    </div>
  );
}
