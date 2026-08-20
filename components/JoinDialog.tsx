"use client";

import { useEffect, useState } from "react";
import { Check, Copy, X } from "lucide-react";

/**
 * Knopf im Banner mit der Server-Adresse; ein Klick öffnet ein Fenster mit den
 * Verbindungsdaten für Java und Bedrock.
 *
 * Die Bedrock-Verknüpfung trägt den Server in die Serverliste ein
 * (`minecraft://`). Ob das klappt, hängt am Gerät – deshalb stehen Adresse und
 * Port immer auch zum Abschreiben da.
 */

const JAVA_ADDRESS = "trycity.net";
const BEDROCK_ADDRESS = "bedrock.trycity.net";
const BEDROCK_PORT = "19132";
const VERSION = "26.1.2+";

type Edition = "java" | "bedrock";

export default function JoinDialog() {
  const [open, setOpen] = useState(false);
  const [edition, setEdition] = useState<Edition>("java");
  const [online, setOnline] = useState<number | null>(null);

  // Spielerzahl für die Anzeige am Knopf. Schlägt es fehl, bleibt die Anzeige
  // weg – lieber gar keine Zahl als eine falsche.
  useEffect(() => {
    let abgebrochen = false;
    const laden = () =>
      fetch("/api/stats/online")
        .then((r) => r.json())
        .then((d) => {
          if (!abgebrochen && d.ok) setOnline(Number(d.online) || 0);
        })
        .catch(() => {});
    laden();
    const t = setInterval(laden, 60_000);
    return () => {
      abgebrochen = true;
      clearInterval(t);
    };
  }, []);

  // Mit Escape schließen und das Wegscrollen hinter dem Fenster unterbinden.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <>
      <div className="relative mt-8 inline-block">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="group inline-flex items-center gap-3 rounded-xl border border-white/20 bg-white/10 px-6 py-3.5 backdrop-blur-sm transition-colors hover:border-sky-400/50 hover:bg-sky-400/15"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-300">
            Jetzt beitreten
          </span>
          <span className="font-mono text-base font-semibold text-white sm:text-lg">
            {JAVA_ADDRESS}
          </span>
        </button>

        {/* Spielerzahl als Plakette an der oberen rechten Ecke. */}
        {online !== null && (
          <span className="pointer-events-none absolute -right-2 -top-2.5 inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 shadow-lg backdrop-blur-sm">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70 motion-reduce:animate-none" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
            </span>
            {online} online
          </span>
        )}
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Server beitreten"
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Hintergrund abdunkeln; Klick daneben schließt das Fenster. */}
          <button
            type="button"
            aria-label="Schließen"
            onClick={() => setOpen(false)}
            className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
          />

          <div className="relative z-10 w-full max-w-md rounded-2xl border border-white/10 bg-[#111113] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <h2 className="text-xl font-bold">Trete TryCity bei</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Schließen"
                className="rounded-lg p-1.5 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Auswahl der Edition */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {(["java", "bedrock"] as const).map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEdition(e)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                    edition === e
                      ? "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40"
                      : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
                  }`}
                >
                  {e === "java" ? "Java Edition" : "Bedrock Edition"}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-3">
              <Field label="Serveradresse" value={edition === "java" ? JAVA_ADDRESS : BEDROCK_ADDRESS} />
              {edition === "bedrock" && <Field label="Port" value={BEDROCK_PORT} />}
              <Field label="Version" value={VERSION} copyable={false} />
            </div>

            {edition === "bedrock" && (
              <a
                href={`minecraft://?addExternalServer=TryCity|${BEDROCK_ADDRESS}:${BEDROCK_PORT}`}
                className="mt-4 block rounded-xl bg-sky-500/90 px-4 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-sky-400"
              >
                In Minecraft öffnen
              </a>
            )}

            <p className="mt-4 text-xs leading-relaxed text-neutral-600">
              {edition === "java"
                ? "Im Spiel unter Mehrspieler → Server hinzufügen eintragen."
                : "Klappt die Verknüpfung nicht, trage Adresse und Port von Hand als externen Server ein."}
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** Beschriftetes Feld mit Kopierknopf. */
function Field({
  label,
  value,
  copyable = true,
}: {
  label: string;
  value: string;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* Zwischenablage gesperrt – der Wert steht ja lesbar da. */
    }
  };

  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-neutral-500">
        {label}
      </p>
      <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5">
        <span className="flex-1 truncate font-mono text-sm text-neutral-100">{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={copy}
            aria-label={`${label} kopieren`}
            className="shrink-0 rounded-md p-1 text-neutral-500 transition-colors hover:bg-white/5 hover:text-neutral-200"
          >
            {copied ? (
              <Check className="h-4 w-4 text-emerald-400" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </button>
        )}
      </div>
    </div>
  );
}
