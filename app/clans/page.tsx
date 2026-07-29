import type { Metadata } from "next";
import ClanBrowser from "@/components/clan/ClanBrowser";
import { loadAllClans, type ClanSummary } from "@/lib/queries";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Clans – TryCity" };

export default async function ClansPage() {
  let clans: ClanSummary[] = [];
  try {
    clans = await loadAllClans();
  } catch {
    // Bei DB-Ausfall leere Liste statt Fehlerseite
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Clans</h1>
        <p className="mt-1 text-neutral-400">
          Alle Clans des TryCity-SMP mit ihren Mitgliedern und Rängen.
        </p>
      </div>
      <ClanBrowser clans={clans} />
    </div>
  );
}
