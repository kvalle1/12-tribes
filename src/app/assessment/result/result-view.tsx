import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * Presentational result view for the Self Assessment (issue #6). Pure and
 * client-safe: it takes already-resolved data (the headline tribes, the full
 * 12-tribe scores, and the selected words) and renders them, so it never imports
 * the word→tribe mapping or the scoring core (both `server-only`, ADR-0009).
 *
 * Because it is a plain component driven entirely by props, the same view renders
 * identically whether it is shown right after submitting or when a Subject
 * revisits their saved current result — and the profile page (issue #18) reuses
 * it unchanged.
 */
export interface ResultViewProps {
  /** Headline Primary tribe (always present). */
  primary: Tribe;
  /** Headline Secondary tribe, when one qualified. */
  secondary?: Tribe | null;
  /** Normalized 0–1 score for every one of the 12 tribes (any order). */
  scores: TribeScore[];
  /** The words the Subject selected. */
  words: string[];
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({
  primary,
  secondary,
  scores,
  words,
}: ResultViewProps) {
  // Rank by normalized score, highest first; ties keep canonical tribe order
  // (the `scores` input is already in tribe `number` order, and sort is stable).
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const maxScore = ranked[0]?.score ?? 0;

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

        {/* The full 12-tribe ranking — shows the Subject why they got this result. */}
        <section className="mt-16">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </h2>
          <ul className="mt-6 flex flex-col gap-[14px]">
            {ranked.map((s) => {
              const tribe = tribeBySlug.get(s.slug);
              const accent = accentHex(tribe?.color ?? "");
              const isPrimary = s.slug === primary.slug;
              const isSecondary = s.slug === secondary?.slug;
              const fill = maxScore > 0 ? (s.score / maxScore) * 100 : 0;
              return (
                <li
                  key={s.slug}
                  style={{ "--accent": accent } as React.CSSProperties}
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span
                      className={
                        isPrimary || isSecondary
                          ? "font-serif text-[18px] font-semibold"
                          : "font-serif text-[18px] text-muted"
                      }
                    >
                      {s.name}
                      {isPrimary && (
                        <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.14em] text-faint">
                          Primary
                        </span>
                      )}
                      {isSecondary && (
                        <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.14em] text-faint">
                          Secondary
                        </span>
                      )}
                    </span>
                    <span className="text-[12px] tabular-nums text-faint">
                      {formatScore(s.score)}
                    </span>
                  </div>
                  <div className="mt-[6px] h-[6px] overflow-hidden rounded-full bg-stone">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${fill}%`,
                        backgroundColor: "var(--accent)",
                        opacity: isPrimary || isSecondary ? 1 : 0.55,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {/* The words the Subject picked — connects their choices to the outcome. */}
        {words.length > 0 && (
          <section className="mt-16">
            <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
              The words you chose
            </h2>
            <ul className="mt-5 flex flex-wrap gap-[10px]">
              {words.map((word) => (
                <li
                  key={word}
                  className="rounded-full border border-hair px-[14px] py-[6px] text-[13px] text-ink"
                >
                  {word}
                </li>
              ))}
            </ul>
          </section>
        )}

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

/** Render a normalized 0–1 score as a whole-number percentage. */
function formatScore(score: number): string {
  return `${Math.round(score * 100)}%`;
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
