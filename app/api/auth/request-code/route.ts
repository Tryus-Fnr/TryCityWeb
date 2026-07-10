import { NextResponse } from "next/server";
import { randomInt } from "crypto";
import { exec } from "@/lib/db";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { isWebLoginDisabled } from "@/lib/queries";

export const dynamic = "force-dynamic";

const NAME_RE = /^[A-Za-z0-9_]{3,16}$/;

/**
 * Schritt 1 des Minecraft-Logins:
 * Web nimmt den Spielernamen entgegen und legt einen 6-stelligen Code in
 * smpg_web_login_codes ab. Das SMPGlobal-Plugin stellt den Code ingame zu –
 * der Code wird hier bewusst NICHT zurückgegeben.
 */
export async function POST(req: Request) {
  let body: { name?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!NAME_RE.test(name)) {
    return NextResponse.json(
      { ok: false, error: "Ungültiger Minecraft-Name." },
      { status: 400 }
    );
  }

  const ip = clientIp(req);
  if (!rateLimit(`req:${ip}`, 5, 10 * 60_000) || !rateLimit(`req:${name.toLowerCase()}`, 2, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Zu viele Anfragen – bitte kurz warten." },
      { status: 429 }
    );
  }

  const code = String(randomInt(100000, 1000000)); // 6-stellig

  try {
    // Prüfen, ob der Spieler den Web-Login deaktiviert hat
    const loginDisabled = await isWebLoginDisabled(name);
    if (loginDisabled) {
      return NextResponse.json(
        { ok: false, error: "Dieser Spieler hat den Web-Login deaktiviert." },
        { status: 403 }
      );
    }

    // alte, unbenutzte Codes für den Namen entwerten
    await exec(
      "UPDATE smpg_web_login_codes SET used = 1 WHERE player_name = ? AND used = 0",
      [name]
    );
    await exec(
      `INSERT INTO smpg_web_login_codes (player_name, code, expires_at)
       VALUES (?, ?, NOW() + INTERVAL 5 MINUTE)`,
      [name, code]
    );
  } catch (e) {
    console.error("[auth/request-code]", e);
    return NextResponse.json(
      { ok: false, error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }

  // Bewusst keine Info, ob der Spieler online ist (kein Namens-Scanning)
  return NextResponse.json({ ok: true });
}
