"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { NEWS_TYPES, germanDate, type NewsPost } from "@/lib/newsTypes";
import { mcPlainText, shorten } from "@/lib/mcformat";
import NewsCard, { AuthorRow, NewsCover, TopReactions } from "./NewsCard";
import NewsTypeBadge from "./NewsTypeBadge";

const PAGE_SIZE = 9;

/**
 * Beitragsübersicht: Filter nach Art, ein großer Aufmacher und darunter das
 * Kartenraster.
 *
 * Der Aufmacher erscheint nur unter „Alle" – in einer gefilterten Ansicht wäre
 * „der neueste Beitrag" eine ziemlich willkürliche Hervorhebung.
 */
export default function NewsListClient({
  posts,
  coverSrc,
}: {
  posts: NewsPost[];
  /** Nur für Vorschauen: feste Bildquelle statt der Beitragsbilder. */
  coverSrc?: string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(
    () => (active ? posts.filter((p) => p.type === active) : posts),
    [posts, active]
  );

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) map.set(p.type, (map.get(p.type) ?? 0) + 1);
    return map;
  }, [posts]);

  const featured = active === null && page === 0 ? filtered[0] : undefined;
  const rest = featured ? filtered.slice(1) : filtered;

  const pageCount = Math.max(1, Math.ceil(rest.length / PAGE_SIZE));
  // Nach einem Filterwechsel kann die alte Seitenzahl ins Leere zeigen.
  const safePage = Math.min(page, pageCount - 1);
  const shown = rest.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-6">
      {/* ── Filter ── */}
      <div className="flex flex-wrap gap-2">
        <FilterChip active={active === null} onClick={() => { setActive(null); setPage(0); }}>
          Alle
        </FilterChip>
        {NEWS_TYPES.filter((t) => counts.has(t.id)).map((t) => (
          <FilterChip
            key={t.id}
            active={active === t.id}
            color={t.color}
            onClick={() => { setActive(active === t.id ? null : t.id); setPage(0); }}
          >
            {t.label}
          </FilterChip>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-12 text-center text-sm text-neutral-500">
          Hier gibt es noch nichts zu lesen.
        </p>
      ) : (
        <>
          {featured && <FeaturedPost post={featured} coverSrc={coverSrc} />}

          {shown.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((post) => (
                <NewsCard key={post.id} post={post} coverSrc={coverSrc} />
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <span className="text-sm text-neutral-500">
              {filtered.length} {filtered.length === 1 ? "Beitrag" : "Beiträge"}
            </span>
            {pageCount > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {Array.from({ length: pageCount }, (_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPage(i);
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    aria-current={i === safePage ? "page" : undefined}
                    className={`min-w-9 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                      i === safePage
                        ? "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40"
                        : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
                    }`}
                  >
                    {i + 1}
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/** Der neueste Beitrag, groß: Bild links, Text rechts. */
function FeaturedPost({ post, coverSrc }: { post: NewsPost; coverSrc?: string }) {
  const teaser = post.summary || shorten(mcPlainText(post.body), 260);

  return (
    <Link
      href={`/news/${post.id}`}
      className="group grid overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-colors hover:border-white/20 hover:bg-white/[0.04] lg:grid-cols-2"
    >
      <NewsCover
        post={post}
        src={coverSrc}
        priority
        className="aspect-video lg:aspect-auto lg:h-full"
      />

      <div className="flex flex-col p-5 sm:p-7">
        {/* Der Text sitzt mittig neben dem Bild, Verfasser und Knopf ganz unten –
            sonst klebt in der breiten Ansicht alles oben und darunter gähnt eine
            Lücke über die volle Bildhöhe. */}
        <div className="flex flex-1 flex-col justify-center">
          <div className="flex flex-wrap items-center gap-2">
            <NewsTypeBadge type={post.type} />
            <span className="text-xs text-neutral-500">{germanDate(post.createdAt)}</span>
          </div>

          <h2 className="mt-3 text-2xl font-bold leading-tight text-neutral-50 transition-colors group-hover:text-sky-300 sm:text-3xl">
            {post.title}
          </h2>

          {teaser && (
            <p className="mt-3 line-clamp-4 text-sm leading-relaxed text-neutral-400">{teaser}</p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-4">
          <div className="flex min-w-0 items-center gap-3">
            <AuthorRow post={post} />
            <TopReactions post={post} />
          </div>
          <span className="rounded-lg bg-sky-400/15 px-4 py-2 text-sm font-semibold text-sky-300 ring-1 ring-sky-400/30 transition-colors group-hover:bg-sky-400/25">
            Weiterlesen
          </span>
        </div>
      </div>
    </Link>
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
      // Aktive Chips bekommen die Farbe ihrer Art, inaktive das neutrale Raster.
      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
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
