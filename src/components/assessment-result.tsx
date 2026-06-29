import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type { RankedTribe, ResultView } from "@/lib/assessment/result-view";

/**
 * The enriched Self Assessment result body (issue #6): the Primary (and
 * Secondary) headline, the full 12-tribe ranking as proportional bars, the
 * Subject's selected words, and prominent links into the tribe profile page(s).
 *
 * Presentational and client-safe — it receives the already-computed `ResultView`
 * (no word→tribe mapping). The same component renders both right after submitting
 * and when a Subject revisits their saved current result, so the two views are
 * identical by construction. Reused by the profile page (issue #18).
 */
export function AssessmentResult({ view }: { view: ResultView }) {
  const { primary, secondary, ranked, words } = view;

  return (
    <>
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

      <RankingBars ranked={ranked} />

      <ChosenWords words={words} />

      <div className="mt-14 flex flex-wrap items-center gap-x-[22px] gap-y-4 border-t border-hair pt-8">
        <Link
          href="/assessment"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Retake the assessment
        </Link>
        <ProfileLink tribe={primary} />
        {secondary && <ProfileLink tribe={secondary} />}
      </div>
    </>
  );
}

/** The big Primary/Secondary headline: name (in accent), call sign, Hebrew, essence. */
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
 * All 12 tribes ranked by normalized score as proportional bars. Bar lengths are
 * scaled to the top score so the ranking reads clearly; the Primary and Secondary
 * bars carry their tribe accent color, the rest stay neutral so the result still
 * leads the eye.
 */
function RankingBars({ ranked }: { ranked: RankedTribe[] }) {
  const top = ranked[0]?.score ?? 0;
  return (
    <section className="mt-16">
      <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How the twelve scored
      </h2>
      <ul className="mt-6 flex flex-col gap-3.5">
        {ranked.map((r) => {
          const fill = top > 0 ? (r.score / top) * 100 : 0;
          const accent = r.isPrimary || r.isSecondary;
          return (
            <li
              key={r.tribe.slug}
              className="grid grid-cols-[minmax(0,160px)_1fr] items-center gap-x-4 max-[520px]:grid-cols-[minmax(0,120px)_1fr]"
              style={
                { "--accent": accentHex(r.tribe.color) } as React.CSSProperties
              }
            >
              <div className="min-w-0 truncate">
                <span
                  className="font-serif text-[17px] font-medium"
                  style={accent ? { color: "var(--accent)" } : undefined}
                >
                  {r.tribe.name}
                </span>
                {r.isPrimary && <RankTag>Primary</RankTag>}
                {r.isSecondary && <RankTag>Secondary</RankTag>}
              </div>
              <div className="h-[7px] w-full overflow-hidden rounded-full bg-hair/60">
                <div
                  className="h-full rounded-full transition-[width] duration-500"
                  style={{
                    width: `${fill}%`,
                    background: accent ? "var(--accent)" : "var(--muted)",
                    opacity: accent ? 1 : 0.45,
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

function RankTag({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.14em] text-faint">
      {children}
    </span>
  );
}

/** The words the Subject picked, shown as pills so they can tie choices to outcome. */
function ChosenWords({ words }: { words: string[] }) {
  return (
    <section className="mt-16">
      <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
      </h2>
      <ul className="mt-5 flex flex-wrap gap-2.5">
        {words.map((word) => (
          <li
            key={word}
            className="rounded-full border border-hair px-3.5 py-1.5 text-[13px] text-muted"
          >
            {word}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** A prominent link into a tribe's full `/tribes/[slug]` profile. */
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
