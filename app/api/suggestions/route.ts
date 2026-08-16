import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { parseSuggestionInput, readJsonBody } from "@/lib/feedbackInput";
import {
  createSuggestion,
  findSimilarSuggestions,
  isDuplicate,
  loadActiveRestriction,
  recentSubmissions,
  FEEDBACK_QUOTA,
} from "@/lib/feedback";

export const dynamic = "force-dynamic";

/**
 * Einen Vorschlag einreichen.
 *
 * Vier Hürden, bevor etwas in der Datenbank landet:
 *  1. angemeldet, Sitzung nicht widerrufen
 *  2. nicht gebannt oder stummgeschaltet
 *  3. Tagesmenge und Abstand eingehalten
 *  4. kein praktisch identischer Vorschlag – es sei denn, der Einreicher
 *     bestätigt ausdrücklich, dass seiner etwas anderes meint
 */
export async function POST(req: Request) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Zum Einreichen musst du angemeldet sein." },
      { status: 401 }
    );
  }

  // Grobe Klick-Bremse vor allem anderen – die zählt keine Datenbank-Zeilen.
  if (!rateLimit(`suggest:${session.uuid}`, 8, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Zu viele Versuche. Warte einen Moment." },
      { status: 429 }
    );
  }
  if (!rateLimit(`suggest-ip:${clientIp(req)}`, 20, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Zu viele Versuche. Warte einen Moment." },
      { status: 429 }
    );
  }

  const restriction = await loadActiveRestriction(session.uuid);
  if (restriction !== null) {
    return NextResponse.json(
      {
        ok: false,
        error:
          restriction === "BAN"
            ? "Dein Konto ist gesperrt – du kannst nichts einreichen."
            : "Du bist stummgeschaltet – du kannst gerade nichts einreichen.",
      },
      { status: 403 }
    );
  }

  const read = await readJsonBody(req);
  if ("error" in read) return NextResponse.json({ ok: false, error: read.error }, { status: 400 });

  const parsed = parseSuggestionInput(read.body);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }
  const input = parsed.input;

  try {
    const { count, lastAgoSeconds } = await recentSubmissions(
      "smpg_suggestions",
      "author_uuid",
      session.uuid
    );
    if (count >= FEEDBACK_QUOTA.suggestionsPerDay) {
      return NextResponse.json(
        {
          ok: false,
          error: `Du hast heute schon ${FEEDBACK_QUOTA.suggestionsPerDay} Vorschläge eingereicht. Morgen geht es weiter.`,
        },
        { status: 429 }
      );
    }
    if (lastAgoSeconds !== null && lastAgoSeconds < FEEDBACK_QUOTA.cooldownSeconds) {
      const wait = FEEDBACK_QUOTA.cooldownSeconds - lastAgoSeconds;
      return NextResponse.json(
        { ok: false, error: `Bitte warte noch ${wait} Sekunden bis zum nächsten Vorschlag.` },
        { status: 429 }
      );
    }

    // Duplikate: gefunden wird über denselben Weg wie beim Tippen, damit
    // niemand die Prüfung umgeht, indem er das Formular übergeht.
    const similar = await findSimilarSuggestions(input.title, 3);
    if (isDuplicate(similar) && !input.confirmedDuplicate) {
      return NextResponse.json(
        {
          ok: false,
          error: "Diesen Vorschlag gibt es schon fast wortgleich.",
          duplicates: similar,
        },
        { status: 409 }
      );
    }

    const id = await createSuggestion(session.uuid, session.name, input);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    // Der genaue Datenbankfehler bleibt im Log: hier steht ein Spieler am
    // anderen Ende, dem Tabellennamen nichts sagen – und der sie nicht braucht.
    console.error("[api/suggestions]", e);
    return NextResponse.json(
      { ok: false, error: "Der Vorschlag konnte gerade nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
