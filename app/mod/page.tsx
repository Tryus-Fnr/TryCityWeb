import type { Metadata } from "next";
import { requireMod } from "@/lib/auth";
import { loadUnbanRequests, loadAllActiveBans, loadPlayerStats } from "@/lib/queries";
import ModPanel from "@/components/mod/ModPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mod-Panel – TryCity" };

export default async function ModPage() {
  await requireMod();

  const [requests, bans, playerStats] = await Promise.all([
    loadUnbanRequests().catch(() => []),
    loadAllActiveBans().catch(() => []),
    loadPlayerStats().catch(() => ({ total: 0, banned: 0 })),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mod-Panel</h1>
        <p className="mt-1 text-neutral-400">
          Moderations-Übersicht: Entbannungs-Anträge, Ban-Liste und Spielerinfos.
        </p>
      </div>
      <ModPanel
        unbanRequests={requests}
        activeBans={bans}
        playerStats={playerStats}
      />
    </div>
  );
}

