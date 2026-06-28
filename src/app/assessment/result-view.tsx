import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankResult, type RankedTribe } from "@/lib/assessment/ranking";

/**
 * The full result deliverable (issue #6), rendered from a saved current result:
 * the Primary (and qualifying Secondary) headline, the ranked normalized scores
 * for all 12 tribes as proportional bars, the words the Subject picked, and
 * prominent links into the full tribe profile(s).
 *
 * It is a presentational server component taking only the saved row's fields, so
 * the same view renders identically whether shown right after submitting or when
 * revisiting the saved result — and the profile page (issue #18) reuses it as-is.
 * Scoring/ranking runs server-side here; only plain numbers and tribe content
 * reach the markup, never the word→tribe mapping (ADR-0009).
 */
export interface ResultViewProps {
  words: string[];
  primarySlug: string;
  secondarySlug: string | null;
}

export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranked = rankResult(words, primarySlug, secondarySlug);

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

        <RankingBars ranked={ranked} />

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

/** The ranked normalized scores for all 12 tribes, as proportional accent bars. */
function RankingBars({ ranked }: { ranked: RankedTribe[] }) {
  return (
    <section className="mt-16 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        How every tribe scored
      </p>
      <ul className="mt-6 flex flex-col gap-[14px]">
        {ranked.map((row) => (
          <li
            key={row.tribe.slug}
            className="grid grid-cols-[104px_1fr_40px] items-center gap-4 max-[520px]:grid-cols-[84px_1fr_36px]"
            style={
              { "--accent": accentHex(row.tribe.color) } as React.CSSProperties
            }
          >
            <span
              className={`font-serif text-[16px] leading-tight ${
                row.isPrimary || row.isSecondary
                  ? "font-semibold text-ink"
                  : "text-muted"
              }`}
            >
              {row.tribe.name}
            </span>
            <span
              className="relative h-[10px] overflow-hidden rounded-[2px] bg-hair"
              role="presentation"
            >
              <span
                className="absolute inset-y-0 left-0 rounded-[2px]"
                style={{
                  width: `${(row.barFraction * 100).toFixed(2)}%`,
                  background: "var(--accent)",
                  opacity: row.isPrimary || row.isSecondary ? 1 : 0.62,
                }}
              />
            </span>
            <span className="text-right text-[12px] tabular-nums text-faint">
              {row.percent}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** The words the Subject selected, in the order they picked them. */
function SelectedWords({ words }: { words: string[] }) {
  return (
    <section className="mt-16 border-t border-hair pt-8">
      <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
        The words you chose
      </p>
      <ul className="mt-5 flex flex-wrap gap-[10px]">
        {words.map((word) => (
          <li
            key={word}
            className="rounded-[2px] border border-hair px-[13px] py-[6px] text-[13px] text-ink"
          >
            {word}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Prominent link into a tribe's full `/tribes/[slug]` profile. */
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
