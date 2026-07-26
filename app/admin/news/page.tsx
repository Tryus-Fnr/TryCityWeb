import Link from "next/link";
import { Plus, Pencil, ImageIcon, Pin, Eye, EyeOff } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { germanDate, loadAllNews } from "@/lib/news";
import NewsTypeBadge from "@/components/news/NewsTypeBadge";

export const dynamic = "force-dynamic";

/** Admin-Übersicht: alle Beiträge inkl. Entwürfe, mit Sprung in den Editor. */
export default async function AdminNewsPage() {
  await requireAdmin();
  const posts = await loadAllNews();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Admin
          </p>
          <h1 className="mt-2 text-3xl font-bold">Neuigkeiten verwalten</h1>
          <p className="mt-2 max-w-2xl text-sm text-neutral-500">
            Beiträge erscheinen auf der Startseite, unter{" "}
            <Link href="/news" className="text-sky-400 hover:text-sky-300">
              /news
            </Link>{" "}
            und ingame am Anschlagbrett in der Lobby.
          </p>
        </div>

        <Link
          href="/admin/news/new"
          className="inline-flex items-center gap-2 rounded-xl bg-sky-500 px-4 py-2.5 text-sm font-semibold text-black transition-colors hover:bg-sky-400"
        >
          <Plus className="h-4 w-4" />
          Neuer Beitrag
        </Link>
      </header>

      {posts.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-10 text-center text-sm text-neutral-500">
          Noch keine Beiträge. Leg den ersten an.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-white/[0.08]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-white/[0.08] text-left text-xs uppercase tracking-wider text-neutral-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Typ</th>
                <th className="px-4 py-3 font-semibold">Titel</th>
                <th className="px-4 py-3 font-semibold">Autor</th>
                <th className="px-4 py-3 font-semibold">Datum</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.06]">
              {posts.map((post) => (
                <tr key={post.id} className="transition-colors hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <NewsTypeBadge type={post.type} />
                  </td>
                  <td className="max-w-[320px] px-4 py-3">
                    <Link
                      href={`/admin/news/${post.id}`}
                      className="block truncate font-medium text-neutral-100 hover:text-sky-300"
                    >
                      {post.title}
                    </Link>
                    {post.imageCount > 0 && (
                      <span className="mt-0.5 inline-flex items-center gap-1 text-xs text-neutral-600">
                        <ImageIcon className="h-3 w-3" />
                        {post.imageCount} Bild(er)
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-400">
                    {post.authorName}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-500">
                    {germanDate(post.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex items-center gap-2">
                      {post.published ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                          <Eye className="h-3 w-3" />
                          Sichtbar
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                          <EyeOff className="h-3 w-3" />
                          Entwurf
                        </span>
                      )}
                      {post.pinned && <Pin className="h-3 w-3 text-amber-400" />}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/news/${post.id}`}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
                    >
                      <Pencil className="h-3 w-3" />
                      Bearbeiten
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
