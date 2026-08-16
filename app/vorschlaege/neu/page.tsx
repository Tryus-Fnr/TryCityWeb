import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getVerifiedSession } from "@/lib/auth";
import { loadActiveRestriction } from "@/lib/feedback";
import SuggestionForm from "@/components/feedback/SuggestionForm";
import { SetBreadcrumb } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Vorschlag einreichen – TryCity" };

/**
 * Formular für einen neuen Vorschlag.
 *
 * Ohne Anmeldung geht es hier nicht weiter – die Seite schickt zum Login statt
 * ein Formular zu zeigen, das am Ende doch abgelehnt würde. Gesperrte Konten
 * erfahren das ebenfalls vorher und nicht erst nach dem Tippen.
 */
export default async function NeuerVorschlagPage() {
  const session = await getVerifiedSession();
  if (!session) redirect("/login");

  const restriction = await loadActiveRestriction(session.uuid);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <SetBreadcrumb label="Neuer Vorschlag" />

      <header>
        <h1 className="text-3xl font-bold tracking-tight">Vorschlag einreichen</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Schau beim Titel kurz auf die Vorschläge, die dir angezeigt werden – steht deine
          Idee schon da, hilft eine Stimme dafür mehr als ein zweiter Eintrag.
        </p>
      </header>

      <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        {restriction !== null ? (
          <p className="rounded-xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-300">
            {restriction === "BAN"
              ? "Dein Konto ist gesperrt – du kannst keine Vorschläge einreichen."
              : "Du bist stummgeschaltet – solange kannst du keine Vorschläge einreichen."}
          </p>
        ) : (
          <SuggestionForm />
        )}
      </div>
    </div>
  );
}
