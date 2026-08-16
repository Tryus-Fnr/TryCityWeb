import { NextResponse } from "next/server";
import { getModStatus, getVerifiedSession } from "@/lib/auth";
import { loadBugImage } from "@/lib/feedback";

/**
 * Liefert ein Bild einer Bug-Meldung.
 *
 * Anders als die Beitragsbilder des Blogs ist das hier **nichts Öffentliches**:
 * Screenshots aus Meldungen zeigen regelmäßig Koordinaten, Inventare oder den
 * Weg zu einem Fehler. Sehen darf sie nur der Melder selbst und das Team.
 *
 * Ausgeliefert wird ausschließlich mit dem Typ, der beim Hochladen aus den
 * Kennbytes gelesen wurde, dazu `nosniff` und `Content-Disposition: inline` –
 * selbst wenn es jemand an der Prüfung vorbei schaffen würde, könnte der
 * Browser den Inhalt nicht als Seite ausführen.
 */
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set(["image/webp", "image/png", "image/jpeg"]);

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ungültige id." }, { status: 400 });
  }

  const session = await getVerifiedSession();
  if (!session) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    const img = await loadBugImage(id);
    // Für Unbefugte sieht ein fremdes Bild genauso aus wie ein nicht
    // vorhandenes – sonst ließe sich über die Nummern abklappern, welche
    // Meldungen es gibt.
    if (!img) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    if (img.reporterUuid !== session.uuid && !(await getModStatus())) {
      return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
    }

    const buf = Buffer.from(img.data, "base64");
    const etag = `"bug-img-${id}-${buf.length}"`;
    if (req.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": ALLOWED_MIME.has(img.mime) ? img.mime : "application/octet-stream",
        "Content-Length": String(buf.length),
        "Content-Disposition": "inline",
        "X-Content-Type-Options": "nosniff",
        ETag: etag,
        // private: das Bild hängt an der Sitzung, ein gemeinsamer Zwischenspeicher
        // (nginx, CDN) darf es niemandem sonst ausliefern.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (e) {
    console.error("[api/bugs/image]", e);
    return NextResponse.json({ error: "Bild nicht ladbar." }, { status: 500 });
  }
}
