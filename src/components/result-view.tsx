import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import { rankScores, type TribeScore } from "@/lib/assessment/score";

/**
 * The full Self Assessment result view (issue #6): the headline tribe(s), the
 * ranked normalized scores for all 12 tribes as bars, the words the Subject
 * picked, and prominent links into the full tribe profile page(s).
 *
 * It is purely presentational — it takes the already-computed scores and the
 * resolved Primary/Secondary tribes and renders them. Scoring stays on the
 * server (ADR-0009): the caller computes scores from the saved words and passes
 * only the per-tribe results in, so the word→tribe mapping never reaches here.
 *
 * The same component renders right after submitting and when a Subject revisits
 * their saved current result, so the two views are identical by construction.
 * Issue #18 (the profile page) reuses it as-is.
 */
export interface ResultViewProps {
  /** Normalized 0–1 score for every tribe (canonical or any order; ranked here). */
  scores: TribeScore[];
  /** The words the Subject selected, in saved order. */
  words: readonly string[];
  primary: Tribe;
  secondary?: Tribe;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({ scores, words, primary, secondary }: ResultViewProps) {
  const ranked = rankScores(scores);
  const topScore = ranked[0]?.score ?? 0;

  return (
    <>
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

      {/* Profile links — the prominent way into the deeper write-up. */}
      <div className="mt-8 flex flex-wrap items-center gap-x-7 gap-y-3">
        <ProfileLink tribe={primary} label={`Read the full ${primary.name} profile`} />
        {secondary && (
          <ProfileLink tribe={secondary} label={`Read the ${secondary.name} profile`} />
        )}
      </div>

      {/* The 12-tribe ranking — why the result came out the way it did. */}
      <section className="mt-16">
        <h2 className="font-serif text-[24px] font-semibold">How the twelve scored</h2>
        <p className="mt-1 text-[13px] text-muted">
          How strongly each tribe matched the words you chose, ranked.
        </p>

        <ul className="mt-7 flex flex-col gap-3">
          {ranked.map((s) => {
            const tribe = tribeBySlug.get(s.slug);
            if (!tribe) return null;
            const width = topScore > 0 ? (s.score / topScore) * 100 : 0;
            const pct = Math.round(s.score * 100);
            const rank =
              tribe.slug === primary.slug
                ? "primary"
                : tribe.slug === secondary?.slug
                  ? "secondary"
                  : null;
            return (
              <li
                key={s.slug}
                className="grid grid-cols-[120px_1fr_42px] items-center gap-4 max-[520px]:grid-cols-[88px_1fr_36px] max-[520px]:gap-3"
                style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className={
                      rank
                        ? "font-serif text-[16px] font-semibold text-ink"
                        : "font-serif text-[16px] text-muted"
                    }
                  >
                    {tribe.name}
                  </span>
                  {rank && (
                    <span className="text-[9px] uppercase tracking-[0.14em] text-faint max-[520px]:hidden">
                      {rank === "primary" ? "1°" : "2°"}
                    </span>
                  )}
                </div>

                <div className="h-[10px] w-full overflow-hidden rounded-[2px] bg-stone">
                  <div
                    className="h-full rounded-[2px]"
                    style={{
                      width: `${width}%`,
                      backgroundColor: "var(--accent)",
                      opacity: rank ? 1 : 0.55,
                    }}
                  />
                </div>

                <span className="text-right text-[12px] tabular-nums text-faint">
                  {pct}%
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* The words the Subject picked — connect choices to the outcome. */}
      <section className="mt-16">
        <h2 className="font-serif text-[24px] font-semibold">The words you chose</h2>
        <p className="mt-1 text-[13px] text-muted">
          {words.length} {words.length === 1 ? "word" : "words"} selected.
        </p>
        <ul className="mt-5 flex flex-wrap gap-2">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair bg-bone px-[13px] py-[6px] text-[13px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>
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
      {label}
    </Link>
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
