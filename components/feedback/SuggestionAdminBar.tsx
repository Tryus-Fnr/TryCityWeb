"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { SUGGESTION_STATUS, FEEDBACK_LIMITS, type Suggestion } from "@/lib/feedbackTypes";

/**
 * Team-Werkzeuge an einem Vorschlag: Stand setzen, Anmerkung hinterlassen,
 * als Duplikat auf einen anderen verweisen, löschen.
 *
 * Die Anmerkung ist der wichtigste Teil – „abgelehnt" ohne einen Satz dazu ist
 * für den Einreicher wertlos und für die nächsten drei, die dasselbe vorschlagen,
 * auch.
 */
export default function SuggestionAdminBar({ suggestion }: { suggestion: Suggestion }) {
  const router = useRouter();

  const [status, setStatus] = useState(suggestion.status);
  const [note, setNote] = useState(suggestion.staffNote);
  const [duplicateOf, setDuplicateOf] = useState(
    suggestion.duplicateOf !== null ? String(suggestion.duplicateOf) : ""
  );
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gespeichert, setGespeichert] = useState(false);

  async function speichern() {
    setSaving(true);
    setError(null);
    setGespeichert(false);
    try {
      const res = await fetch(`/api/suggestions/${suggestion.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          staffNote: note,
          duplicateOf: duplicateOf.trim() === "" ? null : Number(duplicateOf),
        }),
      });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      setGespeichert(true);
      router.refresh();
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setSaving(false);
    }
  }

  async function loeschen() {
    if (!confirm(`Vorschlag #${suggestion.id} wirklich löschen?`)) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${suggestion.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      router.push("/vorschlaege");
      router.refresh();
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mt-8 rounded-2xl border border-amber-400/20 bg-amber-400/[0.04] p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-amber-400/80">
        Team-Bereich
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {SUGGESTION_STATUS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(s.id)}
            className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              status === s.id ? "" : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
            }`}
            style={
              status === s.id
                ? {
                    color: s.color,
                    backgroundColor: `${s.color}1F`,
                    boxShadow: `inset 0 0 0 1px ${s.color}55`,
                  }
                : undefined
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {status === "duplikat" && (
        <label className="mt-3 flex items-center gap-2 text-sm text-neutral-300">
          Deckt sich mit Vorschlag&nbsp;#
          <input
            value={duplicateOf}
            onChange={(e) => setDuplicateOf(e.target.value.replace(/[^0-9]/g, ""))}
            inputMode="numeric"
            placeholder="123"
            className="w-24 rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-sm text-neutral-100 outline-none focus:border-amber-400/50"
          />
        </label>
      )}

      <div className="mt-3">
        <div className="flex items-baseline justify-between">
          <label
            htmlFor="staff-note"
            className="text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500"
          >
            Anmerkung (für alle sichtbar)
          </label>
          <span className="text-xs tabular-nums text-neutral-600">
            {note.length}/{FEEDBACK_LIMITS.staffNote}
          </span>
        </div>
        <textarea
          id="staff-note"
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, FEEDBACK_LIMITS.staffNote))}
          rows={3}
          placeholder="Warum geplant, warum abgelehnt, ab wann umgesetzt …"
          className="mt-1.5 w-full resize-y rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2.5 text-sm leading-relaxed text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-amber-400/50"
        />
      </div>

      {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={loeschen}
          disabled={deleting}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-red-400 ring-1 ring-red-400/30 transition-colors hover:bg-red-400/10 disabled:opacity-60"
        >
          {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          Löschen
        </button>

        <div className="flex items-center gap-3">
          {gespeichert && <span className="text-sm text-emerald-400">Gespeichert.</span>}
          <button
            type="button"
            onClick={speichern}
            disabled={saving}
            className="flex items-center gap-2 rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-black transition-colors hover:bg-amber-300 disabled:opacity-60"
          >
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Übernehmen
          </button>
        </div>
      </div>
    </div>
  );
}
