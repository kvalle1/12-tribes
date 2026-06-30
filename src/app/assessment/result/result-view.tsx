import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { rankBars } from "@/lib/assessment/ranking";

/**
 * The full result view (issue #6): the Primary (and qualifying Secondary)
 * headline, the ranked normalized scores for all 12 tribes as proportional bars,
 * the words the Subject picked, and prominent links into the tribe profile
 * pages. It is purely presentational — it takes the already-computed scores and
 * resolved tribes — so the same view renders identically whether shown right
 * after submitting or when the Subject returns to their saved result, and it can
 * be reused by the profile page (#18).
 */
export function ResultView({
  scores,
  words,
  primary,
  secondary,
}: {
  scores: TribeScore[];
  words: readonly string[];
  primary: Tribe;
  secondary?: Tribe;
}) {
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

      <RankingChart
        scores={scores}
        primarySlug={primary.slug}
        secondarySlug={secondary?.slug}
      />

      <SelectedWords words={words} />

      <div className="mt-14 flex flex-wrap items-center gap-[22px] border-t border-hair pt-8">
        <Link
          href="/assessment"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Retake the assessment
        </Link>
        <ProfileLink tribe={primary} />
        {secondary && <ProfileLink tribe={secondary} />}
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

/** All 12 tribes ranked by normalized score, as proportional bars. */
function RankingChart({
  scores,
  primarySlug,
  secondarySlug,
}: {
  scores: TribeScore[];
  primarySlug: string;
  secondarySlug?: string;
}) {
  const bars = rankBars(scores);

  return (
    <section className="mt-16 border-t border-hair pt-10">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How the twelve scored
      </p>
      <ul className="mt-6 flex flex-col gap-[14px]">
        {bars.map((bar) => {
          const highlighted =
            bar.slug === primarySlug || bar.slug === secondarySlug;
          return (
            <li
              key={bar.slug}
              style={
                { "--accent": accentHex(colorFor(bar.slug)) } as React.CSSProperties
              }
            >
              <div className="flex items-baseline justify-between text-[13px]">
                <span
                  className={
                    highlighted
                      ? "font-serif text-[17px] text-ink"
                      : "text-muted"
                  }
                >
                  {bar.name}
                </span>
                <span className="tabular-nums text-faint">
                  {Math.round(bar.score * 100)}%
                </span>
              </div>
              <div className="mt-[6px] h-[6px] w-full rounded-[3px] bg-hair">
                <div
                  className="h-full rounded-[3px]"
                  style={{
                    width: `${bar.widthPct}%`,
                    backgroundColor: "var(--accent)",
                    opacity: highlighted ? 1 : 0.45,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The words the Subject selected, so they can connect choices to the outcome. */
function SelectedWords({ words }: { words: readonly string[] }) {
  if (words.length === 0) return null;
  return (
    <section className="mt-16 border-t border-hair pt-10">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
      </p>
      <ul className="mt-6 flex flex-wrap gap-[10px]">
        {words.map((word) => (
          <li
            key={word}
            className="rounded-[2px] border border-hair px-[14px] py-[7px] text-[14px] text-ink"
          >
            {word}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ProfileLink({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      Read the full {tribe.name} profile
    </Link>
  );
}

const colorBySlug = new Map(tribes.map((t) => [t.slug, t.color]));

function colorFor(slug: string): string {
  return colorBySlug.get(slug) ?? "";
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
