import { NextRequest, NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { loadClusterMetrics, loadInfraEvents, parseRange } from "@/lib/infra";

export const dynamic = "force-dynamic";

/**
 * Verlauf des gesamten Clusters – alle Nodes zusammengefasst.
 *
 * Getrennt vom Live-Endpunkt {@code /api/infra}, weil das Dashboard im
 * Sekundentakt pollt, der Verlauf aber nur beim Wechsel des Zeitraums neu
 * geladen werden muss.
 */
export async function GET(request: NextRequest) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const range = parseRange(request.nextUrl.searchParams.get("range"));

  try {
    const [metrics, events] = await Promise.all([
      loadClusterMetrics(range),
      loadInfraEvents(range),
    ]);
    return NextResponse.json({ ok: true, metrics, events, range, at: Date.now() });
  } catch (e) {
    console.error("[API/infra/cluster]", e);
    return NextResponse.json({ ok: false, error: "DB-Fehler" }, { status: 500 });
  }
}
