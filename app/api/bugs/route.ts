import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { parseBugInput, readJsonBody } from "@/lib/feedbackInput";
import { createBug, loadActiveRestriction, recentSubmissions, FEEDBACK_QUOTA } from "@/lib/feedback";

export const dynamic = "force-dynamic";

/**
 * Einen Bug melden.
 *
 * Schreibt in dieselbe Tabelle `smpg_bugs`, aus der das Admin-GUI ingame liest
 * (`/bug admin`). Bilder gibt es nur hier – ingame steht in der Übersicht nur,
 * wie viele es sind.
 *
 * Dieselben Hürden wie beim Vorschlag, zusätzlich die Bildprüfung in
 * `lib/feedbackInput.ts`: Kennbytes, Bildpunkte, Anzahl, Größe.
 */
export async function POST(req: Request) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json(
      { ok: false, error: "Zum Melden musst du angemeldet sein." },
      { status: 401 }
    );
  }

  if (!rateLimit(`bug:${session.uuid}`, 8, 60_000)) {
    return NextResponse.json(
      { ok: false, error: "Zu viele Versuche. Warte einen Moment." },
      { status: 429 }
    );
  }
  if (!rateLimit(`bug-ip:${clientIp(req)}`, 20, 60_000)) {
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
            ? "Dein Konto ist gesperrt – du kannst nichts melden."
            : "Du bist stummgeschaltet – du kannst gerade nichts melden.",
      },
      { status: 403 }
    );
  }

  const read = await readJsonBody(req);
  if ("error" in read) return NextResponse.json({ ok: false, error: read.error }, { status: 400 });

  const parsed = parseBugInput(read.body);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    const { count, lastAgoSeconds } = await recentSubmissions(
      "smpg_bugs",
      "reporter_uuid",
      session.uuid
    );
    if (count >= FEEDBACK_QUOTA.bugsPerDay) {
      return NextResponse.json(
        {
          ok: false,
          error: `Du hast heute schon ${FEEDBACK_QUOTA.bugsPerDay} Fehler gemeldet. Morgen geht es weiter.`,
        },
        { status: 429 }
      );
    }
    if (lastAgoSeconds !== null && lastAgoSeconds < FEEDBACK_QUOTA.cooldownSeconds) {
      const wait = FEEDBACK_QUOTA.cooldownSeconds - lastAgoSeconds;
      return NextResponse.json(
        { ok: false, error: `Bitte warte noch ${wait} Sekunden bis zur nächsten Meldung.` },
        { status: 429 }
      );
    }

    const id = await createBug(session.uuid, session.name, parsed.input);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[api/bugs]", e);
    return NextResponse.json(
      { ok: false, error: "Die Meldung konnte gerade nicht gespeichert werden." },
      { status: 500 }
    );
  }
}
