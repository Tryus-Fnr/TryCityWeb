import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { pushAlert } from "@/lib/tebexAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Empfänger für Tebex-Webhooks (Store-Käufe).
 *
 * Adresse im Tebex-Panel:  https://trycity.net/api/tebex/webhook
 *
 * Zwei Dinge, an denen die Einrichtung sonst scheitert:
 *
 * 1. Beim Speichern im Panel schickt Tebex sofort ein `validation.webhook`
 *    und erwartet HTTP 200 mit der mitgeschickten `id` im Body zurück.
 *    Antwortet die Adresse nicht so, wird der Webhook gar nicht erst aktiv.
 *
 * 2. Signiert wird der **rohe** Body. Deshalb hier req.text() und kein
 *    req.json() – nach Parsen und neu Serialisieren stimmt der Hash nicht mehr
 *    (Feldreihenfolge, Leerzeichen, Zahlenformat).
 */

/** Was Tebex unter `subject` schickt – nur die Felder, die hier gebraucht werden. */
type TebexPayload = {
  id?: string;
  type?: string;
  subject?: {
    transaction_id?: string;
    price?: { amount?: number; currency?: string };
    price_paid?: { amount?: number; currency?: string };
    customer?: {
      username?: { id?: string; username?: string };
      name?: string;
    };
    products?: Array<{ name?: string; quantity?: number }>;
  };
};

function verifySignature(raw: string, given: string): boolean {
  const secret = process.env.TEBEX_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[tebex/webhook] TEBEX_WEBHOOK_SECRET fehlt – alles abgelehnt");
    return false;
  }

  // HMAC-SHA256 über den SHA256-Hash des Rohbodys, signiert mit dem Secret.
  const expected = createHmac("sha256", secret)
    .update(createHash("sha256").update(raw).digest("hex"))
    .digest("hex");

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(given, "utf8");
  if (a.length !== b.length) {
    logSignatureMismatch(raw, given, secret, expected);
    return false;
  }
  const ok = timingSafeEqual(a, b);
  if (!ok) logSignatureMismatch(raw, given, secret, expected);
  return ok;
}

/**
 * Bei Abweichung beides protokollieren: den Hash über den Hash und den direkt
 * über den Body. Falls Tebex das Verfahren je umstellt, steht im Log sofort,
 * welche der beiden Varianten passt – ohne Raterei.
 * Das Secret selbst landet nie im Log.
 */
function logSignatureMismatch(raw: string, given: string, secret: string, expected: string) {
  const direct = createHmac("sha256", secret).update(raw).digest("hex");
  console.error(
    "[tebex/webhook] Signatur passt nicht.",
    "\n  erhalten:        ", given || "(kein X-Signature-Header)",
    "\n  erwartet (Hash): ", expected,
    "\n  erwartet (roh):  ", direct
  );
}

/** Kaufzeile fürs Overlay bauen. E-Mail-Adressen bleiben bewusst außen vor. */
function toAlert(p: TebexPayload) {
  const s = p.subject ?? {};
  const price = s.price ?? s.price_paid;

  const products = (s.products ?? [])
    .map((prod) => {
      const name = prod.name?.trim();
      if (!name) return null;
      const qty = prod.quantity ?? 1;
      return qty > 1 ? `${qty}x ${name}` : name;
    })
    .filter((x): x is string => x !== null);

  return {
    buyer: s.customer?.username?.username?.trim() || s.customer?.name?.trim() || "Jemand",
    products: products.length > 0 ? products : ["etwas im Store"],
    amount: typeof price?.amount === "number" ? price.amount : undefined,
    currency: price?.currency,
    txn: s.transaction_id,
  };
}

export async function POST(req: Request) {
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-signature") ?? "")) {
    return new NextResponse("bad signature", { status: 403 });
  }

  let payload: TebexPayload;
  try {
    payload = JSON.parse(raw) as TebexPayload;
  } catch {
    console.error("[tebex/webhook] Body ist kein JSON:", raw.slice(0, 500));
    return new NextResponse("bad json", { status: 400 });
  }

  // Prüft beim Speichern im Panel, ob die Adresse wirklich uns gehört.
  if (payload.type === "validation.webhook") {
    console.log("[tebex/webhook] Validierung beantwortet, id =", payload.id);
    return NextResponse.json({ id: payload.id });
  }

  if (payload.type === "payment.completed") {
    const alert = toAlert(payload);
    pushAlert(alert);
    console.log(
      `[tebex/webhook] Kauf: ${alert.buyer} – ${alert.products.join(", ")}` +
        (alert.amount != null ? ` (${alert.amount} ${alert.currency ?? ""})` : "") +
        ` [${alert.txn ?? "?"}]`
    );
  } else {
    // Rückbuchungen o.ä. sollen im Stream nichts auslösen, aber sichtbar sein.
    console.log("[tebex/webhook] Ereignis ohne Overlay:", payload.type);
  }

  // Immer 200 – bei allem anderen stellt Tebex stundenlang erneut zu.
  return new NextResponse("ok");
}
