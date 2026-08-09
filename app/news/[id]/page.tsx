import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { getAdminStatus } from "@/lib/auth";
import { germanDate, loadNewsImages, loadNewsPost, loadPublishedNews } from "@/lib/news";
import { mcPlainText, shorten } from "@/lib/mcformat";
import NewsArticleView from "@/components/news/NewsArticleView";
import NewsCard from "@/components/news/NewsCard";
import ReactionBar from "@/components/news/ReactionBar";
import { SetBreadcrumb } from "@/components/Breadcrumbs";
import { getSession } from "@/lib/session";
import { loadPostReactions } from "@/lib/news";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await loadNewsPost(Number((await params).id));
  if (!post) return { title: "Beitrag – TryCity" };
  return {
    title: `${post.title} – TryCity`,
    description: post.summary || shorten(mcPlainText(post.body), 160),
  };
}

export default async function NewsDetailPage({ params }: Props) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const isAdmin = await getAdminStatus();
  // Entwürfe darf nur der Admin-Bereich sehen.
  const post = await loadNewsPost(id, isAdmin);
  if (!post) notFound();

  const images = await loadNewsImages(id);
  const authors = post.authors.length > 0 ? post.authors : [{ name: post.authorName, uuid: null }];

  const more = (await loadPublishedNews(4)).filter((p) => p.id !== post.id).slice(0, 3);

  // Reaktionen samt eigener – reagieren geht nur angemeldet.
  const sessionUuid = (await getSession())?.uuid ?? null;
  const reactions = await loadPostReactions(post.id, sessionUuid);

  return (
    <article className="flex flex-col gap-8">
      <SetBreadcrumb label={post.title} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/news"
          className="inline-flex w-fit items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zum Blog
        </Link>
        {isAdmin && (
          <Link
            href={`/admin/news/${post.id}`}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
          >
            <Pencil className="h-3 w-3" />
            Bearbeiten
          </Link>
        )}
      </div>

      {/* Aufmacherbild, Kopf und Text – dieselbe Darstellung wie in der
          Vorschau des Editors. */}
      <NewsArticleView
        post={{ ...post, authors }}
        images={images}
        coverSrc={(img) => `/api/news/image/${img.id}`}
      >
        {post.updatedAt && post.updatedAt !== post.createdAt && (
          <p className="mt-8 text-xs text-neutral-600">
            Zuletzt bearbeitet am {germanDate(post.updatedAt)}
          </p>
        )}

        <ReactionBar
          postId={post.id}
          initialCounts={reactions.counts}
          initialOwn={reactions.own}
          loggedIn={sessionUuid !== null}
        />
      </NewsArticleView>

      {/* ── Weitere Beiträge ── */}
      {more.length > 0 && (
        <section className="mt-6 border-t border-white/[0.06] pt-8">
          <h2 className="mb-5 text-xl font-bold">Weitere Beiträge</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {more.map((p) => (
              <NewsCard key={p.id} post={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
