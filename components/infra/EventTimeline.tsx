"use client";

import Link from "next/link";
import { useState } from "react";
import type { InfraEvent } from "@/lib/infraTypes";
import { eventStyle } from "@/lib/infraTypes";
import { MAX_MARKERS } from "./MetricChart";

type Props = {
  events: InfraEvent[];
  /** Zielspalte anzeigen – in der Service-Ansicht überflüssig. */
  showTarget?: boolean;
};

/** Wie viele Einträge ohne Aufklappen zu sehen sind. */
const PREVIEW = 8;

/**
 * Legende der Marker plus die Ereignisse als Liste mit exakter Uhrzeit.
 *
 * Die senkrechten Linien im Diagramm zeigen <em>wann</em> etwas passiert ist,
 * aber nicht <em>was</em> – dafür ist diese Liste da. Bei vielen Ereignissen
 * zeichnet das Diagramm keine Marker mehr; dann ist sie die einzige Quelle,
 * worauf hier auch hingewiesen wird.
 */
export default function EventTimeline({ events, showTarget = true }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (events.length === 0) {
    return (
      <div className="text-xs text-neutral-600">
        Keine Start- oder Stopp-Ereignisse in diesem Zeitraum.
      </div>
    );
  }

  // Neueste zuerst – die will man beim Nachschauen fast immer.
  const sorted = [...events].sort((a, b) => b.t - a.t);
  const visible = expanded ? sorted : sorted.slice(0, PREVIEW);
  const markersHidden = events.length > MAX_MARKERS;

  // Nur die Typen zeigen, die auch wirklich vorkommen.
  const presentTypes = [...new Set(events.map((e) => e.type))];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
        <span className="text-neutral-500">Marker:</span>
        {presentTypes.map((type) => {
          const style = eventStyle(type);
          return (
            <span key={type} className="flex items-center gap-1.5 text-neutral-400">
              <span
                className="inline-block h-0 w-4 border-t border-dashed"
                style={{ borderColor: style.color }}
              />
              {style.label}
            </span>
          );
        })}
        <span className="text-neutral-600">· {events.length} Ereignisse</span>
      </div>

      {markersHidden && (
        <div className="rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs text-amber-300/80">
          Über {MAX_MARKERS} Ereignisse in diesem Zeitraum – im Diagramm wären das nur noch
          Striche. Wähle einen kürzeren Zeitraum, oder nutze die Liste unten.
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/10">
        <table className="w-full text-xs">
          <tbody>
            {visible.map((event) => {
              const style = eventStyle(event.type);
              return (
                <tr key={event.id} className="border-b border-white/5 last:border-b-0">
                  <td className="w-32 px-3 py-2 tabular-nums text-neutral-400">
                    {new Date(event.t).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </td>
                  <td className="w-28 px-3 py-2">
                    <span
                      className="rounded px-1.5 py-0.5 font-medium"
                      style={{ backgroundColor: `${style.color}22`, color: style.color }}
                    >
                      {style.label}
                    </span>
                  </td>
                  {showTarget && (
                    <td className="px-3 py-2">
                      <Link
                        href={
                          event.kind === "NODE"
                            ? `/infra/node/${encodeURIComponent(event.target)}`
                            : `/infra/service/${encodeURIComponent(event.target)}`
                        }
                        className="text-neutral-300 hover:text-sky-300 hover:underline"
                      >
                        {event.target}
                      </Link>
                    </td>
                  )}
                  <td className="px-3 py-2 text-right text-neutral-600">{event.detail}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length > PREVIEW && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-xs text-neutral-500 hover:text-sky-300"
        >
          {expanded ? "Weniger anzeigen" : `Alle ${sorted.length} Ereignisse anzeigen`}
        </button>
      )}
    </div>
  );
}
