import { NextResponse } from "next/server";
import { loadBounties } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const bounties = await loadBounties();
    return NextResponse.json(bounties);
  } catch (e) {
    console.error("[API/bounties]", e);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }
}

