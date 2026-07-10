import { NextResponse } from "next/server";
import { loadRegions } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const regions = await loadRegions();
    return NextResponse.json(regions);
  } catch (e) {
    console.error("[API/servermap]", e);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }
}

