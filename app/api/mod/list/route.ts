import { NextRequest, NextResponse } from "next/server";
import { getModStatus } from "@/lib/auth";
import {
  MOD_CHUNK_SIZE,
  loadRecentAnticheatFlags,
  loadRecentPunishments,
} from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Eine Seite aus einer Mod-Liste.
 *
 * Aufruf: /api/mod/list?kind=mutes&page=2
 *
 * Vorher lud die Seite jede Liste einmal komplett mit Limit 300 – alles darüber
 * war schlicht nicht erreichbar. Jetzt holt das Panel jede Seite einzeln nach.
 */
const KINDS = ["mutes", "warns", "kicks", "anticheat"] as const;
type Kind = (typeof KINDS)[number];

function isKind(v: string): v is Kind {
  return (KINDS as readonly string[]).includes(v);
}

export async function GET(request: NextRequest) {
  if (!(await getModStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht berechtigt." }, { status: 403 });
  }

  const kind = request.nextUrl.searchParams.get("kind") ?? "";
  if (!isKind(kind)) {
    return NextResponse.json({ ok: false, error: "Unbekannte Liste." }, { status: 400 });
  }

  const pageRaw = Number(request.nextUrl.searchParams.get("page") ?? "0");
  const page = Number.isFinite(pageRaw) ? Math.max(0, Math.floor(pageRaw)) : 0;
  const offset = page * MOD_CHUNK_SIZE;

  try {
    const rows =
      kind === "anticheat"
        ? await loadRecentAnticheatFlags(MOD_CHUNK_SIZE, offset)
        : await loadRecentPunishments(
            kind === "mutes" ? "MUTE" : kind === "warns" ? "WARN" : "KICK",
            MOD_CHUNK_SIZE,
            offset
          );
    return NextResponse.json({ ok: true, rows, page, pageSize: MOD_CHUNK_SIZE });
  } catch (e) {
    console.error("[api/mod/list]", e);
    return NextResponse.json({ ok: false, error: "Datenbank nicht erreichbar." }, { status: 500 });
  }
}
