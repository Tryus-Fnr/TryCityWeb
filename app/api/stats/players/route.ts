import { NextResponse } from "next/server";
import { loadPeak, loadPlayerHistory, loadServersNow } from "@/lib/queries";

export const dynamic = "force-dynamic";

/** Zeitraum → [Rückblick in ms, Bucket-Größe in ms] */
const RANGES: Record<string, [number, number]> = {
  "24h": [24 * 3600_000, 5 * 60_000], // Roh-Auflösung (5-Min-Snapshots)
  "7d": [7 * 24 * 3600_000, 3600_000], // Stunden-Durchschnitt
  "30d": [30 * 24 * 3600_000, 6 * 3600_000], // 6-Stunden-Durchschnitt
};

export async function GET(req: Request) {
  const range = new URL(req.url).searchParams.get("range") ?? "24h";
  const [lookback, bucket] = RANGES[range] ?? RANGES["24h"];
  const since = Date.now() - lookback;

  try {
    const [points, servers, peak] = await Promise.all([
      loadPlayerHistory(since, bucket),
      loadServersNow(),
      loadPeak(since),
    ]);
    const current = servers.reduce((sum, s) => sum + s.online, 0);
    return NextResponse.json({ ok: true, points, servers, peak, current });
  } catch (e) {
    console.error("[api/stats/players]", e);
    return NextResponse.json(
      { ok: false, points: [], servers: [], peak: 0, current: 0, error: "Datenbank nicht erreichbar." },
      { status: 500 }
    );
  }
}
