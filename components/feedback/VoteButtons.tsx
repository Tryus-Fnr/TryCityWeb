"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

/**
 * Dafür/Dagegen an einem Vorschlag.
 *
 * Jeder hat höchstens eine Stimme: ein Klick auf die andere Richtung dreht sie
 * um, ein Klick auf die eigene nimmt sie zurück. Wer nicht angemeldet ist,
 * sieht die Zahl, kann aber nicht klicken.
 *
 * Umgeschaltet wird sofort und die Antwort korrigiert das Ergebnis – sonst
 * fühlt sich jeder Klick nach Wartezeit an. Geht die Anfrage schief, springt
 * die Anzeige zurück.
 */
export default function VoteButtons({
  suggestionId,
  initialScore,
  initialOwn,
  loggedIn,
  size = "normal",
}: {
  suggestionId: number;
  initialScore: number;
  initialOwn: number;
  loggedIn: boolean;
  /** „gross" für die Detailseite, „normal" für die Karten der Übersicht. */
  size?: "normal" | "gross";
}) {
  const [score, setScore] = useState(initialScore);
  const [own, setOwn] = useState(initialOwn);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function vote(direction: 1 | -1) {
    if (!loggedIn || busy) return;
    const next = own === direction ? 0 : direction;

    const vorherScore = score;
    const vorherOwn = own;
    setScore(score - own + next);
    setOwn(next);
    setBusy(true);
    setError(null);

    try {
      const res = await fetch(`/api/suggestions/${suggestionId}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: next }),
      });
      const json = await res.json();
      if (!json.ok) {
        setScore(vorherScore);
        setOwn(vorherOwn);
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      setScore(json.score);
      setOwn(json.ownVote);
    } catch {
      setScore(vorherScore);
      setOwn(vorherOwn);
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  const gross = size === "gross";
  const iconClass = gross ? "h-6 w-6" : "h-5 w-5";
  const knopfClass = (aktiv: boolean, farbe: "gruen" | "rot") =>
    `flex items-center justify-center rounded-lg transition-colors ${
      gross ? "h-9 w-9" : "h-7 w-7"
    } ${
      aktiv
        ? farbe === "gruen"
          ? "bg-emerald-400/20 text-emerald-300"
          : "bg-red-400/20 text-red-300"
        : "text-neutral-500 hover:bg-white/[0.06] hover:text-neutral-200"
    } ${!loggedIn ? "cursor-default" : ""}`;

  return (
    <div className="flex flex-col items-center">
      <div
        className={`flex flex-col items-center rounded-xl border border-white/[0.08] bg-white/[0.02] ${
          gross ? "px-1.5 py-2" : "px-1 py-1.5"
        }`}
      >
        <button
          type="button"
          onClick={() => vote(1)}
          disabled={!loggedIn || busy}
          aria-pressed={own === 1}
          aria-label="Dafür stimmen"
          title={loggedIn ? (own === 1 ? "Stimme zurücknehmen" : "Dafür") : "Zum Abstimmen anmelden"}
          className={knopfClass(own === 1, "gruen")}
        >
          <ChevronUp className={iconClass} strokeWidth={2.5} />
        </button>

        <span
          className={`tabular-nums font-bold ${gross ? "py-0.5 text-lg" : "text-sm"} ${
            score > 0 ? "text-emerald-300" : score < 0 ? "text-red-300" : "text-neutral-400"
          }`}
        >
          {score > 0 ? `+${score}` : score}
        </span>

        <button
          type="button"
          onClick={() => vote(-1)}
          disabled={!loggedIn || busy}
          aria-pressed={own === -1}
          aria-label="Dagegen stimmen"
          title={
            loggedIn ? (own === -1 ? "Stimme zurücknehmen" : "Dagegen") : "Zum Abstimmen anmelden"
          }
          className={knopfClass(own === -1, "rot")}
        >
          <ChevronDown className={iconClass} strokeWidth={2.5} />
        </button>
      </div>

      {error && <span className="mt-1 max-w-24 text-center text-[10px] text-red-400">{error}</span>}
    </div>
  );
}
