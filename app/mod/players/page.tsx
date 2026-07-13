import type { Metadata } from "next";
import { requireMod } from "@/lib/auth";
import { loadAllPlayers } from "@/lib/queries";
import ModPlayerBrowser from "@/components/mod/ModPlayerBrowser";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spieler-Suche – Mod-Panel – TryCity" };

export default async function ModPlayersPage() {
  await requireMod();

  let players: Awaited<ReturnType<typeof loadAllPlayers>> = [];
  try {
    players = await loadAllPlayers();
  } catch {
    // Bei DB-Ausfall leere Liste
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Spieler-Suche</h1>
        <p className="mt-1 text-neutral-400">
          Alle Spieler durchsuchen und vollständige Mod-Infos abrufen.
        </p>
      </div>
      <ModPlayerBrowser initial={players} />
    </div>
  );
}

