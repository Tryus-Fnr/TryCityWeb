import type { Metadata } from "next";
import { loadPublishedNews } from "@/lib/news";
import NewsListClient from "@/components/news/NewsListClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Neuigkeiten – TryCity",
  description:
    "Alle Updates, Infos, Events und bekannten Fehler des TryCity Minecraft-Netzwerks.",
};

/** Vollständige Beitragsliste – erreichbar über „Alle anzeigen“ auf der Startseite. */
export default async function NewsPage() {
  const posts = await loadPublishedNews(200);

  return (
    <div className="flex flex-col gap-8">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
          Neuigkeiten
        </p>
        <h1 className="mt-2 text-3xl font-bold">Updates, Infos &amp; bekannte Fehler</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-400">
          Alles, was sich auf dem Netzwerk verändert – neue Features, laufende Events,
          Wartungen und Fehler, an denen gerade gearbeitet wird. Dieselben Beiträge
          findest du ingame am Anschlagbrett in der Lobby.
        </p>
      </header>

      <NewsListClient posts={posts} />
    </div>
  );
}
