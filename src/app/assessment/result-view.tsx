import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import type { ResultHeadline } from "@/lib/assessment/result";

/**
 * The full Self Assessment result view (issue #6): the Primary (and qualifying
 * Secondary) headline, the ranked normalized scores for all 12 tribes as bars,
 * the words the Subject picked, and prominent links into the `/tribes/[slug]`
 * profile page(s).
 *
 * Purely presentational and client-safe — it takes the already-computed headline,
 * the 12 `TribeScore`s, and the selected words. Its only reference to the
 * `server-only` scoring core is a type-only `TribeScore` import (erased at build),
 * so neither the scoring core nor the word→tribe mapping it imports is ever bundled
 * here. The result page computes those on the server and hands them down, so this
 * same view can be reused verbatim by the profile page (#18) without crossing the
 * ADR-0009 trust boundary.
 */
export interface ResultViewProps {
  headline: ResultHeadline;
  /** Normalized 0–1 score for every tribe, in canonical order. */
  scores: readonly TribeScore[];
  /** The words the Subject selected, as stored. */
  words: readonly string[];
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({ headline, scores, words }: ResultViewProps) {
  const { primary, secondary } = headline;

  // Rank by normalized score, descending; ties keep canonical order from the
  // already-canonically-ordered `scores` (Array.prototype.sort is stable).
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const topScore = ranked[0]?.score ?? 0;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
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

      {/* Ranked bars — all 12 tribes, so the Subject sees why they got this result. */}
      <section className="mt-16">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How the twelve ranked
        </p>
        <ul className="mt-6 flex flex-col gap-[14px]">
          {ranked.map((tribeScore) => (
            <RankingBar
              key={tribeScore.slug}
              tribeScore={tribeScore}
              topScore={topScore}
              isPrimary={tribeScore.slug === primary.slug}
              isSecondary={tribeScore.slug === secondary?.slug}
            />
          ))}
        </ul>
        <p className="mt-5 text-[12px] leading-relaxed text-faint">
          Each score is the share of its tribe&rsquo;s words you chose, so tribes
          with more or fewer words still compare fairly.
        </p>
      </section>

      {/* The words the Subject picked, connecting their choices to the outcome. */}
      <section className="mt-16">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The {words.length} {words.length === 1 ? "word" : "words"} you chose
        </p>
        <ul className="mt-5 flex flex-wrap gap-[10px]">
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

      {/* Actions + prominent links into the full profile page(s). */}
      <div className="mt-16 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
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
            Read the full {secondary.name} profile
          </Link>
        )}
      </div>
    </div>
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

function RankingBar({
  tribeScore,
  topScore,
  isPrimary,
  isSecondary,
}: {
  tribeScore: TribeScore;
  topScore: number;
  isPrimary: boolean;
  isSecondary: boolean;
}) {
  const tribe = tribeBySlug.get(tribeScore.slug);
  const accent = accentHex(tribe?.color ?? "");
  // Bar length is proportional to the score, scaled so the leader fills the
  // track; a nonzero score always shows at least a sliver.
  const fillPct =
    topScore > 0 && tribeScore.score > 0
      ? Math.max((tribeScore.score / topScore) * 100, 2)
      : 0;
  const emphasized = isPrimary || isSecondary;

  return (
    <li
      className="grid grid-cols-[120px_1fr_38px] items-center gap-4"
      style={{ "--accent": accent } as React.CSSProperties}
    >
      <Link
        href={`/tribes/${tribeScore.slug}`}
        className={`text-[14px] transition-colors hover:text-[color:var(--accent)] ${
          emphasized ? "font-medium text-ink" : "text-muted"
        }`}
      >
        {tribeScore.name}
      </Link>
      {/* Decorative — the adjacent percentage text already conveys the value to AT. */}
      <div
        aria-hidden="true"
        className="h-[8px] overflow-hidden rounded-full bg-stone"
      >
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${fillPct}%`,
            background: "var(--accent)",
            opacity: emphasized ? 1 : 0.55,
          }}
        />
      </div>
      <span className="text-right text-[12px] tabular-nums text-faint">
        {Math.round(tribeScore.score * 100)}%
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
