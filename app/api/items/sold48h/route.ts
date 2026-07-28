import { NextResponse } from "next/server";
import { loadSold48h } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sold48h = await loadSold48h();
    return NextResponse.json({ ok: true, sold48h });
  } catch (e) {
    console.error("[api/items/sold48h]", e);
    return NextResponse.json(
      { ok: false, sold48h: {}, error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}

