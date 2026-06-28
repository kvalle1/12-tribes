import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { tribes } from "@/lib/tribes";
import { resolveHeadline } from "@/lib/assessment/result";
import { score } from "@/lib/assessment/score";

/**
 * The enriched Self Assessment result view (issue #6): the Primary (and a
 * Secondary when one qualifies) headline, the full 12-tribe ranking as
 * proportional bars, the words the Subject picked, and prominent links into the
 * `/tribes/[slug]` profile pages.
 *
 * This is a Server Component and the single source of the result rendering. Both
 * the post-submit result page and — later — the profile page (#18) render it, so
 * the view is identical wherever it appears. It recomputes the ranking from the
 * stored `words` via the pure scoring core, so the bars can never drift from the
 * saved selection and the word→tribe mapping (server-only) never reaches the
 * client (ADR-0009): the bars carry tribe names and scores only, not the mapping.
 */

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

interface RankedTribe {
  tribe: Tribe;
  /** Normalized 0–1 score from the scoring core. */
  score: number;
  /** Whole-percent of this tribe's normalized score, for the readout. */
  percent: number;
  /** Bar width as a percent of the leading tribe's score, so the chart fills. */
  barPercent: number;
}

/** Rank all 12 tribes by normalized score (desc), scaling bars to the leader. */
function rankTribes(words: readonly string[]): RankedTribe[] {
  const scores = score(words);
  const top = Math.max(...scores.map((s) => s.score), 0);
  return [...scores]
    .sort((a, b) => b.score - a.score)
    .map((s) => {
      const tribe = tribeBySlug.get(s.slug)!;
      return {
        tribe,
        score: s.score,
        percent: Math.round(s.score * 100),
        barPercent: top > 0 ? (s.score / top) * 100 : 0,
      };
    });
}

export function AssessmentResult({
  words,
  primarySlug,
  secondarySlug,
}: {
  words: readonly string[];
  primarySlug: string;
  secondarySlug?: string | null;
}) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranking = rankTribes(words);

  return (
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

      {/* The full 12-tribe ranking — why this is the result. */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-gold">
          How the twelve scored
        </h2>
        <ul className="mt-6 flex flex-col gap-[14px]">
          {ranking.map(({ tribe, percent, barPercent }) => {
            const accent = accentHex(tribe.color);
            const emphasized =
              tribe.slug === primary.slug || tribe.slug === secondary?.slug;
            return (
              <li key={tribe.slug}>
                <Link
                  href={`/tribes/${tribe.slug}`}
                  aria-label={`${tribe.name}: ${percent}% — read the full profile`}
                  className="group grid grid-cols-[110px_1fr_42px] items-center gap-4 transition-opacity hover:opacity-100"
                  style={{ opacity: emphasized ? 1 : 0.78 }}
                >
                  <span
                    aria-hidden="true"
                    className={`font-serif text-[16px] leading-tight ${
                      emphasized ? "font-semibold" : "text-muted"
                    }`}
                    style={emphasized ? { color: accent } : undefined}
                  >
                    {tribe.name}
                  </span>
                  {/* Decorative score bar; the percent is conveyed by aria-label. */}
                  <span
                    aria-hidden="true"
                    className="relative h-[7px] rounded-full bg-stone"
                  >
                    <span
                      className="absolute inset-y-0 left-0 rounded-full transition-[width]"
                      style={{
                        width: `${barPercent}%`,
                        background: accent,
                        opacity: emphasized ? 1 : 0.55,
                      }}
                    />
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-right text-[12px] tabular-nums text-faint"
                  >
                    {percent}%
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The words the Subject picked. */}
      <section className="mt-14 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-gold">
          The words you chose
        </h2>
        <ul className="mt-5 flex flex-wrap gap-[10px]">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-full border border-hair px-[14px] py-[6px] text-[13px] text-muted"
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
