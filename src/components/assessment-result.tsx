import Link from "next/link";
import { accentHex, tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The enriched Self Assessment result view (issue #6): the headline Primary (and
 * Secondary when one qualifies), the full 12-tribe ranking as proportional bars,
 * the words the Subject picked, and prominent links into the `/tribes/[slug]`
 * profiles.
 *
 * It is a pure presentational component — every value it needs is passed in,
 * already computed on the server (ADR-0009: the word→tribe mapping and scoring
 * core never reach the client). That keeps it free of `server-only` imports so
 * the same view renders identically whether shown right after submitting or when
 * a Subject revisits their saved current result, and lets the profile page
 * (issue #18) reuse it unchanged.
 */
export interface AssessmentResultProps {
  /** The Subject's selected words, in selection order. */
  words: string[];
  /** All 12 tribe scores, already ranked highest-first (see `rankByScore`). */
  scores: TribeScore[];
  /** The Primary tribe — always present. */
  primary: Tribe;
  /** The Secondary tribe, shown only when one qualified. */
  secondary?: Tribe;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function AssessmentResult({
  words,
  scores,
  primary,
  secondary,
}: AssessmentResultProps) {
  return (
    <>
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

      {/* Profile links — the prominent path into the deeper write-ups. */}
      <div className="mt-10 flex flex-wrap items-center gap-[22px]">
        <ProfileLink tribe={primary} label={`Read the full ${primary.name} profile`} />
        {secondary && (
          <ProfileLink
            tribe={secondary}
            label={`Read the full ${secondary.name} profile`}
          />
        )}
      </div>

      <TribeRanking scores={scores} highlight={[primary.slug, secondary?.slug]} />

      <SelectedWords words={words} />

      <div className="mt-14 border-t border-hair pt-8">
        <Link
          href="/assessment"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Retake the assessment
        </Link>
      </div>
    </>
  );
}

function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <div
      className="mt-4"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <h1 className="font-serif text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02]">
        <span style={{ color: "var(--accent)" }}>{tribe.name}</span>
      </h1>
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

function ProfileLink({ tribe, label }: { tribe: Tribe; label: string }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      {label} →
    </Link>
  );
}

/**
 * The full 12-tribe ranking as proportional bars, so the Subject sees why they
 * got their result. Bars are scaled relative to the top score so the ranking
 * fills the track and the proportions between tribes stay visible; each bar is
 * labelled with its own normalized score so the number stays honest. The
 * Primary/Secondary rows are emphasised to tie the headline to the chart.
 */
function TribeRanking({
  scores,
  highlight,
}: {
  scores: TribeScore[];
  highlight: (string | undefined)[];
}) {
  const top = scores[0]?.score ?? 0;
  const highlighted = new Set(highlight.filter(Boolean));

  return (
    <section className="mt-16">
      <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How the twelve scored
      </h2>
      <ul className="mt-6 flex flex-col gap-3.5">
        {scores.map((s) => {
          const tribe = tribeBySlug.get(s.slug);
          const accent = accentHex(tribe?.color ?? "");
          const fillPct = top > 0 ? (s.score / top) * 100 : 0;
          const isLead = highlighted.has(s.slug);
          return (
            <li
              key={s.slug}
              className="grid grid-cols-[110px_1fr_44px] items-center gap-4 max-[520px]:grid-cols-[84px_1fr_40px]"
            >
              <span
                className={
                  isLead
                    ? "font-serif text-[16px] text-ink"
                    : "font-serif text-[16px] text-muted"
                }
              >
                {s.name}
              </span>
              <span
                className="relative h-[10px] overflow-hidden rounded-[2px] bg-hair/60"
                aria-hidden="true"
              >
                <span
                  className="absolute inset-y-0 left-0 rounded-[2px]"
                  style={{
                    width: `${fillPct}%`,
                    background: accent,
                    opacity: isLead ? 1 : 0.55,
                  }}
                />
              </span>
              <span className="text-right text-[12px] tabular-nums text-faint">
                {Math.round(s.score * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The words the Subject picked, shown as static (non-interactive) chips. */
function SelectedWords({ words }: { words: string[] }) {
  if (words.length === 0) return null;
  return (
    <section className="mt-16">
      <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
      </h2>
      <ul className="mt-6 flex flex-wrap gap-2.5">
        {words.map((word) => (
          <li
            key={word}
            className="rounded-[2px] border border-gold bg-gold/10 px-4 py-2 text-[15px] text-ink"
          >
            {word}
          </li>
        ))}
      </ul>
    </section>
  );
}
