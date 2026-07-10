import { NextResponse } from "next/server";
import { loadActiveAuctions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const listings = await loadActiveAuctions();
    return NextResponse.json(listings);
  } catch (e) {
    console.error("[API/auction]", e);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }
}

