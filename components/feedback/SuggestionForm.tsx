"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AlertTriangle, Loader2, Search } from "lucide-react";
import {
  SUGGESTION_CATEGORIES,
  FEEDBACK_LIMITS,
  FEEDBACK_QUOTA,
  type SimilarSuggestion,
  type SuggestionCategoryId,
} from "@/lib/feedbackTypes";
import { StatusBadge } from "./FeedbackBadge";

/** Wie lange nach dem letzten Tastenanschlag gewartet wird, bevor gesucht wird. */
const TIPP_PAUSE_MS = 400;

/**
 * Formular für einen neuen Vorschlag.
 *
 * Der eigentliche Kniff steckt im Titelfeld: während des Tippens sucht die
 * Seite nach ähnlichen Vorschlägen und zeigt sie darunter an. Gerechnet wird
 * das serverseitig mit einem Trigramm-Vergleich (`lib/similarity.ts`), nicht
 * mit einer KI – es muss zwischen zwei Tastenanschlägen fertig sein.
 *
 * Ist ein Treffer praktisch wortgleich, lässt sich der Vorschlag erst nach
 * ausdrücklicher Bestätigung abschicken. Blockiert wird nie ganz: manchmal
 * heißt dasselbe eben zweimal ähnlich und meint doch etwas anderes.
 */
