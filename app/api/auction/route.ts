import { NextResponse } from "next/server";
import { loadActiveAuctions } from "@/lib/queries";
import { germanName } from "@/lib/itemNames.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await loadActiveAuctions();
    // Deutscher Name je Angebot; ein selbst benannter Gegenstand (itemName)
    // behält natürlich seinen eigenen Namen.
    const listings = rows.map((r) => ({ ...r, de: germanName(r.itemMaterial) }));
    return NextResponse.json(listings);
  } catch (e) {
    console.error("[API/auction]", e);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }
}

