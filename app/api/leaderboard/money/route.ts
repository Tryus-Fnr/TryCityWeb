import { NextResponse } from "next/server";
import { loadTopMoney } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await loadTopMoney(10);
    return NextResponse.json(data);
  } catch (e) {
    console.error("[API/leaderboard/money]", e);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }
}

