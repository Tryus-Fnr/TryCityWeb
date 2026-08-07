import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { getSession } from "@/lib/session";
import { createItemMeta, loadItemMeta, stopItemMeta } from "@/lib/queries";
import { describeDbError } from "@/lib/dbError";

export const dynamic = "force-dynamic";

const MATERIAL_RE = /^[A-Za-z0-9_]{1,64}$/;

/** Grenzen wie ingame in /dynprice meta – beide Wege sollen sich gleich verhalten. */
const LIMITS = {
  strengthMin: 1,
  strengthMax: 100,
  hoursMin: 0.25,
  hoursMax: 24 * 90,
};

/**
 * GET    /api/items/<MATERIAL>/meta   laufende Meta (öffentlich – die Item-Seite
 *                                     zeigt sie allen Besuchern an)
 * POST   /api/items/<MATERIAL>/meta   Meta setzen (nur Admin)
 * DELETE /api/items/<MATERIAL>/meta   laufende Meta beenden (nur Admin)
 *
 * Geschrieben wird ausschließlich in smpg_price_meta. Den Preis selbst rührt die
 * Website nicht an – das macht das Minecraft-Netzwerk beim nächsten
 * Anpassungslauf (00:00 bzw. 12:00).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ material: string }> }
) {
  const { material } = await params;
  if (!MATERIAL_RE.test(material)) {
    return NextResponse.json({ ok: false, error: "Ungültiges Material." }, { status: 400 });
  }
  try {
    return NextResponse.json({ ok: true, meta: await loadItemMeta(material.toUpperCase()) });
  } catch (e) {
    console.error("[api/items/meta:get]", e);
    return NextResponse.json({ ok: false, error: "Datenbank nicht erreichbar." }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ material: string }> }
) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }

  const { material } = await params;
  if (!MATERIAL_RE.test(material)) {
    return NextResponse.json({ ok: false, error: "Ungültiges Material." }, { status: 400 });
  }

  let body: { targetPrice?: unknown; strength?: unknown; hours?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const targetPrice = Number(body.targetPrice);
  const strength = Number(body.strength);
  const hours = Number(body.hours);

  if (!Number.isFinite(targetPrice) || targetPrice <= 0) {
    return NextResponse.json(
      { ok: false, error: "Der Zielpreis muss größer als 0 sein." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(strength) || strength < LIMITS.strengthMin || strength > LIMITS.strengthMax) {
    return NextResponse.json(
      { ok: false, error: "Die Stärke muss zwischen 1 und 100 % liegen." },
      { status: 400 }
    );
  }
  if (!Number.isFinite(hours) || hours < LIMITS.hoursMin || hours > LIMITS.hoursMax) {
    return NextResponse.json(
      { ok: false, error: "Die Laufzeit muss zwischen 15 Minuten und 90 Tagen liegen." },
      { status: 400 }
    );
  }

  const session = await getSession();
  const by = session?.name ?? session?.uuid ?? "website";

  try {
    await createItemMeta(material.toUpperCase(), targetPrice, strength / 100, hours, by);
    return NextResponse.json({ ok: true, meta: await loadItemMeta(material.toUpperCase()) });
  } catch (e) {
    console.error("[api/items/meta:post]", e);
    return NextResponse.json(
      { ok: false, error: `Meta konnte nicht gespeichert werden: ${describeDbError(e)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ material: string }> }
) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }

  const { material } = await params;
  if (!MATERIAL_RE.test(material)) {
    return NextResponse.json({ ok: false, error: "Ungültiges Material." }, { status: 400 });
  }

  try {
    await stopItemMeta(material.toUpperCase());
    return NextResponse.json({ ok: true, meta: await loadItemMeta(material.toUpperCase()) });
  } catch (e) {
    console.error("[api/items/meta:delete]", e);
    return NextResponse.json(
      { ok: false, error: `Meta konnte nicht beendet werden: ${describeDbError(e)}` },
      { status: 500 }
    );
  }
}
