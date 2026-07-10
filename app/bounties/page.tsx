import type { Metadata } from "next";
import BountyList from "@/components/BountyList";

export const metadata: Metadata = { title: "Kopfgelder – TryCity" };

export default function BountiesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">💀 Kopfgelder</h1>
        <p className="mt-1 text-neutral-400">
          Aktive Kopfgelder auf Spieler – sortiert nach Belohnungshöhe.
        </p>
      </div>
      <BountyList />
    </div>
  );
}


