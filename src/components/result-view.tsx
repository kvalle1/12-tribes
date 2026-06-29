import Link from "next/link";
import { tribes, type Tribe } from "@/lib/tribes";
import type { RankedTribe } from "@/lib/assessment/ranking";

/**
 * The enriched Self Assessment result view (issue #6): the Primary (and
 * Secondary when one qualifies) headline with prominent profile links, the
 * ranked normalized scores for all 12 tribes as proportional bars, and the
 * words the Subject chose.
 *
 * Purely presentational — it takes already-computed data and imports no
 * server-only scoring, so it renders identically whether shown right after
 * submitting or when a Subject revisits their saved current result, and can be
 * reused by the profile page (issue #18). All scoring stays on the server
 * (ADR-0009); only the computed scores cross into this component.
 */
export interface ResultViewProps {
  primary: Tribe;
  secondary?: Tribe;
  /** All 12 tribes ranked by normalized score (from `rankTribes`). */
  ranked: RankedTribe[];
  /** The words the Subject selected, in selection order. */
  words: readonly string[];
}

const tribeBySlug = new Map(tribes.map((t) => [t.slug, t]));

export function ResultView({ primary, secondary, ranked, words }: ResultViewProps) {
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

        <Ranking ranked={ranked} primarySlug={primary.slug} secondarySlug={secondary?.slug} />

        <ChosenWords words={words} />

        <div className="mt-14 border-t border-hair pt-8">
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
      <Link
        href={`/tribes/${tribe.slug}`}
        className="mt-4 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
      >
        Read the full {tribe.name} profile →
      </Link>
    </div>
  );
}

/** All 12 tribes as ranked, proportional bars so the Subject sees why they got their result. */
function Ranking({
  ranked,
  primarySlug,
  secondarySlug,
}: {
  ranked: RankedTribe[];
  primarySlug: string;
  secondarySlug?: string;
}) {
  return (
    <section className="mt-16 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How every tribe scored
      </p>
      <div className="mt-6 flex flex-col gap-[14px]">
        {ranked.map((entry) => {
          const tribe = tribeBySlug.get(entry.slug);
          const accent = accentHex(tribe?.color ?? "");
          const isPrimary = entry.slug === primarySlug;
          const isSecondary = entry.slug === secondarySlug;
          const emphasized = isPrimary || isSecondary;
          return (
            <div
              key={entry.slug}
              className="grid grid-cols-[120px_1fr_44px] items-center gap-4 max-[520px]:grid-cols-[88px_1fr_40px]"
            >
              <div className="flex items-baseline gap-2">
                <span
                  className={
                    "font-serif text-[18px] leading-none " +
                    (emphasized ? "font-semibold text-ink" : "text-muted")
                  }
                >
                  {entry.name}
                </span>
                {isPrimary && (
                  <span className="text-[9px] uppercase tracking-[0.14em] text-faint">
                    1st
                  </span>
                )}
                {isSecondary && (
                  <span className="text-[9px] uppercase tracking-[0.14em] text-faint">
                    2nd
                  </span>
                )}
              </div>
              <div
                className="h-[10px] overflow-hidden rounded-[2px] bg-stone"
                role="presentation"
              >
                <div
                  className="h-full rounded-[2px] transition-[width]"
                  style={{
                    width: `${Math.max(entry.fraction * 100, entry.score > 0 ? 2 : 0)}%`,
                    backgroundColor: accent,
                    opacity: emphasized ? 1 : 0.55,
                  }}
                />
              </div>
              <span className="text-right text-[12px] tabular-nums text-muted">
                {Math.round(entry.score * 100)}%
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** The words the Subject chose, so they can connect their own choices to the outcome. */
function ChosenWords({ words }: { words: readonly string[] }) {
  return (
    <section className="mt-16 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
        <span className="ml-2 text-faint/80 normal-case tracking-normal">
          ({words.length})
        </span>
      </p>
      <div className="mt-5 flex flex-wrap gap-[10px]">
        {words.map((word) => (
          <span
            key={word}
            className="rounded-[2px] border border-hair bg-white px-[13px] py-[6px] text-[13px] text-ink"
          >
            {word}
          </span>
        ))}
      </div>
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
