import { NextResponse } from "next/server";
import { getVerifiedSession } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/ratelimit";
import { findSimilarSuggestions, isDuplicate } from "@/lib/feedback";

export const dynamic = "force-dynamic";

/**
 * Ähnliche Vorschläge zu einem Titel – wird beim Tippen im Formular gefragt.
 *
 * Gerechnet wird lokal über einen zwischengespeicherten Titel-Index
 * (`lib/similarity.ts`), keine KI: das muss zwischen zwei Tastenanschlägen
 * fertig sein und darf nichts kosten.
 *
 * Angemeldeten vorbehalten – nicht weil die Titel geheim wären (sie stehen
 * öffentlich in der Liste), sondern damit die Abfrage nicht zum bequemen Weg
 * wird, den Index dauerhaft abzugrasen.
 */
export async function GET(req: Request) {
  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ ok: true, hits: [], duplicate: false });
  }

  // Beim Tippen wird gedrosselt abgefragt (~1 Anfrage pro 400 ms), das hier
  // greift erst, wenn jemand die Bremse umgeht.
  if (!rateLimit(`similar:${clientIp(req)}`, 120, 60_000)) {
    return NextResponse.json({ ok: true, hits: [], duplicate: false });
  }

  const title = new URL(req.url).searchParams.get("title") ?? "";
  if (title.length > 200) {
    return NextResponse.json({ ok: true, hits: [], duplicate: false });
  }

  const hits = await findSimilarSuggestions(title, 5);
  return NextResponse.json({ ok: true, hits, duplicate: isDuplicate(hits) });
}
