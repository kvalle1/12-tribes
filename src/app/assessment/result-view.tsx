import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { ResultHeadline } from "@/lib/assessment/result";
import { rankScores } from "@/lib/assessment/ranking";
import type { TribeScore } from "@/lib/assessment/score";

/**
 * The full result view (issue #6): the headline tribe(s), the ranked
 * normalized scores for all 12 tribes as bars, the words the Subject picked, and
 * prominent links into the `/tribes/[slug]` profile(s). It is a presentational
 * server component — it takes data already resolved on the server (the headline
 * tribes, the scores, the selected words) and never touches the DB or the
 * word→tribe mapping, so it renders identically whether shown straight after a
 * submit or when a Subject revisits their saved current result (and is reusable
 * by the profile page in #18).
 */
export function ResultView({
  headline,
  scores,
  words,
}: {
  headline: ResultHeadline;
  scores: TribeScore[];
  words: string[];
}) {
  const { primary, secondary } = headline;
  const ranked = rankScores(scores, primary.slug, secondary?.slug);

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

      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How the twelve scored
        </h2>
        <ul className="mt-6 flex flex-col gap-[14px]">
          {ranked.map((row) => (
            <li
              key={row.slug}
              style={
                { "--accent": accentHex(slugColor(row.slug)) } as React.CSSProperties
              }
            >
              <div className="flex items-baseline justify-between gap-4">
                <span
                  className={
                    row.isPrimary || row.isSecondary
                      ? "font-serif text-[17px] text-ink"
                      : "font-serif text-[17px] text-muted"
                  }
                >
                  {row.name}
                  {row.isPrimary && (
                    <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.14em] text-faint">
                      Primary
                    </span>
                  )}
                  {row.isSecondary && (
                    <span className="ml-2 align-middle text-[10px] uppercase tracking-[0.14em] text-faint">
                      Secondary
                    </span>
                  )}
                </span>
                <span className="text-[12px] tabular-nums text-faint">
                  {row.percent}%
                </span>
              </div>
              <div className="mt-[6px] h-[6px] w-full overflow-hidden rounded-[3px] bg-hair">
                <div
                  className="h-full rounded-[3px]"
                  style={{
                    width: `${Math.round(row.barFraction * 100)}%`,
                    backgroundColor: "var(--accent)",
                    opacity: row.isPrimary || row.isSecondary ? 1 : 0.55,
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
        </h2>
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

      <div className="mt-16 flex flex-wrap items-center gap-[22px] border-t border-hair pt-10">
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
            Read the {secondary.name} profile
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

const colorBySlug = new Map(tribes.map((t) => [t.slug, t.color]));

/** The Tailwind color name for a tribe slug, used to accent its ranking bar. */
function slugColor(slug: string): string {
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
