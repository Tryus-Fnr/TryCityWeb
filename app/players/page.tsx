import PlayerBrowser from "@/components/PlayerBrowser";
import { loadAllPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata = { title: "SMP-Spieler – TryCity" };

export default async function PlayersPage() {
  let players: Awaited<ReturnType<typeof loadAllPlayers>> = [];
  try {
    players = await loadAllPlayers();
  } catch {
    // Bei DB-Ausfall leere Liste – Client lädt nach
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">SMP-Spieler</h1>
        <p className="mt-1 text-neutral-400">
          Alle Spieler des TryCity-SMP mit Statistiken, Wirtschaftsdaten und Spielprofil.
        </p>
      </div>
      <PlayerBrowser initial={players} />
    </div>
  );
}

