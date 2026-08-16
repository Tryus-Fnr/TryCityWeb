import type { Metadata } from "next";
import Link from "next/link";
import { Bug, Lightbulb, ShieldCheck } from "lucide-react";
import { getModStatus, getVerifiedSession } from "@/lib/auth";
import { loadActiveRestriction, loadOwnBugs } from "@/lib/feedback";
import BugForm from "@/components/feedback/BugForm";
import BugItem from "@/components/feedback/BugItem";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Fehler melden – TryCity",
  description: "Einen Fehler im TryCity Minecraft-Netzwerk melden – mit Screenshots.",
};

/**
 * Fehler melden.
 *
 * Das ist die Seite, auf die `/bug` im Spiel verweist. Ingame gibt es das
 * Formular nicht mehr: Text in einem Chat-Dialog zu tippen ist mühsam, und
 * Screenshots gehen dort gar nicht. Übrig bleibt ingame nur die Ansicht für
 * das Team (`/bug admin`), die dieselbe Tabelle liest.
 */
export default async function BugsPage() {
  const session = await getVerifiedSession();
  const isMod = session ? await getModStatus() : false;
  const eigene = session ? await loadOwnBugs(session.uuid) : [];
  const restriction = session ? await loadActiveRestriction(session.uuid) : null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header>
        <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <Bug className="h-7 w-7 text-red-400" strokeWidth={1.5} />
          Fehler melden
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-400">
          Etwas funktioniert nicht wie gedacht? Beschreibe es hier so genau wie möglich –
          am besten mit Screenshot. Je klarer die Meldung, desto schneller ist es behoben.
        </p>

        <div className="mt-4 flex flex-wrap gap-4">
          <Link
            href="/vorschlaege"
            className="inline-flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-amber-300"
          >
            <Lightbulb className="h-4 w-4" />
            Kein Fehler, sondern eine Idee? Dann hier entlang.
          </Link>
          {isMod && (
            <Link
              href="/mod/bugs"
              className="inline-flex items-center gap-2 text-sm text-amber-400/80 transition-colors hover:text-amber-300"
            >
              <ShieldCheck className="h-4 w-4" />
              Alle Meldungen ansehen
            </Link>
          )}
        </div>
      </header>

      <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6">
        {!session ? (
          <div className="text-center">
            <p className="text-sm text-neutral-300">
              Zum Melden musst du angemeldet sein – so wissen wir, bei wem wir nachfragen können.
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              Die Anmeldung läuft über deinen Minecraft-Namen, ein Passwort brauchst du nicht.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-block rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-sky-400"
            >
              Mit Minecraft anmelden
            </Link>
          </div>
        ) : restriction !== null ? (
          <p className="rounded-xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-300">
            {restriction === "BAN"
              ? "Dein Konto ist gesperrt – du kannst nichts melden."
              : "Du bist stummgeschaltet – solange kannst du nichts melden."}
          </p>
        ) : (
          <BugForm />
        )}
      </div>

      {session && (
        <section className="mt-10">
          <h2 className="text-lg font-bold text-neutral-100">Deine Meldungen</h2>
          {eigene.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-8 text-center text-sm text-neutral-500">
              Du hast noch nichts gemeldet.
            </p>
          ) : (
            <div className="mt-3 flex flex-col gap-3">
              {eigene.map((bug) => (
                <BugItem key={bug.id} bug={bug} />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
