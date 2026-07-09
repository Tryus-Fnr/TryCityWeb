import { NextResponse } from "next/server";
import { loadSparklinesAll } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const sparklines = await loadSparklinesAll();
    return NextResponse.json({ ok: true, sparklines });
  } catch (e) {
    console.error("[api/items/sparklines]", e);
    return NextResponse.json(
      { ok: false, sparklines: {}, error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}

