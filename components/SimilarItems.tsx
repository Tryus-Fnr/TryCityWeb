import Link from "next/link";
import ItemIcon from "@/components/ItemIcon";
import PriceCandles from "@/components/PriceCandles";
import { formatCount, formatMoney, formatPct } from "@/lib/format";
import { germanName } from "@/lib/itemNames.server";
import type { SimilarItem, SparklinePoint } from "@/lib/queries";

/** Kurze Begründung, warum das Item vorgeschlagen wird. */
const REASON_LABEL: Record<SimilarItem["reason"], string> = {
  family: "Verwandt",
  price: "Ähnlicher Preis",
  sold: "Ähnlich oft verkauft",
  change: "Ähnliche Änderung",
};

/**
 * „Ähnliche Items" unter der Werte-Seite – derselbe Aufbau wie
 * „Weitere Beiträge" im Blog.
 *
 * Serverseitig gerendert: die deutschen Namen kommen aus der Sprachdatei, die
 * bewusst nicht im Browser landet.
 */
export default function SimilarItems({
  items,
  sparklines = {},
}: {
  items: SimilarItem[];
  sparklines?: Record<string, SparklinePoint[]>;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-6 border-t border-white/[0.06] pt-8">
      <h2 className="mb-5 text-xl font-bold">Ähnliche Items</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const change = it.changePercent;
          return (
            <Link
              key={it.material}
              href={`/items/${it.material.toLowerCase()}`}
              className="group flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-4 transition-colors hover:border-sky-400/40 hover:bg-sky-400/5"
            >
              <div className="flex items-center gap-2.5">
                <ItemIcon material={it.material} size={28} className="shrink-0" />
                <div className="min-w-0 flex-1 truncate text-sm font-semibold group-hover:text-sky-300">
                  {germanName(it.material)}
                </div>
              </div>

              {(sparklines[it.material]?.length ?? 0) > 1 && (
                <PriceCandles points={sparklines[it.material]} className="mt-3" />
              )}

              <div className="mt-3 text-lg font-bold text-emerald-400">
                ${formatMoney(it.price)}
              </div>

              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-xs">
                {change !== null && Math.abs(change) >= 0.05 ? (
                  <span className={change > 0 ? "text-emerald-400" : "text-red-400"}>
                    {formatPct(change)}
                    {it.changeAbsolute !== null && (
                      <span className="text-neutral-500">
                        {" "}
                        ({it.changeAbsolute > 0 ? "+" : "−"}$
                        {formatMoney(Math.abs(it.changeAbsolute))})
                      </span>
                    )}{" "}
                    <span className="text-neutral-600">12h</span>
                  </span>
                ) : (
                  <span className="text-neutral-600">± 0 % 12h</span>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-white/[0.06] pt-2.5 text-[11px]">
                <span className="rounded-md bg-white/[0.06] px-2 py-0.5 text-neutral-400">
                  {REASON_LABEL[it.reason]}
                </span>
                <span className="text-neutral-600">
                  {formatCount(it.sold48h)} verkauft 48h
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
