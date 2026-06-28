import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The enriched result view (#6): the headline tribe(s), the ranked normalized
 * scores for all 12 tribes as bars, the words the Subject picked, and prominent
 * links into the full `/tribes/[slug]` profiles.
 *
 * Presentational and client-safe by construction — it receives already-computed
 * `scores` (TribeScore carries only slug/name/score, never the word→tribe
 * mapping) plus resolved `Tribe` objects, so the scoring core and the mapping
 * stay server-side (ADR-0009). The same component renders both right after a
 * submit and when a Subject revisits their saved current result, and is reused
 * by the profile page (#18).
 */
export interface ResultViewProps {
  /** Normalized 0–1 score for every tribe, in canonical (tribe `number`) order. */
  scores: readonly TribeScore[];
  /** The words the Subject selected, in their stored order. */
  words: readonly string[];
  primary: Tribe;
  secondary?: Tribe;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({ scores, words, primary, secondary }: ResultViewProps) {
  return (
    <>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">Your tribe</p>

      <TribeHeadline tribe={primary} />
      {secondary && (
        <>
          <p className="mt-12 text-[12px] uppercase tracking-[0.2em] text-faint">
            With a strong secondary
          </p>
          <TribeHeadline tribe={secondary} />
        </>
      )}

      {/* Prominent links into the full profile(s). */}
      <div className="mt-8 flex flex-wrap gap-x-7 gap-y-3">
        <ProfileLink tribe={primary} />
        {secondary && <ProfileLink tribe={secondary} />}
      </div>

      {/* Ranked normalized scores for all 12 tribes. */}
      <TribeRanking
        scores={scores}
        primarySlug={primary.slug}
        secondarySlug={secondary?.slug}
      />

      {/* The words the Subject picked. */}
      <SelectedWords words={words} />
    </>
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

function TribeRanking({
  scores,
  primarySlug,
  secondarySlug,
}: {
  scores: readonly TribeScore[];
  primarySlug: string;
  secondarySlug?: string;
}) {
  // Rank by normalized score, descending. `scores` arrives in canonical
  // (tribe `number`) order, so a stable sort keeps ties in that order — matching
  // how `deriveResult` breaks ties.
  const ranked = [...scores].sort((a, b) => b.score - a.score);
  const max = ranked[0]?.score ?? 0;

  return (
    <section className="mt-14 border-t border-hair pt-10">
      <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How every tribe scored
      </h2>
      <div className="mt-6 flex flex-col gap-3">
        {ranked.map((s) => {
          const tribe = tribeBySlug.get(s.slug);
          const accent = accentHex(tribe?.color ?? "");
          const isPrimary = s.slug === primarySlug;
          const isSecondary = s.slug === secondarySlug;
          // Bar width is proportional to the normalized score relative to the
          // leader, so the ratios between tribes read at a glance.
          const width = max > 0 ? (s.score / max) * 100 : 0;
          return (
            <div key={s.slug} className="grid grid-cols-[120px_1fr_44px] items-center gap-3">
              <span
                className={
                  "font-serif text-[15px] leading-tight " +
                  (isPrimary || isSecondary ? "text-ink" : "text-muted")
                }
              >
                {s.name}
                {isPrimary && (
                  <span className="ml-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">
                    Primary
                  </span>
                )}
                {isSecondary && (
                  <span className="ml-1.5 text-[9px] uppercase tracking-[0.14em] text-faint">
                    Secondary
                  </span>
                )}
              </span>
              <span className="h-[10px] rounded-[2px] bg-hair/40" aria-hidden="true">
                <span
                  className="block h-full rounded-[2px]"
                  style={{
                    width: `${width}%`,
                    backgroundColor: accent,
                    opacity: isPrimary || isSecondary ? 1 : 0.55,
                  }}
                />
              </span>
              <span className="text-right text-[12px] tabular-nums text-faint">
                {Math.round(s.score * 100)}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function SelectedWords({ words }: { words: readonly string[] }) {
  if (words.length === 0) return null;
  return (
    <section className="mt-14 border-t border-hair pt-10">
      <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
      </h2>
      <ul className="mt-6 flex flex-wrap gap-2.5">
        {words.map((word) => (
          <li
            key={word}
            className="rounded-[2px] border border-hair px-3 py-1.5 text-[13px] text-ink"
          >
            {word}
          </li>
        ))}
      </ul>
    </section>
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
