import { germanDateTime, type BugReport } from "@/lib/feedbackTypes";
import { BugStatusBadge, PriorityBadge } from "./FeedbackBadge";

/**
 * Eine Bug-Meldung als Karte.
 *
 * Bewusst ohne `"use client"` und ohne Server-Importe: dieselbe Karte wird in
 * der eigenen Liste (Server-Komponente) und im Team-Bereich (Client) benutzt.
 * Was dort an Knöpfen dazukommt, reicht der Aufrufer als `aktionen` herein.
 */
export default function BugItem({
  bug,
  zeigeMelder = false,
  aktionen,
}: {
  bug: BugReport;
  /** Im Team-Bereich steht dabei, wer gemeldet hat. */
  zeigeMelder?: boolean;
  aktionen?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-2">
        <BugStatusBadge status={bug.status} />
        {bug.priority > 0 && <PriorityBadge priority={bug.priority} />}
        <span className="text-xs text-neutral-500">
          #{bug.id} · {germanDateTime(bug.createdAt)}
        </span>
        {zeigeMelder && (
          <span className="flex items-center gap-1.5 text-xs text-neutral-400">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://mc-heads.net/avatar/${encodeURIComponent(bug.reporterName)}/32`}
              alt=""
              width={16}
              height={16}
              className="h-4 w-4 rounded-sm bg-white/5"
              style={{ imageRendering: "pixelated" }}
            />
            {bug.reporterName}
          </span>
        )}
      </div>

      <h3
        className={`mt-2 text-base font-bold leading-snug sm:text-lg ${
          bug.status === 1 ? "text-neutral-400 line-through decoration-neutral-600" : "text-neutral-100"
        }`}
      >
        {bug.title}
      </h3>

      {/* Reiner Text, kein Markup – siehe Vorschlagsseite. */}
      <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-400">
        {bug.description}
      </p>

      {bug.imageIds.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {bug.imageIds.map((imageId) => (
            <a
              key={imageId}
              href={`/api/bugs/image/${imageId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block h-24 w-32 overflow-hidden rounded-lg border border-white/10 bg-black/30 transition-colors hover:border-white/30"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/api/bugs/image/${imageId}`}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
            </a>
          ))}
        </div>
      )}

      {aktionen && <div className="mt-4 border-t border-white/[0.06] pt-3">{aktionen}</div>}
    </div>
  );
}
