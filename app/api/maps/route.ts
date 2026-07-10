import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { loadSyncedMaps } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Liste aller synchronisierten Karten (Metadaten) – nur für Admins. */
export async function GET() {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }
  try {
    const maps = await loadSyncedMaps();
    return NextResponse.json({ ok: true, maps });
  } catch (e) {
    console.error("[api/maps]", e);
    return NextResponse.json(
      { ok: false, maps: [], error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}
