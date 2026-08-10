import { NextResponse } from "next/server";
import { clientCount, overlayKeyOk, pushAlert } from "@/lib/tebexAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Test-Alert auslösen – zum Einrichten in OBS, ohne dafür etwas kaufen zu
 * müssen. GET reicht, damit man die Adresse einfach im Browser aufrufen kann.
 *
 *   https://trycity.net/api/alerts/test?key=DEIN_KEY
 *
 * Optional: &buyer=Name &product=VIP%20Rang &amount=9.99
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  if (!overlayKeyOk(url.searchParams.get("key"))) {
    return new NextResponse("unauthorized", { status: 401 });
  }

  const amountRaw = url.searchParams.get("amount");
  const amount = amountRaw !== null ? Number(amountRaw) : 9.99;

  const alert = pushAlert({
    buyer: url.searchParams.get("buyer")?.trim() || "Tryus",
    products: [url.searchParams.get("product")?.trim() || "1x VIP Rang"],
    amount: Number.isFinite(amount) ? amount : undefined,
    currency: url.searchParams.get("currency")?.trim() || "EUR",
    test: true,
  });

  return NextResponse.json({
    ok: true,
    alert,
    // Steht hier 0, läuft der Test ins Leere: kein Overlay ist verbunden.
    overlays: clientCount(),
  });
}
