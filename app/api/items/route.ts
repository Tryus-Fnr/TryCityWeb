import { NextResponse } from "next/server";
import { loadItems } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const items = await loadItems();
    return NextResponse.json({ ok: true, items });
  } catch (e) {
    console.error("[api/items]", e);
    return NextResponse.json(
      { ok: false, items: [], error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}
