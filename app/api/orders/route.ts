import { NextResponse } from "next/server";
import { loadOpenOrders } from "@/lib/queries";
import { germanName } from "@/lib/itemNames.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const rows = await loadOpenOrders();
    const orders = rows.map((r) => ({ ...r, de: germanName(r.material) }));
    return NextResponse.json(orders);
  } catch (e) {
    console.error("[API/orders]", e);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }
}

