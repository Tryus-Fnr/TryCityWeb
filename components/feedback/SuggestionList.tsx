"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  SUGGESTION_CATEGORIES,
  SUGGESTION_STATUS,
  germanDate,
  type Suggestion,
} from "@/lib/feedbackTypes";
import { normalizeText } from "@/lib/similarity";
import { CategoryBadge, StatusBadge } from "./FeedbackBadge";
import VoteButtons from "./VoteButtons";

const PAGE_SIZE = 12;

/**
 * Die Vorschlagsliste mit Filtern, Suche und Abstimmung.
 *
 * Gefiltert und sortiert wird im Browser: die Seite lädt die Vorschläge einmal
 * fertig aus, danach ist jeder Klick auf einen Filter sofort da. Bei ein paar
 * hundert Einträgen ist das der einfachere und schnellere Weg – wächst die
 * Liste über ein paar tausend, gehört das Filtern in die Abfrage.
 */
export default function SuggestionList({
  suggestions,
  loggedIn,
}: {
  suggestions: Suggestion[];
  loggedIn: boolean;
}) {
  const [status, setStatus] = useState<string | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<"beliebt" | "neu">("beliebt");
  const [suche, setSuche] = useState("");
  const [page, setPage] = useState(0);

  const statusCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of suggestions) map.set(s.status, (map.get(s.status) ?? 0) + 1);
    return map;
  }, [suggestions]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of suggestions) map.set(s.category, (map.get(s.category) ?? 0) + 1);
    return map;
  }, [suggestions]);

  const gefiltert = useMemo(() => {
    // Dieselbe Normalisierung wie in der Duplikat-Suche: wer „Enderchest"
    // sucht, findet auch „Ender-Chest".
    const q = normalizeText(suche);
    const list = suggestions.filter((s) => {
      if (status && s.status !== status) return false;
      if (category && s.category !== category) return false;
      if (q.length > 0) {
        const heu = normalizeText(`${s.title} ${s.body}`);
        if (!q.split(" ").every((teil) => heu.includes(teil))) return false;
      }
      return true;
    });
    return list.sort((a, b) =>
      sort === "beliebt"
        ? b.score - a.score || b.createdAt.localeCompare(a.createdAt)
        : b.createdAt.localeCompare(a.createdAt) || b.score - a.score
    );
  }, [suggestions, status, category, suche, sort]);

  const pageCount = Math.max(1, Math.ceil(gefiltert.length / PAGE_SIZE));
  // Nach einem Filterwechsel kann die alte Seitenzahl ins Leere zeigen.
  const safePage = Math.min(page, pageCount - 1);
  const shown = gefiltert.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);

  return (
    <div className="flex flex-col gap-5">
      {/* ── Suche und Sortierung ── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-56 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-600" />
          <input
            value={suche}
            onChange={(e) => {
              setSuche(e.target.value);
              setPage(0);
            }}
            placeholder="Vorschläge durchsuchen …"
            className="w-full rounded-xl border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-sm text-neutral-100 outline-none transition-colors placeholder:text-neutral-600 focus:border-sky-400/50"
          />
        </div>
        <div className="flex gap-1.5">
          {(["beliebt", "neu"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setSort(v);
                setPage(0);
              }}
              className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors ${
                sort === v
                  ? "bg-sky-400/15 text-sky-300 ring-1 ring-sky-400/40"
                  : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
              }`}
            >
              {v === "beliebt" ? "Beliebt" : "Neueste"}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter ── */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={status === null}
            onClick={() => {
              setStatus(null);
              setPage(0);
            }}
          >
            Alle
          </FilterChip>
          {SUGGESTION_STATUS.filter((s) => statusCounts.has(s.id)).map((s) => (
            <FilterChip
              key={s.id}
              active={status === s.id}
              color={s.color}
              onClick={() => {
                setStatus(status === s.id ? null : s.id);
                setPage(0);
              }}
            >
              {s.label} <span className="opacity-60">{statusCounts.get(s.id)}</span>
            </FilterChip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <FilterChip
            active={category === null}
            onClick={() => {
              setCategory(null);
              setPage(0);
            }}
          >
            Alle Bereiche
          </FilterChip>
          {SUGGESTION_CATEGORIES.filter((c) => categoryCounts.has(c.id)).map((c) => (
            <FilterChip
              key={c.id}
              active={category === c.id}
              color={c.color}
              onClick={() => {
                setCategory(category === c.id ? null : c.id);
                setPage(0);
              }}
            >
              {c.label}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* ── Liste ── */}
      {gefiltert.length === 0 ? (
        <p className="rounded-2xl border border-white/[0.08] bg-white/[0.02] px-5 py-12 text-center text-sm text-neutral-500">
          {suggestions.length === 0
            ? "Noch kein Vorschlag da. Mach den Anfang!"
            : "Dazu gibt es keinen Vorschlag."}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {shown.map((s) => (
              <SuggestionRow key={s.id} suggestion={s} loggedIn={loggedIn} />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="text-sm text-neutral-500">
              {gefiltert.length} {gefiltert.length === 1 ? "Vorschlag" : "Vorschläge"}
            </span>
            {pageCount > 1 && (
              <div className="flex flex-wrap gap-1.5">
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
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Eine Zeile der Liste: links die Abstimmung, rechts der Vorschlag.
 *
 * Die Abstimmung liegt bewusst außerhalb des Links – ein Knopf in einem Link
 * ist nicht nur ungültiges Markup, er würde beim Klick auch die Seite wechseln.
 */
function SuggestionRow({ suggestion, loggedIn }: { suggestion: Suggestion; loggedIn: boolean }) {
  return (
    <div className="flex gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 transition-colors hover:border-white/20 hover:bg-white/[0.04] sm:gap-4 sm:p-4">
      <VoteButtons
        suggestionId={suggestion.id}
        initialScore={suggestion.score}
        initialOwn={suggestion.ownVote}
        loggedIn={loggedIn}
      />

      <Link href={`/vorschlaege/${suggestion.id}`} className="group min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <CategoryBadge category={suggestion.category} />
          {suggestion.status !== "offen" && <StatusBadge status={suggestion.status} />}
          <span className="text-xs text-neutral-500">{germanDate(suggestion.createdAt)}</span>
        </div>

        <h3 className="mt-1.5 line-clamp-2 text-base font-bold leading-snug text-neutral-100 transition-colors group-hover:text-sky-300 sm:text-lg">
          {suggestion.title}
        </h3>

        <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-neutral-500">
          {suggestion.body}
        </p>

        <div className="mt-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`https://mc-heads.net/avatar/${encodeURIComponent(suggestion.authorName)}/32`}
            alt=""
            width={18}
            height={18}
            className="h-[18px] w-[18px] rounded-sm bg-white/5"
            style={{ imageRendering: "pixelated" }}
          />
          <span className="truncate text-xs text-neutral-500">{suggestion.authorName}</span>
          <span className="text-xs text-neutral-700">·</span>
          <span className="text-xs text-neutral-600">
            {suggestion.upvotes} dafür, {suggestion.downvotes} dagegen
          </span>
        </div>
      </Link>
    </div>
  );
}

function FilterChip({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean;
  color?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors ${
        active ? "" : "text-neutral-400 ring-1 ring-white/10 hover:bg-white/5"
      }`}
      style={
        active
          ? {
              color: color ?? "#7DD3FC",
              backgroundColor: `${color ?? "#38BDF8"}1F`,
              boxShadow: `inset 0 0 0 1px ${color ?? "#38BDF8"}55`,
            }
          : undefined
      }
    >
      {children}
    </button>
  );
}
