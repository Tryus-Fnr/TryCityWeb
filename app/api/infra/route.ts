import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { loadInfraNodes, loadInfraServices } from "@/lib/infra";

export const dynamic = "force-dynamic";

/**
 * Live-Zustand der gesamten Infrastruktur: alle VPS plus alle CloudNet-Services.
 *
 * Bewusst EIN Endpunkt für beides – das Dashboard pollt im Sekundentakt und
 * soll dafür nicht zwei Roundtrips brauchen. Neu gestartete Services tauchen
 * automatisch auf, weil immer die komplette Liste geliefert wird.
 */
export async function GET() {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  try {
    const [nodes, services] = await Promise.all([loadInfraNodes(), loadInfraServices()]);
    return NextResponse.json({ ok: true, nodes, services, at: Date.now() });
  } catch (e) {
    console.error("[API/infra]", e);
    return NextResponse.json({ ok: false, error: "DB-Fehler" }, { status: 500 });
  }
}
