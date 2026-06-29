import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";
import { resolveHeadline } from "@/lib/assessment/result";

/**
 * The full Self Assessment result view (issue #6): the headline Primary (and
 * Secondary when one qualifies), the ranked Strength Profile for all 12 tribes
 * as proportional bars, the words the Subject chose, and prominent links into
 * the full tribe profile page(s).
 *
 * Presentational and free of server-only deps (it takes already-computed
 * `scores` rather than re-scoring), so it renders identically whether shown
 * right after submitting or when a Subject revisits their saved result, and can
 * be reused by the profile page (#18).
 */
export interface ResultViewProps {
  /** The words the Subject selected, in any order. */
  words: readonly string[];
  /** Normalized 0–1 score per tribe, as returned by `score()`. */
  scores: TribeScore[];
  primarySlug: string;
  secondarySlug?: string | null;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({
  words,
  scores,
  primarySlug,
  secondarySlug,
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranked = rankScores(scores);
  const sortedWords = [...words].sort((a, b) => a.localeCompare(b));

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

        {/* The full Strength Profile — every tribe ranked so the Subject can see why. */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How the twelve scored
          </h2>
          <ul className="mt-7 flex flex-col gap-[18px]">
            {ranked.map((row) => {
              const tribe = tribeBySlug.get(row.slug);
              const isPrimary = row.slug === primary.slug;
              const isSecondary = secondary?.slug === row.slug;
              const accent = tribe ? accentHex(tribe.color) : accentHex("");
              return (
                <li key={row.slug} className="flex items-center gap-4">
                  <span className="w-[110px] shrink-0 truncate font-serif text-[17px] leading-tight">
                    {row.name}
                    {(isPrimary || isSecondary) && (
                      <span className="ml-2 align-middle text-[9px] uppercase tracking-[0.14em] text-faint">
                        {isPrimary ? "Primary" : "Secondary"}
                      </span>
                    )}
                  </span>
                  <span className="relative h-[10px] flex-1 overflow-hidden rounded-[2px] bg-hair/60">
                    <span
                      className="absolute inset-y-0 left-0 rounded-[2px]"
                      style={{
                        width: `${row.barPercent}%`,
                        backgroundColor: accent,
                        opacity: isPrimary || isSecondary ? 1 : 0.55,
                      }}
                    />
                  </span>
                  <span className="w-[42px] shrink-0 text-right text-[12px] tabular-nums text-muted">
                    {Math.round(row.score * 100)}%
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {/* The Subject's own choices, so they can connect input to outcome. */}
        <section className="mt-14 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
            <span className="ml-2 text-muted">({sortedWords.length})</span>
          </h2>
          <ul className="mt-6 flex flex-wrap gap-[10px]">
            {sortedWords.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair px-[13px] py-[6px] text-[13px] text-ink"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>

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
    </main>
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
