/**
 * Farbige Etiketten für Vorschläge und Bug-Meldungen.
 *
 * Aufbau wie {@link ../news/NewsTypeBadge}, damit Blog und Vorschläge nicht
 * nebeneinander wie zwei verschiedene Seiten aussehen.
 */
import { bugPriority, suggestionCategory, suggestionStatus } from "@/lib/feedbackTypes";

function Badge({
  label,
  color,
  className = "",
}: {
  label: string;
  color: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}
      style={{
        color,
        backgroundColor: `${color}1F`,
        boxShadow: `inset 0 0 0 1px ${color}40`,
      }}
    >
      {label}
    </span>
  );
}

/** Bereich eines Vorschlags (SMP, Lobby, Website …). */
export function CategoryBadge({ category, className }: { category: string; className?: string }) {
  const c = suggestionCategory(category);
  return <Badge label={c.label} color={c.color} className={className} />;
}

/** Bearbeitungsstand eines Vorschlags. */
export function StatusBadge({ status, className }: { status: string; className?: string }) {
  const s = suggestionStatus(status);
  return <Badge label={s.label} color={s.color} className={className} />;
}

/** Priorität einer Bug-Meldung (0–3, wie ingame). */
export function PriorityBadge({ priority, className }: { priority: number; className?: string }) {
  const p = bugPriority(priority);
  return <Badge label={p.label} color={p.color} className={className} />;
}

/** Offen oder erledigt – für Bug-Meldungen. */
export function BugStatusBadge({ status, className }: { status: number; className?: string }) {
  return status === 1 ? (
    <Badge label="Erledigt" color="#4ADE80" className={className} />
  ) : (
    <Badge label="Offen" color="#F87171" className={className} />
  );
}
