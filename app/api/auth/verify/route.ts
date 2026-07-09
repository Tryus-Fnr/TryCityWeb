import { NextResponse } from "next/server";
import { exec, query } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { createSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;
const CODE_RE = /^\d{6}$/;

/**
 * Schritt 2 des Minecraft-Logins: Name + ingame erhaltener Code.
 * Gültig nur, wenn das Plugin den Code zugestellt hat (delivered = 1) –
 * dadurch ist sichergestellt, dass wirklich der Spieler dahintersteckt.
 */
export async function POST(req: Request) {
  let body: { name?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  const code = (body.code ?? "").trim();
  if (!NAME_RE.test(name) || !CODE_RE.test(code)) {
    return NextResponse.json(
      { ok: false, error: "Name oder Code ungültig." },
      { status: 400 }
    );
  }

  const ip = clientIp(req);
  if (!rateLimit(`verify:${ip}`, 10, 10 * 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Zu viele Versuche – bitte kurz warten." },
      { status: 429 }
    );
  }

  try {
    const rows = await query<{ id: number; player_name: string; player_uuid: string | null }>(
      `SELECT id, player_name, player_uuid
       FROM smpg_web_login_codes
       WHERE LOWER(player_name) = LOWER(?) AND code = ?
         AND used = 0 AND delivered = 1 AND expires_at > NOW()
       ORDER BY id DESC LIMIT 1`,
      [name, code]
    );

    if (rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: "Code falsch, abgelaufen oder noch nicht ingame zugestellt." },
        { status: 401 }
      );
    }

    // atomar entwerten (Schutz gegen Doppelverwendung)
    const affected = await exec(
      "UPDATE smpg_web_login_codes SET used = 1 WHERE id = ? AND used = 0",
      [rows[0].id]
    );
    if (affected === 0) {
      return NextResponse.json({ ok: false, error: "Code bereits verwendet." }, { status: 401 });
    }

    // player_name/uuid wurden vom Plugin bei Zustellung auf die exakten Werte gesetzt
    await createSession({ name: rows[0].player_name, uuid: rows[0].player_uuid });
    return NextResponse.json({ ok: true, name: rows[0].player_name });
  } catch (e) {
    console.error("[auth/verify]", e);
    return NextResponse.json(
      { ok: false, error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}
