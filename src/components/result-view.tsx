import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import {
  accentHex,
  buildResultView,
  type RankedTribe,
} from "@/lib/assessment/result-view";

/**
 * The enriched Self Assessment result view (issue #6): the headline tribe(s)
 * with links into their full profiles, the full 12-tribe ranking as proportional
 * bars, and the words the Subject chose. Rendered identically whether shown right
 * after submitting or when revisiting the saved current result, and reused by the
 * profile page (#18).
 *
 * A Server Component: it builds its model with `buildResultView`, which pulls in
 * the word→tribe mapping and so must stay on the server (ADR-0009).
 */
export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: {
  words: readonly string[];
  primarySlug: string;
  secondarySlug?: string | null;
}) {
  const { primary, secondary, ranked, words: chosen } = buildResultView(
    words,
    primarySlug,
    secondarySlug,
  );

  return (
    <>
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

      {/* 12-tribe ranking */}
      <section className="mt-16">
        <div className="flex items-baseline justify-between border-b border-hair pb-2">
          <h2 className="font-serif text-[24px] font-semibold">
            How the twelve scored
          </h2>
          <span className="text-[11px] uppercase tracking-[0.16em] text-faint">
            Ranked
          </span>
        </div>
        <ol className="mt-6 flex flex-col gap-[18px]">
          {ranked.map((row) => (
            <RankingBar key={row.tribe.slug} row={row} />
          ))}
        </ol>
      </section>

      {/* The Subject's chosen words */}
      <section className="mt-16">
        <h2 className="font-serif text-[24px] font-semibold border-b border-hair pb-2">
          The words you chose
        </h2>
        <ul className="mt-6 flex flex-wrap gap-[10px]">
          {chosen.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair bg-stone/40 px-[14px] py-[7px] text-[13px] tracking-[0.02em] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

/** The big tribe headline (Primary/Secondary), with a link into its profile. */
function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <div className="mt-4">
      <h1 className="font-serif text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02]">
        <Link
          href={`/tribes/${tribe.slug}`}
          className="transition-opacity hover:opacity-70"
          style={{ color: accentHex(tribe.color) }}
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
      <Link
        href={`/tribes/${tribe.slug}`}
        className="mt-4 inline-block border-b border-gold pb-1 text-[13px] tracking-[0.06em] text-ink transition-colors hover:text-gold"
      >
        Read the full {tribe.name} profile →
      </Link>
    </div>
  );
}

/** A single ranking row: tribe name, proportional accent bar, and percentage. */
function RankingBar({ row }: { row: RankedTribe }) {
  const { tribe, percent, barFraction, accent, isPrimary, isSecondary } = row;
  const emphasised = isPrimary || isSecondary;

  return (
    <li className="grid grid-cols-[110px_1fr_42px] items-center gap-4 max-[520px]:grid-cols-[88px_1fr_36px] max-[520px]:gap-3">
      <div className="flex items-baseline gap-2">
        <span
          className={
            emphasised
              ? "font-serif text-[17px] font-semibold leading-none"
              : "font-serif text-[17px] leading-none text-muted"
          }
          style={emphasised ? { color: accent } : undefined}
        >
          {tribe.name}
        </span>
        {isPrimary && (
          <span className="text-[9px] uppercase tracking-[0.14em] text-faint">
            1°
          </span>
        )}
        {isSecondary && (
          <span className="text-[9px] uppercase tracking-[0.14em] text-faint">
            2°
          </span>
        )}
      </div>

      <div
        className="h-[10px] w-full overflow-hidden rounded-[2px] bg-stone"
        role="presentation"
      >
        <div
          className="h-full rounded-[2px] transition-[width]"
          style={{
            width: `${(barFraction * 100).toFixed(1)}%`,
            backgroundColor: accent,
            opacity: emphasised ? 1 : 0.55,
          }}
        />
      </div>

      <span className="text-right text-[12px] tabular-nums text-muted">
        {percent}%
      </span>
    </li>
  );
}
