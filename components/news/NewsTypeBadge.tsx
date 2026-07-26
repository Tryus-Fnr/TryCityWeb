import { newsType } from "@/lib/newsTypes";

/** Farbiges Etikett mit der Art des Beitrags (Update, Info, Bug …). */
export default function NewsTypeBadge({
  type,
  className = "",
}: {
  type: string;
  className?: string;
}) {
  const t = newsType(type);
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${className}`}
      style={{
        color: t.color,
        backgroundColor: `${t.color}1F`,
        boxShadow: `inset 0 0 0 1px ${t.color}40`,
      }}
    >
      {t.label}
    </span>
  );
}
