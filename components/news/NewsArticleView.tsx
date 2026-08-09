import { CalendarDays, Pin, Users } from "lucide-react";
import { leadingImageIndex, stripLeadingImage } from "@/lib/mcformat";
import { germanDate, type NewsAuthor, type NewsImage, type NewsPost } from "@/lib/newsTypes";
import McText from "./McText";
import NewsTypeBadge from "./NewsTypeBadge";
import AuthorAvatar from "./AuthorAvatar";

/**
 * Ein Beitrag so, wie ihn der Leser sieht: Aufmacherbild, Kopf und Text.
 *
 * Bewusst eine eigene Komponente, weil die Vorschau im Editor genauso aussehen
 * soll wie die fertige Seite. Alles, was nur zur echten Seite gehört
 * (Reaktionen, „zuletzt bearbeitet“, weitere Beiträge), kommt über `children`
 * dazu und landet unter dem Text in derselben Spalte.
 */

/** Die Felder, die zum Anzeigen eines Beitrags nötig sind. */
export type ArticleData = Pick<
  NewsPost,
  "type" | "title" | "summary" | "body" | "markdown" | "pinned" | "published" | "createdAt"
> & { authors: NewsAuthor[] };

export default function NewsArticleView({
  post,
  images,
  coverSrc = dataUrl,
  children,
}: {
  post: ArticleData;
  images: NewsImage[];
  /**
   * Quelle des Aufmacherbilds. Auf der Seite kommt es über /api/news/image/<id>,
   * im Editor gibt es noch keine id – dort bleibt es bei der Data-URL.
   */
  coverSrc?: (img: NewsImage) => string;
  children?: React.ReactNode;
}) {
  // Beginnt der Text mit einem Bild, ist genau das der Aufmacher und fällt
  // unten aus dem Text raus. Sonst bleibt es beim ersten Bild des Beitrags,
  // das im Text an seiner Stelle stehen bleibt.
  const leadIdx = leadingImageIndex(post.body);
  const leadImage = leadIdx === null ? undefined : images.find((i) => i.idx === leadIdx);
  const cover: NewsImage | undefined = leadImage ?? images[0];
  const body = leadImage ? stripLeadingImage(post.body) : post.body;

  return (
    <div className="flex flex-col gap-8">
      {/* ── Aufmacherbild ──
          Bewusst nur das Bild: keine Rundung, kein Rahmen, keine Unterschrift. */}
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={coverSrc(cover)}
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
            Geschrieben von:
            {/* Schlüssel über die Position: in der Editor-Vorschau kann beim
                Tippen kurzzeitig zweimal derselbe Name in der Liste stehen. */}
            {post.authors.map((a, i) => (
              <span key={i} className="inline-flex items-center gap-1.5 text-neutral-200">
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
          text={body}
          images={images}
          headings={post.markdown}
          className="text-[15px] text-neutral-300"
        />
        {children}
      </div>
    </div>
  );
}

function dataUrl(img: NewsImage): string {
  return `data:${img.mime};base64,${img.data}`;
}
