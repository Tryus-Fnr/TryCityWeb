"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { NEWS_TYPES, type NewsPost } from "@/lib/newsTypes";
import NewsCard from "./NewsCard";

const BATCH = 12;

/**
 * Vollständige Beitragsliste mit Typ-Filter und Nachladen beim Scrollen.
 *
 * Die Beiträge kommen komplett vom Server; hier wird nur gefiltert und
 * portionsweise gerendert, damit die Seite auch bei vielen Einträgen flüssig
 * bleibt.
 */
export default function NewsListClient({ posts }: { posts: NewsPost[] }) {
  const [active, setActive] = useState<string | null>(null);
  const [shown, setShown] = useState(BATCH);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(
    () => (active ? posts.filter((p) => p.type === active) : posts),
    [posts, active]
  );

  /** Filterwechsel beginnt wieder oben. */
  const selectType = (id: string | null) => {
    setActive(id);
    setShown(BATCH);
  };

  // Nachladen, sobald das Ende der Liste in Sicht kommt.
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setShown((n) => (n >= filtered.length ? n : n + BATCH));
        }
      },
      { rootMargin: "400px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [filtered.length]);

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) map.set(p.type, (map.get(p.type) ?? 0) + 1);
    return map;
  }, [posts]);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filter ── */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={active === null} onClick={() => selectType(null)}>
          Alle ({posts.length})
        </FilterChip>
        {NEWS_TYPES.filter((t) => counts.has(t.id)).map((t) => (
          <FilterChip
            key={t.id}
            active={active === t.id}
            color={t.color}
            onClick={() => selectType(active === t.id ? null : t.id)}
          >
            {t.label} ({counts.get(t.id)})
          </FilterChip>
        ))}
      </div>

      {/* ── Beiträge ── */}
      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-10 text-center text-sm text-neutral-500">
          Hier gibt es noch nichts zu lesen.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.slice(0, shown).map((post) => (
            <NewsCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <div ref={sentinelRef} className="h-px" />

      {shown < filtered.length && (
        <button
          type="button"
          onClick={() => setShown((n) => n + BATCH)}
          className="mx-auto rounded-xl border border-white/10 px-5 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-white/5"
        >
          Mehr laden ({filtered.length - shown} weitere)
        </button>
      )}
    </div>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      // Aktive Chips bekommen die Farbe ihres Typs, inaktive das neutrale Raster.
      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
        active ? "" : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
      }`}
      style={
        active
          ? {
              color: color ?? "#7DD3FC",
              backgroundColor: `${color ?? "#38BDF8"}1F`,
              boxShadow: `inset 0 0 0 1px ${color ?? "#38BDF8"}55`,
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
