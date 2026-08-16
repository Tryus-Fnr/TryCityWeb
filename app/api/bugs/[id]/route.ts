import { NextResponse } from "next/server";
import { getModStatus } from "@/lib/auth";
import { describeDbError } from "@/lib/dbError";
import { deleteBug, updateBug } from "@/lib/feedback";

export const dynamic = "force-dynamic";

/**
 * Eine Bug-Meldung verwalten – nur fürs Team.
 *
 * PATCH  – Priorität (0–3) und Status (0 offen / 1 erledigt), dieselben Werte
 *          wie im Admin-GUI ingame
 * DELETE – Meldung samt Bildern entfernen
 */

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "Ungültige id." }, { status: 400 });
  }
  if (!(await getModStatus())) {
    return NextResponse.json({ ok: false, error: "Keine Berechtigung." }, { status: 403 });
  }

  let body: { priority?: unknown; status?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const priority = Number(body.priority);
  const status = Number(body.status);
  if (![0, 1, 2, 3].includes(priority) || ![0, 1].includes(status)) {
    return NextResponse.json({ ok: false, error: "Ungültige Werte." }, { status: 400 });
  }

  try {
    const affected = await updateBug(id, priority, status);
    if (affected === 0) {
      return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/bugs/patch]", e);
    return NextResponse.json(
      { ok: false, error: `Speichern fehlgeschlagen: ${describeDbError(e)}` },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "Ungültige id." }, { status: 400 });
  }
  if (!(await getModStatus())) {
    return NextResponse.json({ ok: false, error: "Keine Berechtigung." }, { status: 403 });
  }

  try {
    await deleteBug(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/bugs/delete]", e);
    return NextResponse.json(
      { ok: false, error: `Löschen fehlgeschlagen: ${describeDbError(e)}` },
      { status: 500 }
    );
  }
}
