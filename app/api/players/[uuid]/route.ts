import { NextResponse } from "next/server";
import { loadPlayerDetail } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  try {
    const player = await loadPlayerDetail(uuid);
    if (!player) {
      return NextResponse.json({ ok: false, error: "Spieler nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true, player });
  } catch (e) {
    console.error("[api/players/[uuid]]", e);
    return NextResponse.json(
      { ok: false, error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}

