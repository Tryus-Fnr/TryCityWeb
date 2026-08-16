"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Search, Trash2 } from "lucide-react";
import { BUG_PRIORITIES, type BugReport } from "@/lib/feedbackTypes";
import { normalizeText } from "@/lib/similarity";
import BugItem from "./BugItem";

const PAGE_SIZE = 15;

/**
 * Alle Bug-Meldungen für das Team, mit denselben Stellschrauben wie im GUI
 * ingame: Priorität 0–3 und offen/erledigt. Beides schreibt in dieselben
 * Spalten – wer hier etwas umstellt, sieht es im Spiel sofort und umgekehrt.
 *
 * Was es nur hier gibt, sind die Bilder: die kann Minecraft nicht anzeigen.
 */
export default function BugAdminList({ bugs }: { bugs: BugReport[] }) {
  const [nurOffen, setNurOffen] = useState(true);
  const [suche, setSuche] = useState("");
  const [page, setPage] = useState(0);

  const gefiltert = useMemo(() => {
    const q = normalizeText(suche);
    return bugs.filter((b) => {
      if (nurOffen && b.status === 1) return false;
      if (q.length > 0) {
        const heu = normalizeText(`${b.title} ${b.description} ${b.reporterName}`);
        if (!q.split(" ").every((teil) => heu.includes(teil))) return false;
      }
      return true;
    });
  }, [bugs, nurOffen, suche]);

  const pageCount = Math.max(1, Math.ceil(gefiltert.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const shown = gefiltert.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  const offen = bugs.filter((b) => b.status === 0).length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <input
            value={suche}
            onChange={(e) => {
              setSuche(e.target.value);
              setPage(0);
            }}
            placeholder="Meldungen durchsuchen …"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-sky-400/50"
          />
        </div>
        <button
          type="button"
          onClick={() => {
            setNurOffen((v) => !v);
            setPage(0);
          }}
          className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
            nurOffen
              ? "bg-red-400/15 text-red-300 ring-1 ring-red-400/40"
              : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
          }`}
        >
          {nurOffen ? `Nur offene (${offen})` : `Alle (${bugs.length})`}
        </button>
      </div>

      {gefiltert.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-12 text-center text-sm text-neutral-500">
          Keine Meldung gefunden.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {shown.map((bug) => (
              <BugItem key={bug.id} bug={bug} zeigeMelder aktionen={<BugAktionen bug={bug} />} />
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex flex-wrap justify-end gap-1.5">
              {Array.from({ length: pageCount }, (_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setPage(i);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                  aria-current={i === safePage ? "page" : undefined}
                  className={`min-w-9 rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    i === safePage
                      ? "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40"
                      : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Priorität, erledigt-Schalter und Löschen zu einer Meldung. */
function BugAktionen({ bug }: { bug: BugReport }) {
  const router = useRouter();
  const [priority, setPriority] = useState(bug.priority);
  const [status, setStatus] = useState(bug.status);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function speichern(neuePrio: number, neuerStatus: number) {
    const vorherPrio = priority;
    const vorherStatus = status;
    setPriority(neuePrio);
    setStatus(neuerStatus);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bugs/${bug.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priority: neuePrio, status: neuerStatus }),
      });
      const json = await res.json();
      if (!json.ok) {
        setPriority(vorherPrio);
        setStatus(vorherStatus);
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      router.refresh();
    } catch {
      setPriority(vorherPrio);
      setStatus(vorherStatus);
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  async function loeschen() {
    if (!confirm(`Meldung #${bug.id} samt Bildern löschen?`)) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/bugs/${bug.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!json.ok) {
        setError(json.error ?? "Das hat nicht geklappt.");
        return;
      }
      router.refresh();
    } catch {
      setError("Server nicht erreichbar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-neutral-600">Priorität</span>
      {BUG_PRIORITIES.map((p) => (
        <button
          key={p.value}
          type="button"
          disabled={busy}
          onClick={() => speichern(p.value, status)}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
            priority === p.value ? "" : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
          }`}
          style={
            priority === p.value
              ? {
                  color: p.color,
                  backgroundColor: `${p.color}1F`,
                  boxShadow: `inset 0 0 0 1px ${p.color}55`,
                }
              : undefined
          }
        >
          {p.label}
        </button>
      ))}

      <span className="mx-1 h-4 w-px bg-white/10" />

      <button
        type="button"
        disabled={busy}
        onClick={() => speichern(priority, status === 1 ? 0 : 1)}
        className={`flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold transition-colors disabled:opacity-60 ${
          status === 1
            ? "bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/40"
            : "text-neutral-300 ring-1 ring-white/15 hover:bg-white/5"
        }`}
      >
        {busy && <Loader2 className="h-3 w-3 animate-spin" />}
        {status === 1 ? "Erledigt" : "Als erledigt markieren"}
      </button>

      <button
        type="button"
        disabled={busy}
        onClick={loeschen}
        aria-label="Meldung löschen"
        className="ml-auto flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold text-neutral-500 transition-colors hover:bg-red-400/10 hover:text-red-400 disabled:opacity-60"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Löschen
      </button>

      {error && <span className="w-full text-xs text-red-400">{error}</span>}
    </div>
  );
}
