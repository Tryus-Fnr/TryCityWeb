import { NextResponse } from "next/server";
import { query } from "@/lib/db";

/**
 * Liefert ein Beitragsbild als echte Bilddatei.
 *
 * In der Datenbank liegen die Bilder base64-kodiert. Sie direkt in die
 * Beitragsliste zu packen wäre bei zwölf Karten schnell im
 * zweistelligen Megabyte-Bereich – deshalb dieser Weg, den der Browser
 * zusätzlich zwischenspeichern kann.
 *
 * Bilder gehören immer zu einem veröffentlichten Beitrag; Entwürfe sind hier
 * bewusst nicht erreichbar, sonst wären unveröffentlichte Bilder über eine
 * geratene Nummer abrufbar.
 */
export const dynamic = "force-dynamic";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige id." }, { status: 400 });
  }

  try {
    const rows = await query<{ mime: string; data: string }>(
      `SELECT i.mime, i.data
       FROM smpg_news_images i
       JOIN smpg_news n ON n.id = i.post_id
       WHERE i.id = ? AND n.published = 1
       LIMIT 1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Bild nicht gefunden." }, { status: 404 });
    }

    const buf = Buffer.from(rows[0].data, "base64");
    const etag = `"news-img-${id}-${buf.length}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": rows[0].mime || "image/png",
        "Content-Length": String(buf.length),
        ETag: etag,
        // Ein Beitragsbild ändert sich praktisch nie; wird es ersetzt, bekommt
        // es beim Speichern ohnehin eine neue id.
        "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
      },
    });
  } catch (e) {
    console.error("[api/news/image]", e);
    return NextResponse.json({ error: "Bild nicht ladbar." }, { status: 500 });
  }
}
