import { NextResponse } from "next/server";
import { loadServersNow } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Nur die aktuelle Spielerzahl – für die Anzeige am Beitreten-Knopf.
 *
 * Bewusst getrennt von /api/stats/players: das liefert zusätzlich den ganzen
 * Verlauf, und dafür lädt niemand die Startseite.
 *
 * Proxies stecken hier nicht mit drin – die schreibt der ServerStatisticsManager
 * gar nicht erst in server_statistics, sonst wäre jeder Spieler doppelt gezählt.
 */
export async function GET() {
  try {
    const servers = await loadServersNow();
    const online = servers.reduce((sum, s) => sum + s.online, 0);
    return NextResponse.json({ ok: true, online });
  } catch (e) {
    console.error("[api/stats/online]", e);
    // Kein Fehlerstatus: die Startseite soll deswegen nichts Rotes zeigen,
    // die Anzeige bleibt in dem Fall einfach weg.
    return NextResponse.json({ ok: false, online: 0 });
  }
}
