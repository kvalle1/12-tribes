import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { tribes } from "@/lib/tribes";
import type { TribeScore } from "@/lib/assessment/score";
import { rankByScore, resolveHeadline } from "@/lib/assessment/result";

/**
 * The enriched Self Assessment result view (issue #6): the Primary (and
 * Secondary, when one qualifies) headline with prominent links into the full
 * tribe profiles, the full 12-tribe ranking as proportional bars, and the words
 * the Subject picked.
 *
 * Pure presentation — it takes already-computed data (the normalized 12-tribe
 * `scores` recomputed server-side from the stored words, plus the saved result
 * slugs) and renders it. It runs no scoring and never touches the word→tribe
 * mapping, so it is client-safe and renders identically whether shown right
 * after submitting or when revisiting the saved current result. The profile
 * page (#18) reuses it unchanged.
 */
export interface ResultViewProps {
  /** Normalized 0–1 score for every tribe (any order; the view ranks them). */
  scores: TribeScore[];
  /** The words the Subject selected, in selection order. */
  words: string[];
  primarySlug: string;
  secondarySlug?: string | null;
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({
  scores,
  words,
  primarySlug,
  secondarySlug,
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranked = rankByScore(scores);
  // Scale bars to the top score so the strongest tribe fills the track and the
  // ranking reads clearly; an all-zero selection can't occur (8–15 words gated).
  const topScore = ranked[0]?.score ?? 0;

  return (
    <div>
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        Your tribe
      </p>
      <TribeHeadline tribe={primary} />
      <ProfileLink tribe={primary} />

      {secondary && (
        <>
          <p className="mt-12 text-[12px] uppercase tracking-[0.2em] text-faint">
            With a strong secondary
          </p>
          <TribeHeadline tribe={secondary} />
          <ProfileLink tribe={secondary} />
        </>
      )}

      <section className="mt-14 border-t border-hair pt-10">
        <h2 className="font-serif text-[26px] font-semibold">
          How every tribe scored
        </h2>
        <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-faint">
          Your normalized fit across all twelve
        </p>
        <ol className="mt-7 space-y-[14px]">
          {ranked.map((s, i) => (
            <ScoreBar
              key={s.slug}
              rank={i + 1}
              score={s}
              topScore={topScore}
              isPrimary={s.slug === primary.slug}
              isSecondary={s.slug === secondary?.slug}
            />
          ))}
        </ol>
      </section>

      <section className="mt-14 border-t border-hair pt-10">
        <h2 className="font-serif text-[26px] font-semibold">
          The words you chose
        </h2>
        <p className="mt-1 text-[12px] uppercase tracking-[0.14em] text-faint">
          {words.length} {words.length === 1 ? "word" : "words"}
        </p>
        <ul className="mt-6 flex flex-wrap gap-[10px]">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair bg-stone/40 px-[14px] py-[7px] text-[13px] tracking-[0.02em] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>
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

function ProfileLink({ tribe }: { tribe: Tribe }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="mt-5 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      Read the full {tribe.name} profile →
    </Link>
  );
}

function ScoreBar({
  rank,
  score,
  topScore,
  isPrimary,
  isSecondary,
}: {
  rank: number;
  score: TribeScore;
  topScore: number;
  isPrimary: boolean;
  isSecondary: boolean;
}) {
  const tribe = tribeBySlug.get(score.slug);
  const accent = accentHex(tribe?.color ?? "");
  const width = topScore > 0 ? (score.score / topScore) * 100 : 0;
  const highlighted = isPrimary || isSecondary;

  return (
    <li
      className="grid items-center gap-x-4 gap-y-1"
      style={
        {
          "--accent": accent,
          gridTemplateColumns: "minmax(96px,auto) 1fr minmax(44px,auto)",
        } as React.CSSProperties
      }
    >
      <span className="flex items-baseline gap-2">
        <span className="text-[11px] tabular-nums text-faint">
          {String(rank).padStart(2, "0")}
        </span>
        <span
          className={
            highlighted
              ? "font-serif text-[18px] font-semibold leading-none"
              : "font-serif text-[18px] leading-none text-muted"
          }
        >
          {score.name}
        </span>
      </span>

      <span className="h-[10px] w-full overflow-hidden rounded-[2px] bg-stone">
        <span
          className="block h-full rounded-[2px]"
          style={{
            width: `${width}%`,
            background: "var(--accent)",
            opacity: highlighted ? 1 : 0.4,
          }}
        />
      </span>

      <span className="text-right text-[12px] tabular-nums text-muted">
        {Math.round(score.score * 100)}%
      </span>

      {isPrimary && (
        <span className="col-start-2 text-[10px] uppercase tracking-[0.16em] text-faint">
          Primary
        </span>
      )}
      {isSecondary && (
        <span className="col-start-2 text-[10px] uppercase tracking-[0.16em] text-faint">
          Secondary
        </span>
      )}
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
