import type { Metadata } from "next";
import ServerMap from "@/components/ServerMap";
import { requireAdmin } from "@/lib/auth";

export const metadata: Metadata = { title: "Server-Karte – TryCity" };

export default async function ServerMapPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🗺 Server-Karte</h1>
        <p className="mt-1 text-neutral-400">
          Interaktive Übersicht aller registrierten SMP-Server-Regionen – aktive Server,
          Koordinaten und Heartbeat-Status. Scrollrad zum Zoomen, Ziehen zum Bewegen.
        </p>
      </div>
      <ServerMap />
    </div>
  );
}


