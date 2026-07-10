import type { Metadata } from "next";
import MapGallery from "@/components/MapGallery";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Karten – TryCity" };

export default async function MapsPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🗺️ Karten</h1>
        <p className="mt-1 text-neutral-400">
          Alle netzwerkweit synchronisierten Ingame-Karten (smpg_map_sync) – gerendert
          direkt aus den Pixel-Snapshots der Datenbank. Klick auf eine Karte für Details.
        </p>
      </div>
      <MapGallery />
    </div>
  );
}
