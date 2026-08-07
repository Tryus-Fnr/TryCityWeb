import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { isSessionRevoked } from "@/lib/queries";
import { loadPostReactions, setPostReaction } from "@/lib/news";
import { isReaction } from "@/lib/newsTypes";
import { describeDbError } from "@/lib/dbError";

export const dynamic = "force-dynamic";

/**
 * Reaktionen auf einen Blog-Beitrag.
 *
 * GET  → Anzahl je Emoji und die eigene Reaktion
 * POST → eigene Reaktion setzen, ändern oder mit `emoji: null` zurücknehmen
 *
 * Reagieren geht nur angemeldet; jeder hat höchstens eine Reaktion je Beitrag.
 * Das stellt schon der Primärschlüssel der Tabelle sicher, unabhängig davon,
 * was hier ankommt.
 */

/** Angemeldete UUID, oder null. Widerrufene Sitzungen zählen als abgemeldet. */
async function currentUuid(): Promise<string | null> {
  const session = await getSession();
  if (!session?.uuid) return null;
  try {
    if (await isSessionRevoked(session.uuid, session.issuedAt)) return null;
  } catch {
    return null;
  }
  return session.uuid;
}

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "Ungültige id." }, { status: 400 });
  }
  const uuid = await currentUuid();
  const { counts, own } = await loadPostReactions(id, uuid);
  return NextResponse.json({ ok: true, counts, own, loggedIn: uuid !== null });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = parseId((await params).id);
  if (id === null) {
    return NextResponse.json({ ok: false, error: "Ungültige id." }, { status: 400 });
  }

  const uuid = await currentUuid();
  if (uuid === null) {
    return NextResponse.json(
      { ok: false, error: "Zum Reagieren musst du angemeldet sein." },
      { status: 401 }
    );
  }

  let body: { emoji?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const raw = body.emoji;
  let emoji: string | null;
  if (raw === null || raw === undefined || raw === "") {
    emoji = null;
  } else if (typeof raw === "string" && isReaction(raw)) {
    emoji = raw;
  } else {
    return NextResponse.json({ ok: false, error: "Unbekannte Reaktion." }, { status: 400 });
  }

  try {
    await setPostReaction(id, uuid, emoji);
    const { counts, own } = await loadPostReactions(id, uuid);
    return NextResponse.json({ ok: true, counts, own, loggedIn: true });
  } catch (e) {
    console.error("[news/reactions]", e);
    return NextResponse.json(
      { ok: false, error: `Reaktion konnte nicht gespeichert werden: ${describeDbError(e)}` },
      { status: 500 }
    );
  }
}
