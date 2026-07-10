import { inflateSync } from "node:zlib";
import { NextRequest, NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import { loadMapPixels } from "@/lib/queries";
import { renderMapPng, MAP_PIXEL_COUNT } from "@/lib/mapRender";

export const dynamic = "force-dynamic";

/**
 * Rendert den Pixel-Snapshot einer Karte als 128×128-PNG.
 * Aufruf: /api/maps/image?server=<origin_server>&id=<origin_map_id>
 * Nur für Admins. Cache über ETag (pixel_hash).
 */
export async function GET(request: NextRequest) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }

  const server = request.nextUrl.searchParams.get("server");
  const idRaw = request.nextUrl.searchParams.get("id");
  const id = idRaw !== null ? Number.parseInt(idRaw, 10) : NaN;
  if (!server || !Number.isFinite(id)) {
    return NextResponse.json({ ok: false, error: "server/id fehlt." }, { status: 400 });
  }

  try {
    const row = await loadMapPixels(server, id);
    if (row === null) {
      return NextResponse.json({ ok: false, error: "Karte nicht gefunden." }, { status: 404 });
    }

    const etag = `"${server}-${id}-${row.pixelHash}"`;
    if (request.headers.get("if-none-match") === etag) {
      return new NextResponse(null, { status: 304, headers: { ETag: etag } });
    }

    const pixels = inflateSync(row.pixels);
    if (pixels.length < MAP_PIXEL_COUNT) {
      return NextResponse.json({ ok: false, error: "Pixel-Daten defekt." }, { status: 500 });
    }

    const png = renderMapPng(pixels);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
        ETag: etag,
      },
    });
  } catch (e) {
    console.error("[api/maps/image]", e);
    return NextResponse.json({ ok: false, error: "Render-Fehler." }, { status: 500 });
  }
}
