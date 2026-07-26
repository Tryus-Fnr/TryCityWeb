import { NextResponse } from "next/server";
import { getAdminStatus } from "@/lib/auth";
import {
  deleteNewsPost,
  loadNewsImages,
  loadNewsPost,
  updateNewsPost,
} from "@/lib/news";
import { parseNewsInput } from "@/lib/newsInput";
import { describeDbError } from "@/lib/dbError";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

/** Einzelner Beitrag samt Bildern. Entwürfe sehen nur Admins. */
export async function GET(_req: Request, { params }: Params) {
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Unbekannt." }, { status: 400 });

  const isAdmin = await getAdminStatus();
  const post = await loadNewsPost(id, isAdmin);
  if (!post) return NextResponse.json({ ok: false, error: "Nicht gefunden." }, { status: 404 });

  return NextResponse.json({ ok: true, post, images: await loadNewsImages(id) });
}

/** Beitrag bearbeiten (nur Admin). */
export async function PATCH(req: Request, { params }: Params) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Unbekannt." }, { status: 400 });

  const parsed = await parseNewsInput(req);
  if ("error" in parsed) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  try {
    await updateNewsPost(id, parsed.input);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    console.error("[news/update]", e);
    return NextResponse.json(
      { ok: false, error: `Beitrag konnte nicht gespeichert werden: ${describeDbError(e)}` },
      { status: 500 }
    );
  }
}

/** Beitrag löschen (nur Admin). */
export async function DELETE(_req: Request, { params }: Params) {
  if (!(await getAdminStatus())) {
    return NextResponse.json({ ok: false, error: "Nicht erlaubt." }, { status: 403 });
  }
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ ok: false, error: "Unbekannt." }, { status: 400 });

  try {
    const affected = await deleteNewsPost(id);
    return NextResponse.json({ ok: affected > 0 });
  } catch (e) {
    console.error("[news/delete]", e);
    return NextResponse.json(
      { ok: false, error: `Beitrag konnte nicht gelöscht werden: ${describeDbError(e)}` },
      { status: 500 }
    );
  }
}
