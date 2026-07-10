import type { Metadata } from "next";
import AuctionBrowser from "@/components/AuctionBrowser";

export const metadata: Metadata = { title: "Auktionshaus – TryCity" };

export default function AuctionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Auktionshaus</h1>
        <p className="mt-1 text-neutral-400">
          Alle aktiven Einträge im Auktionshaus – Sofortkäufe und laufende Auktionen.
        </p>
      </div>
      <AuctionBrowser />
    </div>
  );
}


