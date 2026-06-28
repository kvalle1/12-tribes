import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type { RankedTribe } from "@/lib/assessment/result";

/**
 * The full Self Assessment result view (issue #6): the Primary (and Secondary
 * when one qualifies) headline, the 12-tribe ranking bars, the words the Subject
 * chose, and prominent links into the tribe profile pages.
 *
 * It is a presentational server component that takes already-resolved data, so
 * it renders identically whether shown right after submitting or when revisiting
 * the saved current result — and the profile page (issue #18) reuses it as-is.
 * All scoring/resolution happens on the server before the props reach here; this
 * component imports no scoring or DB code and ships no word→tribe mapping.
 */
export interface ResultViewProps {
  primary: Tribe;
  secondary?: Tribe;
  /** All 12 tribes, highest normalized score first. */
  ranked: RankedTribe[];
  /** The words the Subject selected. */
  words: readonly string[];
}

export function ResultView({
  primary,
  secondary,
  ranked,
  words,
}: ResultViewProps) {
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

        <RankingBars
          ranked={ranked}
          primarySlug={primary.slug}
          secondarySlug={secondary?.slug}
        />

        <ChosenWords words={words} />

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

/**
 * All 12 tribes as ranked bars. The bar width is the tribe's normalized 0–1
 * score so the bars are honestly proportional to the score itself; the Primary
 * and Secondary are marked so the Subject can connect the headline to the chart.
 */
function RankingBars({
  ranked,
  primarySlug,
  secondarySlug,
}: {
  ranked: RankedTribe[];
  primarySlug: string;
  secondarySlug?: string;
}) {
  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How every tribe scored
      </p>
      <ol className="mt-6 flex flex-col gap-[18px]">
        {ranked.map(({ tribe, score }) => {
          const pct = Math.round(score * 100);
          const role =
            tribe.slug === primarySlug
              ? "Primary"
              : tribe.slug === secondarySlug
                ? "Secondary"
                : null;
          return (
            <li
              key={tribe.slug}
              style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-serif text-[18px] leading-tight">
                  {tribe.name}
                  {role && (
                    <span className="ml-2 text-[10px] uppercase tracking-[0.14em] text-gold">
                      {role}
                    </span>
                  )}
                </span>
                <span className="text-[13px] tabular-nums text-muted">{pct}%</span>
              </div>
              <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-hair">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: "var(--accent)" }}
                />
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ChosenWords({ words }: { words: readonly string[] }) {
  return (
    <section className="mt-14 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
      </p>
      <ul className="mt-6 flex flex-wrap gap-2">
        {words.map((word) => (
          <li
            key={word}
            className="rounded-[2px] border border-hair px-3 py-1 text-[13px] text-muted"
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
