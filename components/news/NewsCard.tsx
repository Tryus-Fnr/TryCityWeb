import Link from "next/link";
import { ImageIcon, Pin } from "lucide-react";
import { germanDate, type NewsPost } from "@/lib/newsTypes";
import { mcPlainText, shorten } from "@/lib/mcformat";
import NewsTypeBadge from "./NewsTypeBadge";
import AuthorAvatar from "./AuthorAvatar";

/** Ein Beitrag in der Übersicht – führt per Klick auf die Detailseite. */
export default function NewsCard({ post }: { post: NewsPost }) {
  const teaser = post.summary || shorten(mcPlainText(post.body), 180);

  return (
    <Link
      href={`/news/${post.id}`}
      className="group flex gap-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 transition-colors hover:border-white/20 hover:bg-white/[0.04] sm:p-5"
    >
      <AuthorAvatar name={post.authorName} className="h-16 w-12 shrink-0 self-start" />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <NewsTypeBadge type={post.type} />
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
          <span className="text-xs text-neutral-600">{germanDate(post.createdAt)}</span>
          {post.imageCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-neutral-600">
              <ImageIcon className="h-3 w-3" />
              {post.imageCount}
            </span>
          )}
        </div>

        <h3 className="mt-1.5 truncate text-base font-semibold text-neutral-100 transition-colors group-hover:text-sky-300">
          {post.title}
        </h3>

        {teaser && (
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-neutral-500">{teaser}</p>
        )}

        <p className="mt-2 text-xs text-neutral-600">von {post.authorName}</p>
      </div>
    </Link>
  );
}
