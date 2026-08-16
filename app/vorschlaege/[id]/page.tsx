import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getModStatus, getVerifiedSession } from "@/lib/auth";
import { loadSuggestion } from "@/lib/feedback";
import { germanDateTime } from "@/lib/feedbackTypes";
import { CategoryBadge, StatusBadge } from "@/components/feedback/FeedbackBadge";
import VoteButtons from "@/components/feedback/VoteButtons";
import SuggestionAdminBar from "@/components/feedback/SuggestionAdminBar";
import DeleteOwnSuggestion from "@/components/feedback/DeleteOwnSuggestion";
import { SetBreadcrumb } from "@/components/Breadcrumbs";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const suggestion = await loadSuggestion(Number((await params).id), null);
  return { title: suggestion ? `${suggestion.title} – Vorschläge` : "Vorschlag – TryCity" };
}

/** Ein Vorschlag in voller Länge, mit Abstimmung und Anmerkung des Teams. */
export default async function VorschlagPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const session = await getVerifiedSession();
  const suggestion = await loadSuggestion(id, session?.uuid ?? null);
  if (!suggestion) notFound();

  const isMod = await getModStatus();
  const istEigener = session?.uuid === suggestion.authorUuid;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <SetBreadcrumb label={suggestion.title} />

      <Link
        href="/vorschlaege"
        className="inline-flex items-center gap-1.5 text-sm text-neutral-500 transition-colors hover:text-neutral-200"
      >
        <ArrowLeft className="h-4 w-4" />
        Alle Vorschläge
      </Link>

      <article className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-5 sm:p-7">
        <div className="flex gap-4 sm:gap-5">
          <VoteButtons
            suggestionId={suggestion.id}
            initialScore={suggestion.score}
            initialOwn={suggestion.ownVote}
            loggedIn={session !== null}
            size="gross"
          />

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryBadge category={suggestion.category} />
              <StatusBadge status={suggestion.status} />
              <span className="text-xs text-neutral-500">
                #{suggestion.id} · {germanDateTime(suggestion.createdAt)}
              </span>
            </div>

            <h1 className="mt-2.5 text-2xl font-bold leading-tight text-neutral-50 sm:text-3xl">
              {suggestion.title}
            </h1>

            <div className="mt-3 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`https://mc-heads.net/avatar/${encodeURIComponent(suggestion.authorName)}/40`}
                alt=""
                width={22}
                height={22}
                className="h-[22px] w-[22px] rounded-sm bg-white/5"
                style={{ imageRendering: "pixelated" }}
              />
              <span className="text-sm text-neutral-400">{suggestion.authorName}</span>
              <span className="text-neutral-700">·</span>
              <span className="text-sm text-neutral-500">
                {suggestion.upvotes} dafür, {suggestion.downvotes} dagegen
              </span>
            </div>
          </div>
        </div>

        {/* Der Text kommt roh aus der Datenbank und wird als Text gerendert –
            React setzt hier nichts als Markup um, deshalb kann in einem
            Vorschlag auch nichts stecken, das die Seite verändert. */}
        <p className="mt-6 whitespace-pre-wrap break-words text-[15px] leading-relaxed text-neutral-300">
          {suggestion.body}
        </p>

        {suggestion.duplicateOf !== null && (
          <p className="mt-6 rounded-xl border border-amber-400/25 bg-amber-400/[0.06] px-4 py-3 text-sm text-amber-200/90">
            Deckt sich mit{" "}
            <Link
              href={`/vorschlaege/${suggestion.duplicateOf}`}
              className="font-semibold underline underline-offset-2 hover:text-amber-100"
            >
              Vorschlag #{suggestion.duplicateOf}
            </Link>
            . Stimme dort mit ab – dann zählt es zusammen.
          </p>
        )}

        {suggestion.staffNote && (
          <div className="mt-6 rounded-xl border border-sky-400/25 bg-sky-400/[0.06] px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sky-300/80">
              Anmerkung vom Team
            </p>
            <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-neutral-200">
              {suggestion.staffNote}
            </p>
          </div>
        )}

        {isMod && <SuggestionAdminBar suggestion={suggestion} />}
        {!isMod && istEigener && <DeleteOwnSuggestion suggestionId={suggestion.id} />}
      </article>
    </div>
  );
}
