import type { Metadata } from "next";
import PlayerNetworkGraph from "@/components/admin/PlayerNetworkGraph";
import { loadPlayerNetwork, type PlayerNetwork } from "@/lib/queries";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Spieler-Netz – TryCity" };

export default async function NetworkPage() {
  await requireAdmin();

  let data: PlayerNetwork = { nodes: [], edges: [] };
  try {
    data = await loadPlayerNetwork(30, 2);
  } catch {
    // Bei DB-Ausfall leerer Graph statt Fehlerseite
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Spieler-Netz</h1>
        <p className="mt-1 text-neutral-400">
          Beziehungsgraph der zuletzt aktiven Spieler. Nähe zeigt, wie eng zwei Punkte
          zusammenhängen.
        </p>
      </div>
      <PlayerNetworkGraph data={data} />
    </div>
  );
}
