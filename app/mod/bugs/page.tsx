import type { Metadata } from "next";
import Link from "next/link";
import { Bug } from "lucide-react";
import { requireMod } from "@/lib/auth";
import { loadAllBugs } from "@/lib/feedback";
import BugAdminList from "@/components/feedback/BugAdminList";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Bug-Meldungen – TryCity" };

/**
 * Alle Bug-Meldungen fürs Team.
 *
 * Dieselben Daten wie im GUI ingame (`/bug admin`) – nur dass hier auch die
 * Screenshots zu sehen sind, die Spieler beim Melden anhängen.
 */
export default async function ModBugsPage() {
  await requireMod();
  const bugs = await loadAllBugs();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="flex items-center gap-2.5 text-3xl font-bold tracking-tight">
          <Bug className="h-7 w-7 text-red-400" strokeWidth={1.5} />
          Bug-Meldungen
        </h1>
        <p className="mt-1 text-neutral-400">
          Was Spieler über{" "}
          <Link href="/bugs" className="text-sky-400 hover:text-sky-300">
            /bugs
          </Link>{" "}
          gemeldet haben. Priorität und Status sind dieselben Werte wie ingame unter
          <span className="text-neutral-300"> /bug admin</span>.
        </p>
      </div>

      <BugAdminList bugs={bugs} />
    </div>
  );
}
