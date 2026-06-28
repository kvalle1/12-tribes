import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import { resolveHeadline } from "@/lib/assessment/result";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The enriched Self Assessment result view (issue #6). Pure and presentational:
 * it renders the headline, the ranked 12-tribe bars, the words the Subject
 * picked, and the profile links — from plain data passed in by the page.
 *
 * Scoring is server-only (it transitively imports `server-only` via `words.ts`),
 * so the page computes the scores and hands this component the resulting plain
 * array. This component imports only client-safe modules (`tribes`,
 * `resolveHeadline`), so it renders identically whether shown right after submit
 * or when a Subject revisits their saved current result (AC: identical render),
 * and can be reused by the profile page (#18).
 */
export interface AssessmentResultViewProps {
  /** The words the Subject selected, in stored order. */
  words: readonly string[];
  /** Normalized 0–1 score for every tribe (from the scoring core, any order). */
  scores: readonly TribeScore[];
  primarySlug: string;
  secondarySlug?: string | null;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function AssessmentResultView({
  words,
  scores,
  primarySlug,
  secondarySlug,
}: AssessmentResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);

  // Rank all 12 by normalized score; ties keep canonical (tribe `number`) order
  // because the scoring core emits scores in that order and the sort is stable.
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">Your tribe</p>

      <TribeHeadline tribe={primary} marker="Primary" />

      {secondary && (
        <div className="mt-12">
          <TribeHeadline tribe={secondary} marker="Secondary" />
        </div>
      )}

      {/* Prominent links into the full profile write-up(s). */}
      <div className="mt-9 flex flex-wrap gap-x-7 gap-y-3">
        <ProfileLink tribe={primary} />
        {secondary && <ProfileLink tribe={secondary} />}
      </div>

      {/* Ranked normalized scores for all 12 tribes. */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
          <h2 className="font-serif text-[24px] font-semibold">How every tribe scored</h2>
          <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Normalized
          </span>
        </div>
        <ul className="mt-6 flex flex-col gap-[14px]">
          {ranked.map((s) => (
            <ScoreBar
              key={s.slug}
              score={s}
              topScore={topScore}
              isPrimary={s.slug === primary.slug}
              isSecondary={s.slug === secondary?.slug}
            />
          ))}
        </ul>
      </section>

      {/* The words the Subject picked. */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-ink pb-1.5">
          <h2 className="font-serif text-[24px] font-semibold">The words you chose</h2>
          <span className="text-[11px] uppercase tracking-[0.16em] text-faint tabular-nums">
            {words.length}
          </span>
        </div>
        <ul className="mt-6 flex flex-wrap gap-[10px]">
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
    </div>
  );
}

function TribeHeadline({ tribe, marker }: { tribe: Tribe; marker: string }) {
  return (
    <div
      className="mt-3"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <p className="text-[11px] uppercase tracking-[0.2em] text-faint">{marker}</p>
      <h1 className="mt-1 font-serif text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02]">
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

function ProfileLink({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      Read the full {tribe.name} profile →
    </Link>
  );
}

function ScoreBar({
  score,
  topScore,
  isPrimary,
  isSecondary,
}: {
  score: TribeScore;
  topScore: number;
  isPrimary: boolean;
  isSecondary: boolean;
}) {
  const tribe = tribeBySlug.get(score.slug);
  const accent = tribe ? accentHex(tribe.color) : "#a9842f";
  // Bars are proportional to one another: width is each tribe's score relative
  // to the leader, so the top tribe fills the track and the rest scale by ratio.
  const fill = topScore > 0 ? (score.score / topScore) * 100 : 0;
  const highlight = isPrimary || isSecondary;

  return (
    <li
      className="grid grid-cols-[148px_1fr_44px] items-center gap-x-4 max-[520px]:grid-cols-[110px_1fr_40px]"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <span
        className={`truncate text-[14px] ${
          highlight ? "font-medium text-ink" : "text-muted"
        }`}
      >
        {score.name}
      </span>
      <span
        className="h-[10px] rounded-[2px] bg-stone"
        role="presentation"
      >
        <span
          className="block h-full rounded-[2px]"
          style={{
            width: `${fill}%`,
            background: "var(--accent)",
            opacity: highlight ? 1 : 0.55,
          }}
        />
      </span>
      <span className="text-right text-[12px] tabular-nums text-faint">
        {Math.round(score.score * 100)}
      </span>
    </li>
  );
}

/** Maps a tribe's Tailwind color name to its accent hex (mirrors page.tsx / the detail page). */
function accentHex(color: string): string {
  const map: Record<string, string> = {
    amber: "#b8860b",
    violet: "#7c5cbf",
    blue: "#2f6fb0",
    emerald: "#2f8f63",
    orange: "#c2691f",
    red: "#b23535",
    slate: "#6b7280",
    cyan: "#1f97aa",
    lime: "#6f9420",
    zinc: "#7c7c85",
    yellow: "#b8961a",
    rose: "#bf3a52",
  };
  return map[color] ?? "#a9842f";
}
