import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankTribeBars } from "@/lib/assessment/ranking";

/**
 * The enriched Self Assessment result view (issue #6). Pure presentation: it
 * takes an already-computed, plain-data result (the saved slugs, the full
 * 12-tribe score table, and the selected words) and renders the headline, the
 * ranked bars for all twelve tribes, the words the Subject chose, and prominent
 * links into the `/tribes/[slug]` profiles.
 *
 * Scoring stays server-side (`score.ts` is server-only); this component never
 * sees the word→tribe mapping, only the aggregate per-tribe scores it is meant
 * to display. It is rendered identically post-submit and when a Subject revisits
 * their saved result, and is reused by the profile page (#18).
 */
export interface AssessmentResultViewProps {
  primarySlug: string;
  secondarySlug?: string | null;
  /** Normalized 0–1 score for every one of the 12 tribes. */
  scores: TribeScore[];
  /** The words the Subject selected. */
  words: readonly string[];
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function AssessmentResultView({
  primarySlug,
  secondarySlug,
  scores,
  words,
}: AssessmentResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const bars = rankTribeBars(scores);

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

      {/* How every tribe scored — all 12, ranked, with proportional bars */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </h2>
        <ol className="mt-7 flex flex-col gap-[14px]">
          {bars.map((bar, i) => {
            const tribe = tribeBySlug.get(bar.slug);
            const accent = accentHex(tribe?.color ?? "");
            return (
              <li
                key={bar.slug}
                className="grid grid-cols-[18px_minmax(96px,140px)_1fr_42px] items-center gap-3"
                style={{ "--accent": accent } as React.CSSProperties}
              >
                <span className="text-[11px] tabular-nums text-faint">
                  {i + 1}
                </span>
                <Link
                  href={`/tribes/${bar.slug}`}
                  className="font-serif text-[18px] leading-none transition-colors hover:text-[color:var(--accent)]"
                >
                  {bar.name}
                </Link>
                <div
                  className="h-[9px] overflow-hidden rounded-[2px] bg-stone"
                  role="presentation"
                >
                  <div
                    className="h-full rounded-[2px]"
                    style={{
                      width: `${bar.barPct}%`,
                      backgroundColor: "var(--accent)",
                    }}
                  />
                </div>
                <span className="text-right text-[12px] tabular-nums text-muted">
                  {bar.scorePct}%
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The words the Subject chose */}
      <section className="mt-14 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The {words.length} words you chose
        </h2>
        <ul className="mt-6 flex flex-wrap gap-x-[10px] gap-y-[10px]">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair px-[14px] py-[6px] text-[13px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>

      {/* Actions + prominent profile links */}
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
        <Link
          href={`/tribes/${tribe.slug}`}
          style={{ color: "var(--accent)" }}
          className="transition-opacity hover:opacity-80"
        >
          {tribe.name}
        </Link>
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
