import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { score } from "@/lib/assessment/score";
import {
  rankScores,
  resolveHeadline,
  type RankedTribe,
} from "@/lib/assessment/result";

/**
 * The full result view — the Subject's headline tribe(s), the ranked 12-tribe
 * Strength Profile as proportional bars, the words they picked, and prominent
 * links into the full tribe profile pages (issue #6, PRD stories 11/12/13).
 *
 * It is a server component because the scoring core (`score`) is `server-only`:
 * the 12-tribe ranking is recomputed here from the saved `words` so it can never
 * drift from them, and the word→tribe mapping never reaches the client (only the
 * resulting per-tribe scores do). It takes the saved row's fields directly so the
 * post-submit result page and the profile page (#18) render it identically.
 */
export interface ResultViewProps {
  words: string[];
  primarySlug: string;
  secondarySlug?: string | null;
}

export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranking = rankScores(score(words));
  const headlineSlugs = new Set(
    [primarySlug, secondarySlug].filter(Boolean) as string[],
  );

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

        {/* The full Strength Profile — why the headline came out the way it did. */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            How every tribe scored
          </h2>
          <ul className="mt-7 flex flex-col gap-[18px]">
            {ranking.map((entry) => (
              <RankingBar
                key={entry.tribe.slug}
                entry={entry}
                highlighted={headlineSlugs.has(entry.tribe.slug)}
              />
            ))}
          </ul>
        </section>

        {/* The Subject's own selections, so they can connect choices to outcome. */}
        <section className="mt-16 border-t border-hair pt-10">
          <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
            The words you chose
            <span className="ml-2 tabular-nums text-hair">({words.length})</span>
          </h2>
          <ul className="mt-6 flex flex-wrap gap-[10px]">
            {words.map((word) => (
              <li
                key={word}
                className="rounded-[2px] border border-hair bg-white/40 px-[14px] py-[7px] text-[13px] text-ink"
              >
                {word}
              </li>
            ))}
          </ul>
        </section>

        {/* Actions: retake, and read the full profile for the headline tribe(s). */}
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

/** One tribe's ranked bar: name, proportional accent-colored fill, and percentage. */
function RankingBar({
  entry,
  highlighted,
}: {
  entry: RankedTribe;
  highlighted: boolean;
}) {
  const { tribe, score: tribeScore, barFraction } = entry;
  const percent = Math.round(tribeScore * 100);
  return (
    <li
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <div className="flex items-baseline justify-between text-[13px]">
        <span
          className={
            highlighted ? "font-serif text-[17px] font-semibold" : "text-ink"
          }
        >
          {tribe.name}
        </span>
        <span className="tabular-nums text-muted">{percent}%</span>
      </div>
      <div className="mt-[6px] h-[8px] w-full overflow-hidden rounded-full bg-hair/40">
        <div
          className="h-full rounded-full transition-[width]"
          style={{
            width: `${Math.max(barFraction * 100, percent > 0 ? 2 : 0)}%`,
            backgroundColor: "var(--accent)",
            opacity: highlighted ? 1 : 0.55,
          }}
        />
      </div>
    </li>
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