export default function SuggestionForm() {
  const router = useRouter();

  const [category, setCategory] = useState<SuggestionCategoryId>("smp");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const [hits, setHits] = useState<SimilarSuggestion[]>([]);
  const [duplicate, setDuplicate] = useState(false);
  /** Titel, zu dem die angezeigten Treffer gehören – daraus folgt „sucht gerade". */
  const [letzteSuche, setLetzteSuche] = useState("");
  /** Titel, für den die Duplikat-Warnung bestätigt wurde. */
  const [confirmedTitle, setConfirmedTitle] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suchtext = title.trim();
  // Beides aus dem Zustand abgeleitet statt in einem Effekt nachgezogen: eine
  // Bestätigung gilt genau dem Titel, für den sie gegeben wurde – wer danach
  // weitertippt, bestätigt automatisch nichts mehr.
  const searching = suchtext.length >= 4 && letzteSuche !== suchtext;
  const confirmed = confirmedTitle !== null && confirmedTitle === suchtext;

  useEffect(() => {
    const gesucht = title.trim();
    let abgebrochen = false;

    const timer = setTimeout(async () => {
      if (gesucht.length < 4) {
        if (!abgebrochen) {
          setHits([]);
          setDuplicate(false);
          setLetzteSuche(gesucht);
        }
        return;
      }
      try {
        const res = await fetch(`/api/suggestions/similar?title=${encodeURIComponent(gesucht)}`);
        const json = await res.json();
        if (abgebrochen) return;
        setHits(Array.isArray(json.hits) ? json.hits : []);
        setDuplicate(json.duplicate === true);
      } catch {
        // Ohne Treffer weitermachen: die Suche ist eine Hilfe, keine Hürde.
        if (abgebrochen) return;
        setHits([]);
        setDuplicate(false);
      } finally {
        // Auch nach einem Fehlschlag: sonst dreht sich die Anzeige ewig.
        if (!abgebrochen) setLetzteSuche(gesucht);
      }
    }, TIPP_PAUSE_MS);

    // Wird während einer laufenden Anfrage weitergetippt, zählt nur noch die
    // neue – die alte Antwort läuft ins Leere.
    return () => {
      abgebrochen = true;
      clearTimeout(timer);
    };
  }, [title]);

  const titleOk =
    suchtext.length >= FEEDBACK_LIMITS.suggestionTitleMin &&
    suchtext.length <= FEEDBACK_LIMITS.suggestionTitleMax;
  const bodyOk =
    body.trim().length >= FEEDBACK_LIMITS.suggestionBodyMin &&
    body.trim().length <= FEEDBACK_LIMITS.suggestionBodyMax;
  const bereit = titleOk && bodyOk && (!duplicate || confirmed) && !saving;

  async function absenden() {
    if (!bereit) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/suggestions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          title: suchtext,
          body: body.trim(),
          confirmDuplicate: confirmed,
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        // Der Server prüft noch einmal selbst – wer das Formular umgeht,
        // bekommt die Treffer hier nachgereicht.
        if (Array.isArray(json.duplicates)) {
          setHits(json.duplicates);
          setDuplicate(true);
        }
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      router.push(`/vorschlaege/${json.id}`);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* ── Bereich ── */}
      <div>
        <label className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
          Bereich
        </label>
        <div className="mt-2 flex flex-wrap gap-2">
          {SUGGESTION_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategory(c.id)}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                category === c.id ? "" : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
              }`}
              style={
                category === c.id
                  ? {
                      color: c.color,
                      backgroundColor: `${c.color}1F`,
                      boxShadow: `inset 0 0 0 1px ${c.color}55`,
                    }
                  : undefined
              }
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Titel ── */}
      <div>
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="vorschlag-titel"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500"
          >
            Titel
          </label>
          <span
            className={`text-xs tabular-nums ${
              title.length > FEEDBACK_LIMITS.suggestionTitleMax
                ? "text-red-400"
                : "text-neutral-600"
            }`}
          >
            {title.length}/{FEEDBACK_LIMITS.suggestionTitleMax}
          </span>
        </div>
        <input
          id="vorschlag-titel"
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, FEEDBACK_LIMITS.suggestionTitleMax))}
          placeholder="Worum geht es? In einem Satz."
          className="mt-2 w-full rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-sky-400/50"
        />

        {/* Suche nach ähnlichen Vorschlägen */}
        <div className="mt-2 min-h-5">
          {searching && (
            <span className="flex items-center gap-1.5 text-xs text-neutral-600">
              <Loader2 className="h-3 w-3 animate-spin" />
              Suche nach ähnlichen Vorschlägen …
            </span>
          )}
          {!searching && hits.length === 0 && title.trim().length >= 4 && (
            <span className="flex items-center gap-1.5 text-xs text-emerald-400/80">
              <Search className="h-3 w-3" />
              Nichts Ähnliches gefunden.
            </span>
          )}
        </div>

        {hits.length > 0 && (
          <div
            className={`mt-1 overflow-hidden rounded-xl border ${
              duplicate ? "border-amber-400/40 bg-amber-400/[0.06]" : "border-white/10 bg-white/[0.02]"
            }`}
          >
            <p className="flex items-center gap-2 border-b border-white/[0.08] px-4 py-2.5 text-xs font-semibold text-neutral-300">
              {duplicate ? (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  Das gibt es fast wortgleich schon
                </>
              ) : (
                <>
                  <Search className="h-4 w-4 shrink-0 text-neutral-500" />
                  Ähnliche Vorschläge – vielleicht ist deiner dabei
                </>
              )}
            </p>
            <ul className="divide-y divide-white/[0.06]">
              {hits.map((h) => (
                <li key={h.id}>
                  <Link
                    href={`/vorschlaege/${h.id}`}
                    target="_blank"
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-white/[0.04]"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm text-neutral-200">
                      {h.title}
                    </span>
                    <StatusBadge status={h.status} />
                    <span className="shrink-0 tabular-nums text-xs text-neutral-500">
                      {h.score > 0 ? `+${h.score}` : h.score}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>

            {duplicate && (
              <label className="flex cursor-pointer items-start gap-2.5 border-t border-white/[0.08] px-4 py-3 text-sm text-neutral-300">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmedTitle(e.target.checked ? suchtext : null)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-sky-400"
                />
                Ich habe nachgesehen – mein Vorschlag meint etwas anderes.
              </label>
            )}
          </div>
        )}
      </div>

      {/* ── Beschreibung ── */}
      <div>
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="vorschlag-text"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500"
          >
            Beschreibung
          </label>
          <span
            className={`text-xs tabular-nums ${
              body.length > FEEDBACK_LIMITS.suggestionBodyMax ? "text-red-400" : "text-neutral-600"
            }`}
          >
            {body.length}/{FEEDBACK_LIMITS.suggestionBodyMax}
          </span>
        </div>
        <textarea
          id="vorschlag-text"
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, FEEDBACK_LIMITS.suggestionBodyMax))}
          rows={8}
          placeholder="Was genau soll sich ändern, und warum wäre das besser? Je klarer, desto eher wird daraus etwas."
          className="mt-2 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-sky-400/50"
        />
      </div>

      {error && (
        <p className="rounded-xl border border-red-400/30 bg-red-400/[0.08] px-4 py-3 text-sm text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-neutral-600">
          Höchstens {FEEDBACK_QUOTA.suggestionsPerDay} Vorschläge pro Tag.
        </p>
        <div className="flex gap-2">
          <Link
            href="/vorschlaege"
            className="rounded-lg px-4 py-2 text-sm font-semibold text-neutral-400 ring-1 ring-white/10 transition-colors hover:bg-white/5"
          >
            Abbrechen
          </Link>
          <button
            type="button"
            onClick={absenden}
            disabled={!bereit}
            className="flex items-center gap-2 rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-sky-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Vorschlag einreichen
          </button>
        </div>
      </div>
    </div>
  );
}
