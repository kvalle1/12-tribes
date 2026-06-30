import Link from "next/link";
import type { CSSProperties } from "react";
import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { rankScores } from "@/lib/assessment/ranking";

/**
 * The full Self Assessment result view (issue #6, PRD stories 11–13). Rendered
 * both right after submitting and when a Subject returns to their saved current
 * result — it takes only plain props, so the two entry points render identically
 * (the `/assessment/result` page for now, the profile page in #18).
 *
 * Presentational and trust-safe: it receives the already-computed `scores` and
 * resolved `Tribe` objects as props and never imports the scoring core or the
 * word→tribe mapping, so the server stays the only place scoring runs (ADR-0009).
 */
export interface AssessmentResultViewProps {
  /** The Primary tribe — always present. */
  primary: Tribe;
  /** The Secondary tribe, when one qualified. */
  secondary?: Tribe;
  /** Normalized 0–1 scores for all 12 tribes (any order). */
  scores: TribeScore[];
  /** The words the Subject selected, in selection order. */
  words: string[];
}

const colorBySlug = new Map(tribes.map((t) => [t.slug, t.color]));

export function AssessmentResultView({
  primary,
  secondary,
  scores,
  words,
}: AssessmentResultViewProps) {
  const ranked = rankScores(scores);

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

        {/* Prominent links into the full profile page(s) (story 13). */}
        <div className="mt-10 flex flex-wrap items-center gap-x-7 gap-y-3">
          <ProfileLink tribe={primary} label="Read the full" />
          {secondary && <ProfileLink tribe={secondary} label="And the" />}
        </div>

        {/* The 12-tribe ranking bars (story 11). */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </h2>
          <ol className="mt-7 flex flex-col gap-3.5">
            {ranked.map((row) => {
              const isPrimary = row.slug === primary.slug;
              const isSecondary = row.slug === secondary?.slug;
              const accent = accentHex(colorBySlug.get(row.slug));
              return (
                <li key={row.slug}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={
                        isPrimary || isSecondary
                          ? "font-serif text-[16px] text-ink"
                          : "font-serif text-[16px] text-muted"
                      }
                    >
                      {row.name}
                    </span>
                    {(isPrimary || isSecondary) && (
                      <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
                        {isPrimary ? "Primary" : "Secondary"}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-hair/60">
                    <div
                      className="h-full rounded-full transition-[width]"
                      style={{
                        width: `${row.barPercent}%`,
                        backgroundColor: accent,
                        opacity: isPrimary || isSecondary ? 1 : 0.5,
                      }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* The words the Subject chose (story 12). */}
        <section className="mt-14 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
          </h2>
          <div className="mt-6 flex flex-wrap gap-2.5">
            {words.map((word) => (
              <span
                key={word}
                className="rounded-[2px] border border-gold bg-gold/10 px-4 py-2 text-[15px] text-ink"
              >
                {word}
              </span>
            ))}
          </div>
        </section>

        <div className="mt-16 border-t border-hair pt-8">
          <Link
            href="/assessment"
            className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
          >
            Retake the assessment
          </Link>
        </div>
      </div>
    </main>
  );
}

function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <div
      className="mt-4"
      style={{ "--accent": accentHex(tribe.color) } as CSSProperties}
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
      {label} {tribe.name} profile →
    </Link>
  );
}

/**
 * Maps a tribe's Tailwind color name to its accent hex. Mirrors the maps in
 * `page.tsx` and the tribe detail page (a missing key falls back to brass);
 * kept in sync with them per the CLAUDE.md note.
 */
export function accentHex(color: string | undefined): string {
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
  return (color && map[color]) ?? "#a9842f";
}
