"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatCount, formatMaterialName, formatMoney, formatPct } from "@/lib/format";
import { buildHaystack, matchesHaystack } from "@/lib/itemNames";
import { Search, X } from "lucide-react";
import ItemIcon from "@/components/ItemIcon";
import PriceCandles from "@/components/PriceCandles";

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
      {/* Werkzeugleiste – Suche und Sortierung in einem eigenen Feld, damit sie
          sich klar vom Kartenraster absetzen und beim Umbrechen nicht mit der
          Anzahl in eine Zeile geraten. */}
      <div className="flex flex-col gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder="Item suchen – deutsch oder englisch"
              aria-label="Item suchen"
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] py-2.5 pl-10 pr-9 text-sm outline-none placeholder:text-neutral-600 focus:border-sky-400/50"
            />
            {search && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setPage(0);
                }}
                aria-label="Suche zurücksetzen"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {items && (
            <span className="whitespace-nowrap text-sm text-neutral-500 sm:ml-auto">
              <span className="font-semibold text-neutral-300">
                {formatCount(filtered.length)}
              </span>{" "}
              {filtered.length === 1 ? "Item" : "Items"}
              {search && (
                <span className="text-neutral-600"> von {formatCount(items.length)}</span>
              )}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-3">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
            Sortieren
          </span>
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => {
                setSort(s.key);
                setPage(0);
              }}
              aria-pressed={sort === s.key}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                sort === s.key
                  ? "bg-sky-500/15 text-sky-300 ring-1 ring-sky-400/40"
                  : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5 hover:text-neutral-200"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
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
        filtered.length === 0 ? (
          // Ohne eigenen Leerzustand blieb hier nur eine leere Fläche mit
          // darüber hängender Legende stehen.
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-12 text-center">
            <p className="text-neutral-300">
              Kein Item passt zu „<span className="font-medium">{search}</span>&ldquo;.
            </p>
            <p className="mt-1.5 text-sm text-neutral-500">
              Es geht der deutsche wie der englische Name – auch nur ein Teil davon.
            </p>
            <button
              onClick={() => {
                setSearch("");
                setPage(0);
              }}
              className="mt-5 rounded-lg bg-white/5 px-4 py-2 text-sm font-medium text-neutral-300 ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-white"
            >
              Suche zurücksetzen
            </button>
          </div>
        ) : (
        <>
          {/* Legende: erklärt die Kerzen einmal für das ganze Raster, statt auf
              jeder Karte „7 Tage" zu wiederholen. */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[11px] text-neutral-600">
            <span>Kerzen = Preis je Tag, letzte 7 Tage</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2 rounded-[1px] bg-emerald-400" />
              gestiegen
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2.5 w-2 rounded-[1px] bg-red-400" />
              gefallen
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-0.5 w-2 rounded-[1px] bg-neutral-500" />
              unverändert
            </span>
          </div>

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
                  className="group flex flex-col rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-sky-400/40 hover:bg-sky-400/[0.04]"
                >
                  <div className="flex items-center gap-2.5">
                    <ItemIcon material={item.material} size={28} className="shrink-0" />
                    <div
                      className="truncate text-sm font-semibold text-neutral-200 group-hover:text-sky-300"
                      title={formatMaterialName(item.material)}
                    >
                      {item.de || formatMaterialName(item.material)}
                    </div>
                  </div>

                  {spark.length > 1 && (
                    <PriceCandles points={spark} className="mt-3" label="" />
                  )}

                  {/* Preis und Änderung auf einer Grundlinie: der Preis ist die
                      Hauptzahl, die Änderung ihre Einordnung – untereinander
                      lasen sie sich wie zwei gleichrangige Angaben. */}
                  <div className="mt-3 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="text-lg font-bold text-emerald-400">
                      ${formatMoney(item.price)}
                    </span>
                    {change !== null && Math.abs(change) >= 0.05 ? (
                      <span
                        className={`text-xs font-medium ${
                          change > 0 ? "text-emerald-400" : "text-red-400"
                        }`}
                      >
                        {formatPct(change)}
                        {/* Der Betrag nur, wenn er auf zwei Stellen überhaupt
                            sichtbar ist – bei Erde oder Netherstein stand sonst
                            überall ein nichtssagendes „(+$0,00)". */}
                        {changeAbs !== null && Math.abs(changeAbs) >= 0.005 && (
                          <span className="font-normal text-neutral-500">
                            {" "}
                            ({changeAbs > 0 ? "+" : "−"}${formatMoney(Math.abs(changeAbs))})
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-neutral-600">± 0 %</span>
                    )}
                    {/* Die Änderung vergleicht mit dem vorherigen Lauf – also
                        12 h. Ohne den Zusatz wäre sie mit dem Verkaufsfenster
                        in der Fusszeile zu verwechseln, das 48 h umfasst. */}
                    <span className="text-[10px] text-neutral-600">12 h</span>
                  </div>

                  {/* Fusszeile: Umsatz im 48-Stunden-Fenster, so wie ihn auch
                      die Sortierung „Meist verkauft 48h" benutzt. mt-auto hält
                      sie bei unterschiedlich langen Namen auf gleicher Höhe. */}
                  <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px]">
                    <span className="text-neutral-600">Verkauft 48 h</span>
                    <span
                      className={
                        sort === "sold48h" ? "font-medium text-sky-300" : "text-neutral-500"
                      }
                    >
                      {formatCount(sold48h[item.material] ?? 0)}
                    </span>
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
        )
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

