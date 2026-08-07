import { NextResponse } from "next/server";
import { loadItems } from "@/lib/queries";
import { germanName } from "@/lib/itemNames.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await loadItems();
    // Deutschen Namen mitliefern, damit im Browser genauso gesucht werden kann
    // wie ingame – ohne dass die 160 KB große Sprachdatei mitgeladen wird.
    const items = rows.map((r) => ({ ...r, de: germanName(r.material) }));
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[api/items]", e);
    return NextResponse.json(
      { ok: false, items: [], error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}
