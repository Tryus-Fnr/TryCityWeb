import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Pencil, Pin, Users } from "lucide-react";
import { getAdminStatus } from "@/lib/auth";
import {
  germanDate,
  loadNewsImages,
  loadNewsPost,
  loadPublishedNews,
  type NewsImage,
} from "@/lib/news";
import { mcPlainText, shorten } from "@/lib/mcformat";
import McText from "@/components/news/McText";
import NewsTypeBadge from "@/components/news/NewsTypeBadge";
import AuthorAvatar from "@/components/news/AuthorAvatar";
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

  // Das erste Bild steht zusätzlich als Aufmacher oben. Im Text bleibt es
  // trotzdem an seiner Stelle stehen – dort gehört es zu einem Absatz und wäre
  // sonst aus dem Zusammenhang gerissen.
  const cover: NewsImage | undefined = images[0];

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

      {/* ── Aufmacherbild ──
          Bewusst nur das Bild: keine Rundung, kein Rahmen, keine Unterschrift.
          Dasselbe Bild steht weiter unten im Text nochmal, dort mit Beschreibung. */}
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/news/image/${cover.id}`}
          alt={post.title}
          className="max-h-[60vh] w-full object-cover"
        />
      )}

      {/* ── Kopf ── */}
      <header className="flex flex-col items-center gap-4 text-center">
        <div className="flex flex-wrap items-center justify-center gap-2">
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
        </div>

        <h1 className="max-w-3xl text-3xl font-bold leading-tight tracking-tight text-balance sm:text-4xl">
          {post.title}
        </h1>

        {/* Kopfdaten als abgesetzte Felder – Datum und Verfasser auf einen Blick. */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-sm text-neutral-400">
            <CalendarDays className="h-4 w-4 text-neutral-600" />
            Veröffentlicht: <span className="text-neutral-200">{germanDate(post.createdAt)}</span>
          </span>
          <span className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2 text-sm text-neutral-400">
            <Users className="h-4 w-4 text-neutral-600" />
            {authors.length === 1 ? "Geschrieben von:" : "Geschrieben von:"}
            {authors.map((a) => (
              <span key={a.name} className="inline-flex items-center gap-1.5 text-neutral-200">
                <AuthorAvatar name={a.name} className="h-6 w-5 rounded-sm bg-white/5" />
                {a.name}
              </span>
            ))}
          </span>
        </div>

        {post.summary && (
          <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-400">{post.summary}</p>
        )}
      </header>

      {/* ── Beitrag ── */}
      <div className="mx-auto w-full max-w-3xl">
        <McText
          text={post.body}
          images={images}
          headings={post.markdown}
          className="text-[15px] text-neutral-300"
        />

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
      </div>

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
