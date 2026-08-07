import Link from "next/link";
import { Pin } from "lucide-react";
import { authorLine, germanDate, type NewsPost } from "@/lib/newsTypes";
import { mcPlainText, shorten } from "@/lib/mcformat";
import NewsTypeBadge from "./NewsTypeBadge";
import AuthorAvatar from "./AuthorAvatar";

/**
 * Ein Beitrag als Karte: Bild oben, darunter Art, Datum, Titel, Anriss und die
 * Verfasser. Wird im Raster der Übersicht und unter „Weitere Beiträge"
 * verwendet.
 */
export default function NewsCard({ post, coverSrc }: { post: NewsPost; coverSrc?: string }) {
  const teaser = post.summary || shorten(mcPlainText(post.body), 140);

  return (
    <Link
      href={`/news/${post.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.02] transition-colors hover:border-white/20 hover:bg-white/[0.04]"
    >
      <NewsCover post={post} src={coverSrc} className="aspect-video" />

      <div className="flex min-w-0 flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-2">
          <NewsTypeBadge type={post.type} />
          <span className="text-xs text-neutral-500">{germanDate(post.createdAt)}</span>
          {post.pinned && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-400">
              <Pin className="h-3 w-3" />
              Angepinnt
            </span>
          )}
          {!post.published && (
            <span className="rounded-md bg-neutral-700/40 px-2 py-0.5 text-[11px] font-semibold text-neutral-400">
              Entwurf
            </span>
          )}
        </div>

        <h3 className="mt-2 line-clamp-2 text-lg font-bold leading-snug text-neutral-100 transition-colors group-hover:text-sky-300">
          {post.title}
        </h3>

        {teaser && (
          <p className="mt-1.5 line-clamp-3 text-sm leading-relaxed text-neutral-500">{teaser}</p>
        )}

        <AuthorRow post={post} className="mt-4 pt-3" />
      </div>
    </Link>
  );
}

/**
 * Vorschaubild eines Beitrags. Hat er keines, kommt ein ruhiger Platzhalter in
 * der Farbe seiner Art – sonst würden Karten mit und ohne Bild
 * unterschiedlich hoch.
 */
export function NewsCover({
  post,
  className = "",
  priority = false,
  src,
}: {
  post: NewsPost;
  className?: string;
  priority?: boolean;
  /** Abweichende Bildquelle; sonst das erste Bild des Beitrags. */
  src?: string;
}) {
  const url = src ?? (post.coverId !== null ? `/api/news/image/${post.coverId}` : null);
  if (url === null) {
    return (
      <div
        className={`w-full border-b border-white/[0.06] bg-gradient-to-br from-white/[0.05] to-transparent ${className}`}
        aria-hidden
      />
    );
  }
  return (
    <div className={`w-full overflow-hidden border-b border-white/[0.06] bg-black/30 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt=""
        loading={priority ? "eager" : "lazy"}
        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
      />
    </div>
  );
}

/** Kleine Köpfe plus Namen aller Verfasser. */
export function AuthorRow({
  post,
  className = "",
}: {
  post: NewsPost;
  className?: string;
}) {
  const authors = post.authors.length > 0 ? post.authors : [{ name: post.authorName, uuid: null }];
  return (
    <div className={`mt-auto flex items-center gap-2 border-t border-white/[0.06] ${className}`}>
      <div className="flex -space-x-1.5">
        {authors.slice(0, 4).map((a) => (
          <AuthorAvatar
            key={a.name}
            name={a.name}
            className="h-6 w-5 shrink-0 rounded-sm bg-white/5"
          />
        ))}
      </div>
      <span className="truncate text-xs text-neutral-500">
        {authorLine(authors, post.authorName)}
      </span>
    </div>
  );
}
