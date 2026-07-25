import { NextRequest, NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { loadServiceMetricsMulti, parseRange } from "@/lib/infra";

export const dynamic = "force-dynamic";

/** Maximale Anzahl gleichzeitig verglichener Services – schützt die Abfrage. */
const MAX_SERVICES = 8;

/**
 * Verlauf mehrerer Services nebeneinander, z.B.
 * {@code /api/infra/compare?services=SMP-1,SMP-2&range=24h}.
 */
export async function GET(request: NextRequest) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const raw = request.nextUrl.searchParams.get("services") ?? "";
  const services = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, MAX_SERVICES);

  const range = parseRange(request.nextUrl.searchParams.get("range"));

  if (services.length === 0) {
    return NextResponse.json({ ok: true, series: {}, range, at: Date.now() });
  }

  try {
    const series = await loadServiceMetricsMulti(services, range);
    return NextResponse.json({ ok: true, series, range, at: Date.now() });
  } catch (e) {
    console.error("[API/infra/compare]", e);
    return NextResponse.json({ ok: false, error: "DB-Fehler" }, { status: 500 });
  }
}
