import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { accentHex } from "@/lib/accent";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankTribes } from "@/lib/assessment/ranking";

/**
 * The enriched Self Assessment result view (issue #6). Renders entirely from a
 * saved result row's stored fields, so it looks identical whether shown right
 * after submitting or when a Subject returns to their saved current result, and
 * the profile page (#18) can reuse it unchanged.
 *
 * The 12-tribe ranking is recomputed from `words` by the pure scoring core
 * (`rankTribes`) rather than read from storage, so the bars can never drift from
 * the stored Primary/Secondary headline — they share the same `score()` output.
 */
export interface ResultViewProps {
  /** The words the Subject selected (the stored source of truth). */
  words: string[];
  /** Computed headline slugs from the saved row. */
  primarySlug: string;
  secondarySlug?: string | null;
}

export function ResultView({
  words,
  primarySlug,
  secondarySlug,
}: ResultViewProps) {
  const { primary, secondary } = resolveHeadline(primarySlug, secondarySlug);
  const ranked = rankTribes(words);

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

      {/* Ranking bars — all 12 tribes, so the Subject sees why they got this result. */}
      <section className="mt-16 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </h2>
        <ol className="mt-6 flex flex-col gap-[14px]">
          {ranked.map((row, i) => {
            const accent = accentHex(row.tribe.color);
            const isHeadline =
              row.tribe.slug === primary.slug ||
              row.tribe.slug === secondary?.slug;
            return (
              <li
                key={row.tribe.slug}
                className="grid grid-cols-[26px_1fr_44px] items-center gap-3"
              >
                <span className="text-right font-serif text-[14px] tabular-nums text-faint">
                  {i + 1}
                </span>
                <div>
                  <div className="flex items-baseline justify-between">
                    <Link
                      href={`/tribes/${row.tribe.slug}`}
                      className={`font-serif text-[17px] leading-tight transition-colors hover:text-gold ${
                        isHeadline ? "text-ink" : "text-muted"
                      }`}
                    >
                      {row.tribe.name}
                      <span className="ml-2 font-sans text-[11px] uppercase tracking-[0.12em] text-faint">
                        {row.tribe.callSign}
                      </span>
                    </Link>
                  </div>
                  <div
                    className="mt-[6px] h-[6px] w-full overflow-hidden rounded-full bg-hair"
                    role="presentation"
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.round(row.fraction * 100)}%`,
                        backgroundColor: accent,
                        opacity: isHeadline ? 1 : 0.55,
                      }}
                    />
                  </div>
                </div>
                <span className="text-right font-sans text-[12px] tabular-nums text-muted">
                  {Math.round(row.score * 100)}%
                </span>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The words the Subject picked. */}
      <section className="mt-14 border-t border-hair pt-10">
        <h2 className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you chose
        </h2>
        <ul className="mt-5 flex flex-wrap gap-[10px]">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-[2px] border border-hair px-3 py-[6px] font-serif text-[15px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>

      {/* Actions + prominent profile links. */}
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
