import { NextResponse } from "next/server";
import {
  loadAllTimeRecord,
  loadGroupLoad,
  loadHourlyPlayers,
  loadPlayerHistogram,
  loadStatsCoverage,
} from "@/lib/queries";
import { buildPatterns, type PlayerInsights } from "@/lib/playerInsights";

export const dynamic = "force-dynamic";

/**
 * Auswertungen über die Spielerzahlen: Rekord, Tages- und Wochenmuster,
 * Verteilung, Last je Servergruppe.
 *
 * Bewusst getrennt von /api/stats/players – das liefert den Verlauf für den
 * gewählten Zeitraum und wird beim Umschalten jedes Mal neu geholt. Die Muster
 * hier hängen an einem eigenen, deutlich größeren Fenster.
 *
 * Der Rekord ist immer über die gesamte Aufzeichnung, unabhängig vom Fenster.
 */

/** Fenster für die Muster-Auswertungen, in Tagen (0 = alles). */
const WINDOWS: Record<string, number> = {
  "30d": 30,
  "90d": 90,
  "365d": 365,
  all: 0,
};

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("window") ?? "90d";
  const key = raw in WINDOWS ? raw : "90d";
  const days = WINDOWS[key];
  const since = days === 0 ? 0 : Date.now() - days * 24 * 3600_000;

  try {
    const [record, coverage, buckets, histogram, groups] = await Promise.all([
      loadAllTimeRecord(),
      loadStatsCoverage(),
      loadHourlyPlayers(since),
      loadPlayerHistogram(since),
      loadGroupLoad(since),
    ]);

    const body: PlayerInsights = {
      ok: true,
      window: key,
      since: days === 0 ? coverage.firstAt : since,
      record,
      coverage,
      histogram,
      groups,
      ...buildPatterns(buckets),
    };
    return NextResponse.json(body);
  } catch (e) {
    console.error("[api/stats/insights]", e);
    return NextResponse.json(
      { ok: false, error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}
