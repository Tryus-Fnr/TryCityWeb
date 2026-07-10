import type { Metadata } from "next";
import PlayerStats from "@/components/PlayerStats";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Server-Stats – TryCity" };

export default async function StatsPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Server-Stats</h1>
        <p className="mt-1 text-neutral-400">
          Spielerzahlen des Netzwerks – alle 5 Minuten vom Proxy erfasst.
        </p>
      </div>
      <PlayerStats />
    </div>
  );
}
