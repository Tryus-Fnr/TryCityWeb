import { NextResponse } from "next/server";
import { loadOpenOrders } from "@/lib/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const orders = await loadOpenOrders();
    return NextResponse.json(orders);
  } catch (e) {
    console.error("[API/orders]", e);
    return NextResponse.json({ error: "DB-Fehler" }, { status: 500 });
  }
}

