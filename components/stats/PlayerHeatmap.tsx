"use client";

import { useState } from "react";
import { Table2, Grid3x3 } from "lucide-react";
import { WEEKDAYS, WEEKDAYS_LONG } from "@/lib/playerInsights";
import { EMPTY_CELL, RAMP, avgLabel, hourLabel } from "./chartTheme";

/**
 * Ø Spieler je Wochentag und Stunde.
 *
 * Beantwortet die zwei Fragen, die die Balkendiagramme einzeln stellen, in
 * einem Bild: wann in der Woche ist wirklich etwas los. Weil die Farbe hier die
 * einzige Kodierung ist, gibt es den Umschalter auf eine Tabelle mit den
 * Zahlen – sonst wäre der Wert nur beim Überfahren zu erfahren.
 */
export default function PlayerHeatmap({ cells }: { cells: (number | null)[][] }) {
  const [asTable, setAsTable] = useState(false);
  const [hover, setHover] = useState<{ day: number; hour: number } | null>(null);

  const values = cells.flat().filter((v): v is number => v !== null);
  const peak = values.length > 0 ? Math.max(...values) : 0;

  const hovered = hover ? cells[hover.day][hover.hour] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-neutral-400">
          {hover ? (
            <>
              <span className="text-neutral-200">
                {WEEKDAYS_LONG[hover.day]}, {hourLabel(hover.hour)}
              </span>{" "}
              ·{" "}
              {hovered === null ? "keine Messung" : `Ø ${avgLabel(hovered)} Spieler`}
            </>
          ) : (
            "Zum Ablesen über ein Feld fahren."
          )}
        </div>
        <button
          type="button"
          onClick={() => setAsTable((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 text-xs text-neutral-400 transition-colors hover:bg-white/5 hover:text-neutral-200"
        >
          {asTable ? <Grid3x3 className="h-3.5 w-3.5" /> : <Table2 className="h-3.5 w-3.5" />}
          {asTable ? "Als Raster" : "Als Tabelle"}
        </button>
      </div>

      {asTable ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[52rem] text-right text-xs tabular-nums">
            <thead>
              <tr className="text-neutral-500">
                <th className="sticky left-0 bg-[#0a0a0b] px-2 py-1.5 text-left font-medium">Tag</th>
                {Array.from({ length: 24 }, (_, h) => (
                  <th key={h} className="px-1 py-1.5 font-medium">
                    {String(h).padStart(2, "0")}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cells.map((row, day) => (
                <tr key={day} className="border-t border-white/5">
                  <th className="sticky left-0 bg-[#0a0a0b] px-2 py-1.5 text-left font-medium text-neutral-300">
                    {WEEKDAYS[day]}
                  </th>
                  {row.map((v, hour) => (
                    <td key={hour} className="px-1 py-1.5 text-neutral-400">
                      {v === null ? "–" : avgLabel(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <div className="min-w-[34rem]">
            {/* Stundenachse – nur jede dritte Stunde, sonst kleben die Zahlen. */}
            <div className="mb-1 flex gap-[2px] pl-8">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center text-[10px] text-neutral-600">
                  {h % 3 === 0 ? String(h).padStart(2, "0") : ""}
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-[2px]">
              {cells.map((row, day) => (
                <div key={day} className="flex items-center gap-[2px]">
                  <div className="w-8 shrink-0 pr-1 text-right text-[11px] text-neutral-500">
                    {WEEKDAYS[day]}
                  </div>
                  {row.map((v, hour) => (
                    <div
                      key={hour}
                      title={`${WEEKDAYS_LONG[day]}, ${hourLabel(hour)} · ${
                        v === null ? "keine Messung" : `Ø ${avgLabel(v)} Spieler`
                      }`}
                      onMouseEnter={() => setHover({ day, hour })}
                      onMouseLeave={() => setHover(null)}
                      className={`h-6 flex-1 rounded-[3px] transition-transform ${
                        hover && hover.day === day && hover.hour === hour
                          ? "scale-110 ring-1 ring-white/40"
                          : ""
                      }`}
                      style={{ backgroundColor: cellColor(v, peak) }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Skala – ohne sie sagt die Farbe nichts. */}
      <div className="flex items-center gap-2 text-[11px] text-neutral-500">
        0 Spieler
        <div className="flex gap-[2px]">
          <span
            className="h-3 w-5 rounded-[2px]"
            style={{ backgroundColor: EMPTY_CELL }}
          />
          {RAMP.map((c) => (
            <span key={c} className="h-3 w-5 rounded-[2px]" style={{ backgroundColor: c }} />
          ))}
        </div>
        Ø {avgLabel(peak)}
      </div>
    </div>
  );
}

/** Wert auf eine Stufe der Skala abbilden; ohne Messung bleibt das Feld leer. */
function cellColor(value: number | null, peak: number): string {
  if (value === null || value <= 0 || peak <= 0) return EMPTY_CELL;
  const step = Math.min(RAMP.length - 1, Math.floor((value / peak) * RAMP.length));
  return RAMP[step];
}
