import type { Metadata } from "next";
import InfraDashboard from "@/components/infra/InfraDashboard";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Infrastruktur – TryCity" };

export default async function InfraPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">🖥 Infrastruktur</h1>
        <p className="mt-1 text-neutral-400">
          Auslastung aller Root-Server und aller CloudNet-Services – inklusive Proxies. Aktualisiert
          sich alle 5 Sekunden von selbst.
        </p>
      </div>
      <InfraDashboard />
    </div>
  );
}
