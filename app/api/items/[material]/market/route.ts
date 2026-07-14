import { NextResponse } from "next/server";
import { loadItemMarketHistory } from "@/lib/queries";

export const dynamic = "force-dynamic";

const MATERIAL_RE = /^[A-Za-z0-9_]{1,64}$/;

const RANGES: Record<string, number | null> = {
  "14d": 14,
  "30d": 30,
  "90d": 90,
  all: null,
};

export async function GET(
  req: Request,
  { params }: { params: Promise<{ material: string }> }
) {
  const { material } = await params;
  if (!MATERIAL_RE.test(material)) {
    return NextResponse.json({ ok: false, error: "Ungültiges Material." }, { status: 400 });
  }

  const range = new URL(req.url).searchParams.get("range") ?? "14d";
  const days = range in RANGES ? RANGES[range] : 14;

  try {
    const data = await loadItemMarketHistory(material.toUpperCase(), days);
    return NextResponse.json({ ok: true, data });
  } catch (e) {
    console.error("[api/items/market]", e);
    return NextResponse.json(
      { ok: false, error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}

