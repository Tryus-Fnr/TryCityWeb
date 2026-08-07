import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { updateItemSettings } from "@/lib/queries";
import { describeDbError } from "@/lib/dbError";

export const dynamic = "force-dynamic";

const MATERIAL_RE = /^[A-Za-z0-9_]{1,64}$/;

/**
 * POST /api/items/<MATERIAL>/settings  – dauerhafte Preis-Einstellungen (nur Admin)
 *
 * Ändert StartWert, Unter- und Obergrenze und optional den aktuellen
 * Verkaufspreis. Im Gegensatz zu einer Meta ist das keine befristete Anhebung,
 * sondern der Rahmen, in dem sich der Preis von selbst bewegt.
 *
 * Die Verkaufszähler und der Beobachtungszeitraum bleiben unangetastet – eine
 * Änderung hier wirft die Marktbeobachtung also nicht weg.
 */
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

  let body: {
    startValue?: unknown;
    minPrice?: unknown;
    maxPrice?: unknown;
    currentPrice?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const startValue = Number(body.startValue);
  const minPrice = Number(body.minPrice);
  const maxPrice = Number(body.maxPrice);
  const currentPrice =
    body.currentPrice === null || body.currentPrice === undefined || body.currentPrice === ""
      ? null
      : Number(body.currentPrice);

  const finite = (v: number) => Number.isFinite(v);

  if (!finite(startValue) || startValue <= 0) {
    return NextResponse.json(
      { ok: false, error: "Der StartWert muss größer als 0 sein." },
      { status: 400 }
    );
  }
  if (!finite(minPrice) || minPrice < 0) {
    return NextResponse.json(
      { ok: false, error: "Die Untergrenze darf nicht negativ sein." },
      { status: 400 }
    );
  }
  if (!finite(maxPrice) || maxPrice <= 0) {
    return NextResponse.json(
      { ok: false, error: "Die Obergrenze muss größer als 0 sein." },
      { status: 400 }
    );
  }
  if (minPrice > maxPrice) {
    return NextResponse.json(
      { ok: false, error: "Die Untergrenze darf nicht über der Obergrenze liegen." },
      { status: 400 }
    );
  }
  if (startValue < minPrice || startValue > maxPrice) {
    return NextResponse.json(
      { ok: false, error: "Der StartWert muss zwischen Unter- und Obergrenze liegen." },
      { status: 400 }
    );
  }
  if (currentPrice !== null) {
    if (!finite(currentPrice) || currentPrice <= 0) {
      return NextResponse.json(
        { ok: false, error: "Der aktuelle Preis muss größer als 0 sein." },
        { status: 400 }
      );
    }
    if (currentPrice < minPrice || currentPrice > maxPrice) {
      return NextResponse.json(
        { ok: false, error: "Der aktuelle Preis muss zwischen Unter- und Obergrenze liegen." },
        { status: 400 }
      );
    }
  }

  try {
    const found = await updateItemSettings(
      material.toUpperCase(),
      startValue,
      minPrice,
      maxPrice,
      currentPrice
    );
    if (!found) {
      return NextResponse.json(
        { ok: false, error: "Dieses Item ist nicht im dynamischen Preissystem." },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/items/settings:post]", e);
    return NextResponse.json(
      { ok: false, error: `Einstellungen konnten nicht gespeichert werden: ${describeDbError(e)}` },
      { status: 500 }
    );
  }
}
