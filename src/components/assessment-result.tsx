import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { type TribeScore } from "@/lib/assessment/score";
import { resolveHeadline } from "@/lib/assessment/result";
import {
  accentHex,
  buildResultView,
  type RankedTribe,
} from "@/lib/assessment/result-view";

/**
 * The full assessment result view (issue #6): the headline Primary (and
 * Secondary when one qualifies), the ranked normalized scores for all 12 tribes
 * as bars, the words the Subject picked, and prominent links into the tribe
 * profile page(s).
 *
 * It is built from one stored result — the selected `words`, the server-computed
 * `scores`, and the headline slugs — so it renders identically whether shown
 * straight after submitting or when a Subject (or the profile page, #18) revisits
 * the saved current result. Purely presentational: scoring already happened on
 * the server, so this never touches the DB or the word→tribe mapping.
 */
export interface AssessmentResultProps {
  /** Full 12-tribe score table, in canonical order, from `score(words)`. */
  scores: TribeScore[];
  primarySlug: string;
  secondarySlug?: string | null;
  /** The words the Subject selected. */
  words: string[];
}

export function AssessmentResult({
  scores,
  primarySlug,
  secondarySlug,
  words,
}: AssessmentResultProps) {
  const view = buildResultView(scores, primarySlug, secondarySlug, words);
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);

  return (
    <main className="min-h-screen bg-bone text-ink">
      <div className="mx-auto max-w-[680px] px-8 py-[100px]">
        <Link
          href="/"
          className="text-[12px] uppercase tracking-[0.18em] text-muted transition-colors hover:text-ink"
        >
          ← Tribe·Index
        </Link>

        <p className="mt-10 text-[12px] uppercase tracking-[0.2em] text-faint">
          Your tribe
        </p>

        <TribeHeadline tribe={primary} />

        {secondary && (
          <>
            <p className="mt-12 text-[12px] uppercase tracking-[0.2em] text-faint">
              With a strong secondary
            </p>
            <TribeHeadline tribe={secondary} />
          </>
        )}

        {/* Ranked normalized scores for all 12 tribes — the "why" behind the result. */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </h2>
          <ul className="mt-6 flex flex-col gap-3">
            {view.ranking.map((row) => (
              <ScoreBar key={row.slug} row={row} />
            ))}
          </ul>
          <p className="mt-5 text-[12px] leading-[1.6] text-faint">
            Each bar is a tribe&rsquo;s normalized score — the share of its words
            you selected — so high- and low-coverage tribes compare fairly.
          </p>
        </section>

        {/* The words the Subject picked, connecting their choices to the outcome. */}
        <section className="mt-14 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
            <span className="ml-2 text-muted">({words.length})</span>
          </h2>
          <ul className="mt-6 flex flex-wrap gap-2">
            {words.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair bg-stone/40 px-[14px] py-[7px] text-[14px] text-ink"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>

        {/* Profile links + retake. */}
        <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
          <Link
            href="/assessment"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Retake the assessment
          </Link>
          <Link
            href={`/tribes/${primary.slug}`}
            className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
          >
            Read the full {primary.name} profile
          </Link>
          {secondary && (
            <Link
              href={`/tribes/${secondary.slug}`}
              className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
            >
              Read the {secondary.name} profile
            </Link>
          )}
        </div>
      </div>
    </main>
  );
}

function ScoreBar({ row }: { row: RankedTribe }) {
  const isHeadline = row.role !== undefined;
  return (
    <li
      className="grid grid-cols-[110px_1fr_auto] items-center gap-4"
      style={{ "--accent": row.accent } as React.CSSProperties}
    >
      <Link
        href={`/tribes/${row.slug}`}
        className={`truncate text-[14px] transition-colors hover:text-[var(--accent)] ${
          isHeadline ? "font-medium text-ink" : "text-muted"
        }`}
      >
        {row.name}
        {row.role === "primary" && (
          <span className="ml-1.5 align-middle text-[10px] uppercase tracking-[0.12em] text-faint">
            Primary
          </span>
        )}
        {row.role === "secondary" && (
          <span className="ml-1.5 align-middle text-[10px] uppercase tracking-[0.12em] text-faint">
            Secondary
          </span>
        )}
      </Link>
      <div
        className="h-[10px] overflow-hidden rounded-[2px] bg-stone"
        role="img"
        aria-label={`${row.name}: ${row.percent}%`}
      >
        <div
          className="h-full rounded-[2px]"
          style={{
            width: `${row.barFraction * 100}%`,
            backgroundColor: "var(--accent)",
            opacity: isHeadline ? 1 : 0.55,
          }}
        />
      </div>
      <span className="w-[42px] text-right text-[13px] tabular-nums text-muted">
        {row.percent}%
      </span>
    </li>
  );
}

function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <div
      className="mt-4"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <Link href={`/tribes/${tribe.slug}`} className="group inline-block">
        <h1 className="font-serif text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02]">
          <span
            style={{ color: "var(--accent)" }}
            className="transition-opacity group-hover:opacity-80"
          >
            {tribe.name}
          </span>
        </h1>
      </Link>
      <div className="mt-1 font-serif text-[22px] italic text-muted">
        {tribe.callSign} ·{" "}
        <span className="font-hebrew not-italic">{tribe.hebrew}</span>
      </div>
      <div className="mt-3 text-[12px] uppercase tracking-[0.14em] text-faint">
        {tribe.essence}
      </div>
    </div>
  );
}
