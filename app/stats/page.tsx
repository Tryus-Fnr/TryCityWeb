import PlayerStats from "@/components/PlayerStats";

export const metadata = { title: "Server-Stats – TryCity" };

export default function StatsPage() {
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
