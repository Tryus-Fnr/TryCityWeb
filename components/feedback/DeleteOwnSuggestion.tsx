"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";

/**
 * „Meinen Vorschlag zurückziehen" – nur für den Verfasser selbst.
 *
 * Bewusst schlicht und weit unten: das ist kein Knopf, den man aus Versehen
 * treffen soll, und die Stimmen der anderen sind danach weg.
 */
export default function DeleteOwnSuggestion({ suggestionId }: { suggestionId: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loeschen() {
    if (!confirm("Deinen Vorschlag wirklich zurückziehen? Die Stimmen dazu gehen verloren.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/suggestions/${suggestionId}`, { method: "DELETE" });
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
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 border-t border-white/[0.06] pt-4">
      <button
        type="button"
        onClick={loeschen}
        disabled={busy}
        className="flex items-center gap-2 text-sm text-neutral-500 transition-colors hover:text-red-400 disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
        Vorschlag zurückziehen
      </button>
      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
    </div>
  );
}
