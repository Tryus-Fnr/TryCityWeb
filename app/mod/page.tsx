import type { Metadata } from "next";
import { requireMod } from "@/lib/auth";
import {
  loadUnbanRequests,
  loadAllBans,
  loadPlayerStats,
  loadRecentPunishments,
  loadRecentAnticheatFlags,
} from "@/lib/queries";
import ModPanel from "@/components/mod/ModPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mod-Panel – TryCity" };

export default async function ModPage() {
  await requireMod();

  const [requests, bans, playerStats, mutes, warns, kicks, anticheat] =
    await Promise.all([
      loadUnbanRequests().catch(() => []),
      loadAllBans().catch(() => []),
      loadPlayerStats().catch(() => ({ total: 0, banned: 0 })),
      loadRecentPunishments("MUTE").catch(() => []),
      loadRecentPunishments("WARN").catch(() => []),
      loadRecentPunishments("KICK").catch(() => []),
      loadRecentAnticheatFlags().catch(() => []),
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
        allBans={bans}
        playerStats={playerStats}
        mutes={mutes}
        warns={warns}
        kicks={kicks}
        anticheatFlags={anticheat}
      />
    </div>
  );
}
