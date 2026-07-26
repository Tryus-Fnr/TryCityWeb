import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { getSession } from "@/lib/session";
import NewsEditor from "@/components/news/NewsEditor";

export const dynamic = "force-dynamic";

/** Neuen Beitrag schreiben. */
export default async function NewNewsPage() {
  await requireAdmin();
  const session = await getSession();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/news"
        className="inline-flex w-fit items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
      >
        <ArrowLeft className="h-4 w-4" />
        Zurück zur Übersicht
      </Link>

      <h1 className="text-3xl font-bold">Neuer Beitrag</h1>

      <NewsEditor post={null} images={[]} currentUser={session?.name ?? ""} />
    </div>
  );
}
