import type { Metadata } from "next";
import { loadPublishedNews } from "@/lib/news";
import NewsListClient from "@/components/news/NewsListClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog – TryCity",
  description:
    "Updates, Infos, Events und bekannte Fehler des TryCity Minecraft-Netzwerks.",
};

/** Vollständige Beitragsliste – erreichbar über „Alle anzeigen" auf der Startseite. */
export default async function NewsPage() {
  const posts = await loadPublishedNews(200);

  return (
    <div className="flex flex-col gap-7">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Blog</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Alles, was sich auf dem Netzwerk verändert – neue Features, laufende Events,
          Wartungen und Fehler, an denen gerade gearbeitet wird. Dieselben Beiträge
          findest du ingame am Anschlagbrett in der Lobby.
        </p>
      </header>

      <NewsListClient posts={posts} />
    </div>
  );
}
