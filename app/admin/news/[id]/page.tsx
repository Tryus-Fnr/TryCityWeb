import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { loadNewsImages, loadNewsPost } from "@/lib/news";
import NewsEditor from "@/components/news/NewsEditor";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

/** Bestehenden Beitrag bearbeiten. */
export default async function EditNewsPage({ params }: Props) {
  await requireAdmin();

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const post = await loadNewsPost(id, true);
  if (!post) notFound();

  const [images, session] = await Promise.all([loadNewsImages(id), getSession()]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/news"
          className="inline-flex w-fit items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Zurück zur Übersicht
        </Link>
        <Link
          href={`/news/${post.id}`}
          className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          Beitrag ansehen
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      <h1 className="text-3xl font-bold">Beitrag bearbeiten</h1>

      <NewsEditor post={post} images={images} currentUser={session?.name ?? ""} />
    </div>
  );
}
