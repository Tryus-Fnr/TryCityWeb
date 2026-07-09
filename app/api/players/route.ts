import { NextResponse } from "next/server";
import { loadAllPlayers } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const players = await loadAllPlayers();
    return NextResponse.json({ ok: true, players });
  } catch (e) {
    console.error("[api/players]", e);
    return NextResponse.json(
      { ok: false, players: [], error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}

