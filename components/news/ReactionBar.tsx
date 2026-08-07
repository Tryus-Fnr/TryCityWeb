"use client";

import { useState } from "react";
import { REACTIONS, type ReactionCount } from "@/lib/newsTypes";

/**
 * Reaktionsleiste unter einem Beitrag – nur auf der Website, ingame gibt es
 * dafür nichts.
 *
 * Jeder hat höchstens eine Reaktion je Beitrag: ein Klick auf ein anderes Emoji
 * verschiebt sie, ein Klick auf das eigene nimmt sie zurück. Wer nicht
 * angemeldet ist, sieht die Zahlen, kann aber nicht klicken.
 */
export default function ReactionBar({
  postId,
  initialCounts,
  initialOwn,
  loggedIn,
}: {
  postId: number;
  initialCounts: ReactionCount[];
  initialOwn: string | null;
  loggedIn: boolean;
}) {
  const [counts, setCounts] = useState<ReactionCount[]>(initialCounts);
  const [own, setOwn] = useState<string | null>(initialOwn);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const countOf = (emoji: string) => counts.find((c) => c.emoji === emoji)?.count ?? 0;

  async function react(emoji: string) {
    if (!loggedIn || busy) return;
    // Nochmal dasselbe Emoji heißt: Reaktion zurücknehmen.
    const next = own === emoji ? null : emoji;

    // Sofort umschalten, damit der Klick nicht hängt; die Antwort korrigiert.
    const vorherCounts = counts;
    const vorherOwn = own;
    setOwn(next);
    setCounts((prev) => {
      const map = new Map(prev.map((c) => [c.emoji, c.count]));
      if (vorherOwn) map.set(vorherOwn, Math.max(0, (map.get(vorherOwn) ?? 0) - 1));
      if (next) map.set(next, (map.get(next) ?? 0) + 1);
      return [...map.entries()]
        .filter(([, n]) => n > 0)
        .map(([e, n]) => ({ emoji: e, count: n }))
        .sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
    });

    setBusy(emoji);
    setError(null);
    try {
      const res = await fetch(`/api/news/${postId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji: next }),
      });
      const json = await res.json();
      if (!json.ok) {
        setCounts(vorherCounts);
        setOwn(vorherOwn);
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      setCounts(json.counts);
      setOwn(json.own);
    } catch {
      setCounts(vorherCounts);
      setOwn(vorherOwn);
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-10 border-t border-white/[0.06] pt-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-neutral-500">
        Was sagst du dazu?
      </p>

      <div className="flex flex-wrap gap-2">
        {REACTIONS.map((emoji) => {
          const n = countOf(emoji);
          const mine = own === emoji;
          return (
            <button
              key={emoji}
              type="button"
              onClick={() => react(emoji)}
              disabled={!loggedIn || busy !== null}
              aria-pressed={mine}
              title={
                loggedIn
                  ? mine
                    ? "Reaktion zurücknehmen"
                    : "So reagieren"
                  : "Zum Reagieren anmelden"
              }
              className={`flex items-center gap-2 rounded-xl border px-3.5 py-2 text-lg transition-colors ${
                mine
                  ? "border-sky-400/50 bg-sky-400/15"
                  : "border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]"
              } ${!loggedIn ? "cursor-default opacity-70" : "disabled:opacity-60"}`}
            >
              <span>{emoji}</span>
              {n > 0 && (
                <span
                  className={`text-sm font-semibold tabular-nums ${
                    mine ? "text-sky-300" : "text-neutral-400"
                  }`}
                >
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!loggedIn && (
        <p className="mt-3 text-xs text-neutral-600">
          Zum Reagieren musst du angemeldet sein.
        </p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </div>
  );
}
