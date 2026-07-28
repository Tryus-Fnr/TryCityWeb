import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import {
  updateBossBarMessage,
  setBossBarMessageEnabled,
  setBossBarMessagePosition,
  deleteBossBarMessage,
} from "@/lib/bossbar";
import { describeDbError } from "@/lib/dbError";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/**
 * PATCH /api/bossbar/:id
 *   { message: string }           → Text aktualisieren
 *   { enabled: boolean }          → An/Aus umschalten
 *   { position: number }          → Reihenfolge ändern
 */
export async function PATCH(req: Request, { params }: Params) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Unbekannte ID." }, { status: 400 });

  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  try {
    if (typeof body.message === "string") {
      const msg = body.message.trim();
      if (!msg)
        return NextResponse.json({ ok: false, error: "Nachricht darf nicht leer sein." }, { status: 400 });
      if (msg.length > 512)
        return NextResponse.json({ ok: false, error: "Nachricht zu lang (max. 512 Zeichen)." }, { status: 400 });
      await updateBossBarMessage(id, msg);
    } else if (typeof body.enabled === "boolean") {
      await setBossBarMessageEnabled(id, body.enabled);
    } else if (typeof body.position === "number") {
      await setBossBarMessagePosition(id, Math.max(0, Math.floor(body.position)));
    } else {
      return NextResponse.json({ ok: false, error: "Kein bekanntes Feld angegeben." }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[bossbar/update]", e);
    return NextResponse.json({ ok: false, error: describeDbError(e) }, { status: 500 });
  }
}

/** DELETE /api/bossbar/:id */
export async function DELETE(_req: Request, { params }: Params) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Unbekannte ID." }, { status: 400 });

  try {
    await deleteBossBarMessage(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[bossbar/delete]", e);
    return NextResponse.json({ ok: false, error: describeDbError(e) }, { status: 500 });
  }
}

