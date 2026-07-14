import { NextResponse } from "next/server";
import { loadTopPlaytime } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await loadTopPlaytime(10);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[API/leaderboard/playtime]", e);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }
}

