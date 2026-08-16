import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { rateLimit } from "@/lib/ratelimit";
import {
  loadActiveRestriction,
  loadVoteState,
  setSuggestionVote,
  suggestionExists,
} from "@/lib/feedback";

export const dynamic = "force-dynamic";

/**
 * Für oder gegen einen Vorschlag stimmen.
 *
 * `value`: 1 = dafür, −1 = dagegen, 0 = Stimme zurücknehmen. Mehr als eine
 * Stimme je Person und Vorschlag kann gar nicht entstehen – das stellt schon
 * der Primärschlüssel (suggestion_id, uuid) sicher, unabhängig davon, was hier
 * ankommt.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ ok: false, error: "Ungültige id." }, { status: 400 });
  }

  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Zum Abstimmen musst du angemeldet sein." },
      { status: 401 }
    );
  }

  // Abstimmen ist billig und wird oft geklickt – deshalb großzügiger als beim
  // Einreichen, aber nicht offen für ein Skript.
  if (!rateLimit(`vote:${session.uuid}`, 60, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Zu viele Stimmen auf einmal. Warte einen Moment." },
      { status: 429 }
    );
  }

  if ((await loadActiveRestriction(session.uuid)) !== null) {
    return NextResponse.json(
      { ok: false, error: "Dein Konto ist gesperrt – du kannst nicht abstimmen." },
      { status: 403 }
    );
  }

  let body: { value?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const raw = Number(body.value);
  if (![1, 0, -1].includes(raw)) {
    return NextResponse.json({ ok: false, error: "Ungültige Stimme." }, { status: 400 });
  }

  try {
    if (!(await suggestionExists(id))) {
      return NextResponse.json(
        { ok: false, error: "Diesen Vorschlag gibt es nicht (mehr)." },
        { status: 404 }
      );
    }
    await setSuggestionVote(id, session.uuid, raw);
    const state = await loadVoteState(id, session.uuid);
    return NextResponse.json({ ok: true, ...state });
  } catch (e) {
    console.error("[api/suggestions/vote]", e);
    return NextResponse.json(
      { ok: false, error: "Die Stimme konnte nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
