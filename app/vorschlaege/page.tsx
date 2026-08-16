import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Lightbulb, Plus } from "lucide-react";
import { getVerifiedSession } from "@/lib/auth";
import { loadSuggestions } from "@/lib/feedback";
import SuggestionList from "@/components/feedback/SuggestionList";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Vorschläge – TryCity",
  description:
    "Ideen für das TryCity Minecraft-Netzwerk einreichen und darüber abstimmen, was als Nächstes kommt.",
};

/**
 * Übersicht aller Spieler-Vorschläge.
 *
 * Lesen darf jeder – einreichen und abstimmen nur, wer angemeldet ist. Die
 * Anmeldung läuft über den Minecraft-Namen, damit eine Stimme wirklich einem
 * Spieler entspricht und nicht einem Browser-Tab.
 */
export default async function VorschlaegePage() {
  const session = await getVerifiedSession();
  const suggestions = await loadSuggestions(session?.uuid ?? null);

  return (
    <div className="flex flex-col gap-7">
      <header>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
              <Lightbulb className="h-7 w-7 text-amber-400" strokeWidth={1.5} />
              Vorschläge
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-neutral-400">
              Was fehlt auf dem Netzwerk? Reiche deine Idee ein und stimme über die
              der anderen ab. Was oben steht, sehen wir zuerst an.
            </p>
          </div>

          {session ? (
            <Link
              href="/vorschlaege/neu"
              className="flex shrink-0 items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-sky-400"
            >
              <Plus className="h-4 w-4" />
              Vorschlag einreichen
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-neutral-300 ring-1 ring-white/15 transition-colors hover:bg-white/5"
            >
              Anmelden zum Mitmachen
            </Link>
          )}
        </div>

        <Link
          href="/bugs"
          className="mt-4 inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-red-300"
        >
          <Bug className="h-4 w-4" />
          Einen Fehler gefunden? Der gehört hierhin.
        </Link>
      </header>

      <SuggestionList suggestions={suggestions} loggedIn={session !== null} />
    </div>
  );
}
