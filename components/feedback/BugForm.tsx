"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { FEEDBACK_LIMITS, FEEDBACK_QUOTA } from "@/lib/feedbackTypes";

/**
 * Formular für eine Bug-Meldung.
 *
 * Bilder werden **im Browser** verkleinert und neu kodiert, bevor sie
 * überhaupt losgeschickt werden: auf {@link FEEDBACK_LIMITS.bugImageEdge}
 * Pixel Kantenlänge und danach so weit in der Qualität herunter, bis der
 * Datenkopf unter die erlaubte Größe passt. Das hat drei Gründe:
 *
 *  - Ein Handy-Foto mit 12 MB muss gar nicht erst durch die Leitung.
 *  - Beim Neuzeichnen auf eine Leinwand bleibt nur das Bild übrig – alles
 *    andere in der Datei (Aufnahmeort, eingebettete Nutzdaten) fällt weg.
 *  - Was hier ankommt, ist immer WebP oder JPEG; der Server prüft das
 *    trotzdem noch einmal an den Kennbytes.
 */

/** Was der Dateiauswahl-Dialog überhaupt anbietet. */
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif";

/** Größere Dateien werden gar nicht erst eingelesen. */
const MAX_DATEI_BYTES = 12 * 1024 * 1024;

type Anhang = { id: number; dataUrl: string; name: string };

export default function BugForm() {
  const router = useRouter();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [bilder, setBilder] = useState<Anhang[]>([]);
  const [verarbeite, setVerarbeite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fertig, setFertig] = useState(false);

  async function bildHinzufuegen(file: File) {
    if (bilder.length >= FEEDBACK_LIMITS.bugImages) {
      setError(`Mehr als ${FEEDBACK_LIMITS.bugImages} Bilder gehen nicht.`);
      return;
    }
    if (!file.type.startsWith("image/")) {
      setError("Das ist kein Bild.");
      return;
    }
    if (file.size > MAX_DATEI_BYTES) {
      setError("Die Datei ist zu groß (über 12 MB). Bitte vorher zuschneiden.");
      return;
    }

    setVerarbeite(true);
    setError(null);
    try {
      const dataUrl = await verkleinern(file);
      setBilder((prev) => [...prev, { id: Date.now() + prev.length, dataUrl, name: file.name }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Das Bild konnte nicht verarbeitet werden.");
    } finally {
      setVerarbeite(false);
    }
  }

  const titleOk =
    title.trim().length >= FEEDBACK_LIMITS.bugTitleMin &&
    title.trim().length <= FEEDBACK_LIMITS.bugTitleMax;
  const descOk =
    description.trim().length >= FEEDBACK_LIMITS.bugBodyMin &&
    description.trim().length <= FEEDBACK_LIMITS.bugBodyMax;
  const bereit = titleOk && descOk && !saving && !verarbeite;

  async function absenden() {
    if (!bereit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/bugs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          images: bilder.map((b) => b.dataUrl),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      setTitle("");
      setDescription("");
      setBilder([]);
      setFertig(true);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setSaving(false);
    }
  }

  if (fertig) {
    return (
      <div className="rounded-xl border border-emerald-400/30 bg-emerald-400/[0.07] px-4 py-5 text-center">
        <p className="font-semibold text-emerald-300">Danke, die Meldung ist angekommen.</p>
        <p className="mt-1 text-sm text-neutral-400">
          Sie steht jetzt unten in deiner Liste. Das Team sieht sie im Spiel und hier.
        </p>
        <button
          type="button"
          onClick={() => setFertig(false)}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-neutral-300 ring-1 ring-white/15 transition-colors hover:bg-white/5"
        >
          Noch einen Fehler melden
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Titel ── */}
      <div>
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="bug-titel"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500"
          >
            Titel
          </label>
          <span
            className={`text-xs tabular-nums ${
              title.length > FEEDBACK_LIMITS.bugTitleMax ? "text-red-400" : "text-neutral-600"
            }`}
          >
            {title.length}/{FEEDBACK_LIMITS.bugTitleMax}
          </span>
        </div>
        <input
          id="bug-titel"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, FEEDBACK_LIMITS.bugTitleMax))}
          placeholder="Kurz: was ist kaputt?"
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-red-400/50"
        />
      </div>

      {/* ── Beschreibung ── */}
      <div>
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="bug-text"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500"
          >
            Was ist passiert?
          </label>
          <span
            className={`text-xs tabular-nums ${
              description.length > FEEDBACK_LIMITS.bugBodyMax ? "text-red-400" : "text-neutral-600"
            }`}
          >
            {description.length}/{FEEDBACK_LIMITS.bugBodyMax}
          </span>
        </div>
        <textarea
          id="bug-text"
          value={description}
          onChange={(e) => setDescription(e.target.value.slice(0, FEEDBACK_LIMITS.bugBodyMax))}
          rows={9}
          placeholder={
            "Wo war das (Server, Welt, Koordinaten)?\nWas hast du gemacht?\nWas ist stattdessen passiert?\nKannst du es wiederholen?"
          }
          className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-red-400/50"
        />
      </div>

      {/* ── Bilder ── */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
          Screenshots (bis {FEEDBACK_LIMITS.bugImages})
        </label>

        <div className="mt-2 flex flex-wrap gap-3">
          {bilder.map((b) => (
            <div
              key={b.id}
              className="relative h-24 w-32 overflow-hidden rounded-lg border border-white/10 bg-black/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={b.dataUrl} alt={b.name} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => setBilder((prev) => prev.filter((x) => x.id !== b.id))}
                aria-label="Bild entfernen"
                className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/70 text-neutral-300 transition-colors hover:bg-black hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}

          {bilder.length < FEEDBACK_LIMITS.bugImages && (
            <label
              className={`flex h-24 w-32 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-white/15 text-neutral-500 transition-colors hover:border-white/30 hover:text-neutral-300 ${
                verarbeite ? "pointer-events-none opacity-60" : ""
              }`}
            >
              {verarbeite ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <ImagePlus className="h-5 w-5" />
              )}
              <span className="text-xs">{verarbeite ? "verkleinere …" : "Bild wählen"}</span>
              <input
                type="file"
                accept={ACCEPT}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  // Zurücksetzen, sonst löst dieselbe Datei kein zweites Mal aus.
                  e.target.value = "";
                  if (file) void bildHinzufuegen(file);
                }}
              />
            </label>
          )}
        </div>
        <p className="mt-2 text-xs text-neutral-600">
          Bilder werden automatisch auf {FEEDBACK_LIMITS.bugImageEdge} Pixel verkleinert – du
          musst nichts vorbereiten. Sie sehen nur du und das Team.
        </p>
      </div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-600">
          Höchstens {FEEDBACK_QUOTA.bugsPerDay} Meldungen pro Tag.
        </p>
        <button
          type="button"
          onClick={absenden}
          disabled={!bereit}
          className="flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
        >
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          Fehler melden
        </button>
      </div>
    </div>
  );
}

