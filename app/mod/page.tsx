import type { Metadata } from "next";
import { requireMod } from "@/lib/auth";
import {
  loadUnbanRequests,
  loadAllBans,
  loadPlayerStats,
  loadRecentPunishments,
  loadRecentAnticheatFlags,
  loadModCounts,
} from "@/lib/queries";
import ModPanel from "@/components/mod/ModPanel";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mod-Panel – TryCity" };

export default async function ModPage() {
  await requireMod();

  // Die Listen liefern nur den ersten Block; weitere holt das Panel bei Bedarf
  // über /api/mod/list nach. Die Zähler kommen aus eigenen COUNT-Abfragen –
  // vorher zeigten sie die Länge der gekappten Liste und blieben bei 300 stehen.
  const [requests, bans, playerStats, mutes, warns, kicks, anticheat, counts] =
    await Promise.all([
      loadUnbanRequests().catch(() => []),
      loadAllBans().catch(() => []),
      loadPlayerStats().catch(() => ({ total: 0, banned: 0 })),
      loadRecentPunishments("MUTE").catch(() => []),
      loadRecentPunishments("WARN").catch(() => []),
      loadRecentPunishments("KICK").catch(() => []),
      loadRecentAnticheatFlags().catch(() => []),
      loadModCounts().catch(() => ({
        mutes: 0, activeMutes: 0, warns: 0, kicks: 0, anticheat: 0,
      })),
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
        counts={counts}
      />
    </div>
  );
}
