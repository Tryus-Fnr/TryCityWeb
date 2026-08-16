import { NextResponse } from "next/server";
import { getModStatus, getVerifiedSession } from "@/lib/auth";
import { describeDbError } from "@/lib/dbError";
import { cleanMultiline } from "@/lib/feedbackInput";
import {
  deleteSuggestion,
  isSuggestionStatus,
  loadSuggestion,
  suggestionExists,
  updateSuggestionStatus,
} from "@/lib/feedback";

export const dynamic = "force-dynamic";

/**
 * Einen Vorschlag verwalten.
 *
 * PATCH  – Stand, Anmerkung und Duplikat-Verweis setzen (nur Team)
 * DELETE – löschen; das darf das Team, und der Verfasser bei seinem eigenen
 *          (etwa, weil er ihn versehentlich doppelt abgeschickt hat)
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

  let body: { status?: unknown; staffNote?: unknown; duplicateOf?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  const status = String(body.status ?? "");
  if (!isSuggestionStatus(status)) {
    return NextResponse.json({ ok: false, error: "Unbekannter Stand." }, { status: 400 });
  }

  const staffNote = cleanMultiline(String(body.staffNote ?? ""));

  let duplicateOf: number | null = null;
  if (body.duplicateOf !== null && body.duplicateOf !== undefined && body.duplicateOf !== "") {
    const dup = Number(body.duplicateOf);
    if (!Number.isInteger(dup) || dup <= 0) {
      return NextResponse.json({ ok: false, error: "Ungültiger Verweis." }, { status: 400 });
    }
    if (dup === id) {
      return NextResponse.json(
        { ok: false, error: "Ein Vorschlag kann kein Duplikat von sich selbst sein." },
        { status: 400 }
      );
    }
    // Ein Verweis auf eine Nummer, die es nicht gibt, wäre ein toter Link auf
    // der Seite – und niemand merkt es, weil dort nur „#123" steht.
    if (!(await suggestionExists(dup))) {
      return NextResponse.json(
        { ok: false, error: `Vorschlag #${dup} gibt es nicht.` },
        { status: 400 }
      );
    }
    duplicateOf = dup;
  }

  try {
    const affected = await updateSuggestionStatus(id, status, staffNote, duplicateOf);
    if (affected === 0) {
      return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/suggestions/patch]", e);
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

  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "Nicht angemeldet." }, { status: 401 });
  }

  const isMod = await getModStatus();
  const suggestion = await loadSuggestion(id, session.uuid);
  if (!suggestion) {
    return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });
  }
  if (!isMod && suggestion.authorUuid !== session.uuid) {
    return NextResponse.json({ ok: false, error: "Keine Berechtigung." }, { status: 403 });
  }

  try {
    await deleteSuggestion(id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[api/suggestions/delete]", e);
    return NextResponse.json(
      {
        ok: false,
        error: isMod ? `Löschen fehlgeschlagen: ${describeDbError(e)}` : "Löschen fehlgeschlagen.",
      },
      { status: 500 }
    );
  }
}
