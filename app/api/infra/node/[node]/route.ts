import { NextRequest, NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import {
  loadInfraEvents,
  loadInfraNode,
  loadInfraServices,
  loadNodeMetrics,
  parseRange,
} from "@/lib/infra";

export const dynamic = "force-dynamic";

/** Eine VPS im Detail: aktuelle Werte, Verlauf und die Services darauf. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ node: string }> }
) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ error: "Nicht berechtigt" }, { status: 403 });
  }

  const { node: nodeId } = await params;
  const range = parseRange(request.nextUrl.searchParams.get("range"));

  try {
    const [node, services, metrics, events] = await Promise.all([
      loadInfraNode(nodeId),
      loadInfraServices(nodeId),
      loadNodeMetrics(nodeId, range),
      loadInfraEvents(range, { node: nodeId }),
    ]);

    if (!node) {
      return NextResponse.json({ ok: false, error: "Node unbekannt" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, node, services, metrics, events, range, at: Date.now() });
  } catch (e) {
    console.error("[API/infra/node]", e);
    return NextResponse.json({ ok: false, error: "DB-Fehler" }, { status: 500 });
  }
}
