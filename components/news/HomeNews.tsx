import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { loadPublishedNews } from "@/lib/news";
import NewsCard from "./NewsCard";

/**
 * „Letzte Updates & Infos“ auf der Startseite – die neuesten Beiträge mit
 * Verweis auf die vollständige Liste.
 *
 * Gibt es noch keine Beiträge, rendert die Sektion gar nichts, damit die
 * Startseite keine leere Box zeigt.
 */
export default async function HomeNews({ limit = 4 }: { limit?: number }) {
  const posts = await loadPublishedNews(limit);
  if (posts.length === 0) return null;

  return (
    <section className="border-b border-white/[0.06] py-16">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Aktuelles
          </p>
          <h2 className="mt-2 flex items-center gap-2 text-2xl font-bold">
            <Newspaper className="h-5 w-5 text-sky-400" strokeWidth={1.75} />
            Letzte Updates &amp; Infos
          </h2>
          <p className="mt-2 text-sm text-neutral-600">
            Was sich zuletzt getan hat – auch ingame am Brett in der Lobby zu lesen
          </p>
        </div>

        <Link
          href="/news"
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500/15 px-4 py-2 text-sm font-semibold text-sky-300 ring-1 ring-sky-500/30 transition-colors hover:bg-sky-500/25 hover:text-sky-200"
        >
          Alle anzeigen
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.slice(0, 3).map((post) => (
          <NewsCard key={post.id} post={post} />
        ))}
      </div>
    </section>
  );
}
