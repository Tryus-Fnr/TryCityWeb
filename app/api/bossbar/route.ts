import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { loadBossBarMessages, loadBossBarConfig, addBossBarMessage } from "@/lib/bossbar";
import { describeDbError } from "@/lib/dbError";

export const dynamic = "force-dynamic";

/**
 * GET  /api/bossbar   alle Nachrichten + Konfiguration (nur Admin)
 * POST /api/bossbar   neue Nachricht anlegen (nur Admin)
 */
export async function GET() {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }
  const [messages, config] = await Promise.all([
    loadBossBarMessages(),
    loadBossBarConfig(),
  ]);
  return NextResponse.json({ ok: true, messages, config });
}

export async function POST(req: Request) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const message = String(body?.message ?? "").trim();

  if (!message)
    return NextResponse.json({ ok: false, error: "Nachricht darf nicht leer sein." }, { status: 400 });
  if (message.length > 512)
    return NextResponse.json({ ok: false, error: "Nachricht zu lang (max. 512 Zeichen)." }, { status: 400 });

  const position = Number.isFinite(Number(body?.position)) ? Number(body?.position) : 0;

  try {
    const id = await addBossBarMessage(message, position);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[bossbar/create]", e);
    return NextResponse.json({ ok: false, error: describeDbError(e) }, { status: 500 });
  }
}