/**
 * Verkleinert ein Bild und gibt es als Daten-URL zurück.
 *
 * Die Qualität wird so lange gesenkt, bis das Ergebnis unter die Grenze passt.
 * Kann der Browser kein WebP schreiben (ältere Safari-Versionen liefern dann
 * stillschweigend PNG), wird auf JPEG ausgewichen – beides erlaubt der Server.
 */
async function verkleinern(file: File): Promise<string> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Das Bild konnte nicht gelesen werden.");
  }

  const faktor = Math.min(1, FEEDBACK_LIMITS.bugImageEdge / Math.max(bitmap.width, bitmap.height));
  const breite = Math.max(1, Math.round(bitmap.width * faktor));
  const hoehe = Math.max(1, Math.round(bitmap.height * faktor));

  const canvas = document.createElement("canvas");
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Das Bild konnte nicht verarbeitet werden.");
  ctx.drawImage(bitmap, 0, 0, breite, hoehe);
  bitmap.close();

  for (const q of [0.82, 0.7, 0.55, 0.4]) {
    let url = canvas.toDataURL("image/webp", q);
    if (!url.startsWith("data:image/webp")) url = canvas.toDataURL("image/jpeg", q);
    // Die Grenze gilt für den reinen Base64-Teil, so prüft es auch der Server.
    const daten = url.slice(url.indexOf(",") + 1);
    if (daten.length <= FEEDBACK_LIMITS.bugImageData) return url;
  }
  throw new Error("Das Bild bleibt auch verkleinert zu groß. Bitte einen Ausschnitt wählen.");
}
