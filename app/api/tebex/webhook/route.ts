import { createHash, createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { claimTransaction, pushAlert } from "@/lib/tebexAlerts";

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

/** Ein Zahlungsvorgang – nur die Felder, die hier gebraucht werden. */
type TebexPayment = {
  transaction_id?: string;
  price?: { amount?: number; currency?: string };
  price_paid?: { amount?: number; currency?: string };
  customer?: {
    /** Bei Minecraft-Stores der Spielername. Kann null sein. */
    username?: { id?: string; username?: string } | null;
    // Tebex schickt daneben first_name, last_name, email, ip, country und
    // postal_code. Nichts davon wird gelesen - siehe toAlert().
  };
  products?: Array<{ name?: string; quantity?: number }>;
};

/**
 * Bei `payment.completed` ist `subject` selbst der Zahlungsvorgang.
 *
 * Bei den Abo-Ereignissen ist `subject` dagegen das **Abonnement**
 * (`reference`, `next_payment_at`, `status`, `fail_count` …) und die Zahlung
 * steckt verschachtelt darin: `initial_payment` beim Start, `last_payment` bei
 * jeder Verlängerung.
 */
type TebexPayload = {
  id?: string;
  type?: string;
  subject?: TebexPayment & {
    initial_payment?: TebexPayment;
    last_payment?: TebexPayment;
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

/**
 * Kaufzeile fürs Overlay bauen.
 *
 * Als Käufername kommt ausschließlich `customer.username.username` in Frage –
 * der Minecraft-Name. Tebex liefert daneben auch `first_name`/`last_name`,
 * also den bürgerlichen Namen des Kunden. Der wird bewusst **nicht** benutzt:
 * fehlt der Spielername, steht im Stream lieber "Jemand" als der echte Name
 * eines Käufers vor Publikum. E-Mail, IP und Anschrift ebenso wenig.
 */
function toAlert(s: TebexPayment, kind: "purchase" | "renewal") {
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
    buyer: s.customer?.username?.username?.trim() || "Jemand",
    products: products.length > 0 ? products : ["etwas im Store"],
    amount: typeof price?.amount === "number" ? price.amount : undefined,
    currency: price?.currency,
    txn: s.transaction_id,
    kind,
  };
}

/**
 * Aus dem Ereignis den Zahlungsvorgang und die Art des Alerts holen.
 * `null` = dieses Ereignis soll kein Overlay auslösen.
 */
function extractPayment(
  payload: TebexPayload
): { payment: TebexPayment; kind: "purchase" | "renewal" } | null {
  const s = payload.subject;
  if (!s) return null;

  switch (payload.type) {
    case "payment.completed":
      return { payment: s, kind: "purchase" };

    // Abo startet: der erste Kauf steckt in initial_payment
    case "recurring-payment.started":
      return { payment: s.initial_payment ?? s.last_payment ?? s, kind: "purchase" };

    // Abo verlängert: die frische Zahlung steckt in last_payment
    case "recurring-payment.renewed":
      return { payment: s.last_payment ?? s.initial_payment ?? s, kind: "renewal" };

    default:
      return null;
  }
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

  const treffer = extractPayment(payload);

  if (!treffer) {
    // Rückbuchungen, Kündigungen o.ä. sollen im Stream nichts auslösen,
    // aber im Log sichtbar sein.
    console.log("[tebex/webhook] Ereignis ohne Overlay:", payload.type);
  } else if (!claimTransaction(treffer.payment.transaction_id)) {
    // Derselbe Kauf kam schon über ein anderes Ereignis herein
    console.log(
      "[tebex/webhook] Doppelt, übersprungen:",
      payload.type,
      treffer.payment.transaction_id
    );
  } else {
    const alert = toAlert(treffer.payment, treffer.kind);
    pushAlert(alert);
    console.log(
      `[tebex/webhook] ${alert.kind === "renewal" ? "Verlängerung" : "Kauf"}: ` +
        `${alert.buyer} – ${alert.products.join(", ")}` +
        (alert.amount != null ? ` (${alert.amount} ${alert.currency ?? ""})` : "") +
        ` [${alert.txn ?? "?"}]`
    );
  }

  // Immer 200 – bei allem anderen stellt Tebex stundenlang erneut zu.
  return new NextResponse("ok");
}
