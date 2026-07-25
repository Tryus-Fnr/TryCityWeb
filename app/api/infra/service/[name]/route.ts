import { NextRequest, NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import {
  loadInfraEvents,
  loadInfraService,
  loadServiceMetrics,
  parseRange,
} from "@/lib/infra";

export const dynamic = "force-dynamic";

/** Ein CloudNet-Service im Detail – gilt genauso für Proxies wie für Server. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { name } = await params;
  const serviceName = decodeURIComponent(name);
  const range = parseRange(request.nextUrl.searchParams.get("range"));

  try {
    const [service, metrics, events] = await Promise.all([
      loadInfraService(serviceName),
      loadServiceMetrics(serviceName, range),
      loadInfraEvents(range, { service: serviceName }),
    ]);

    // Ein gestoppter Service hat keine Live-Zeile mehr, aber weiterhin Verlauf –
    // dann zeigen wir nur die Historie statt einen 404 zu werfen.
    if (!service && metrics.length === 0) {
      return NextResponse.json({ ok: false, error: "Service unbekannt" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, service, metrics, events, range, at: Date.now() });
  } catch (e) {
    console.error("[API/infra/service]", e);
    return NextResponse.json({ ok: false, error: "DB-Fehler" }, { status: 500 });
  }
}
