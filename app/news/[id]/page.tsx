import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Pin } from "lucide-react";
import { getAdminStatus } from "@/lib/auth";
import { germanDate, loadNewsImages, loadNewsPost } from "@/lib/news";
import { mcPlainText, shorten } from "@/lib/mcformat";
import McText from "@/components/news/McText";
import NewsTypeBadge from "@/components/news/NewsTypeBadge";
import AuthorAvatar from "@/components/news/AuthorAvatar";

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

  return (
    <article className="flex flex-col gap-6">
      <Link
        href="/news"
        className="inline-flex w-fit items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Alle Neuigkeiten
      </Link>

      <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
        {/* ── Autor: Skin-Render wie bei einem Minecraft-Foren-Beitrag ── */}
        <aside className="flex shrink-0 flex-row items-center gap-4 sm:w-40 sm:flex-col sm:items-center sm:gap-3">
          <AuthorAvatar name={post.authorName} className="h-32 w-24 sm:h-52 sm:w-36" />
          <div className="text-left sm:text-center">
            <p className="text-sm font-semibold text-neutral-100">{post.authorName}</p>
            <p className="mt-0.5 text-xs text-neutral-600">Autor</p>
          </div>
        </aside>

        {/* ── Beitrag ── */}
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
            {isAdmin && (
              <Link
                href={`/admin/news/${post.id}`}
                className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
              >
                <Pencil className="h-3 w-3" />
                Bearbeiten
              </Link>
            )}
          </div>

          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{post.title}</h1>

          {post.summary && (
            <p className="mt-3 border-l-2 border-white/10 pl-4 text-sm italic leading-relaxed text-neutral-400">
              {post.summary}
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-6">
            <McText text={post.body} images={images} className="text-[15px] text-neutral-200" />
          </div>

          {post.updatedAt && post.updatedAt !== post.createdAt && (
            <p className="mt-4 text-xs text-neutral-600">
              Zuletzt bearbeitet am {germanDate(post.updatedAt)}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
