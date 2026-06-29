import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import type { RankedTribe, ResultHeadline } from "@/lib/assessment/result";
import { accentHex } from "@/lib/assessment/result";

/**
 * The enriched Self Assessment result view (#6): the Primary (and Secondary when
 * one qualifies) headline, the full 12-tribe ranking as proportional bars, the
 * words the Subject picked, and prominent links into the full tribe profiles.
 *
 * Presentational and data-only — it receives an already-resolved headline, the
 * ranked scores, and the selected words, so it carries no scoring logic or
 * word→tribe mapping (ADR-0009 trust boundary). It is shared verbatim between
 * the post-submit result page and a revisit of the saved current result, and is
 * reused by the profile page (#18).
 */
export function ResultView({
  headline,
  ranked,
  words,
}: {
  headline: ResultHeadline;
  ranked: RankedTribe[];
  words: string[];
}) {
  const { primary, secondary } = headline;

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

      {/* Profile links for the headline tribe(s). */}
      <div className="mt-10 flex flex-wrap items-center gap-x-[22px] gap-y-3">
        <ProfileLink tribe={primary} />
        {secondary && <ProfileLink tribe={secondary} />}
      </div>

      {/* The full 12-tribe ranking — so the Subject sees why they got this result. */}
      <section className="mt-16">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </p>
        <ol className="mt-6 flex flex-col gap-[14px]">
          {ranked.map((tribe) => {
            const isHeadline =
              tribe.slug === primary.slug || tribe.slug === secondary?.slug;
            return (
              <li
                key={tribe.slug}
                style={{ "--accent": tribe.accent } as React.CSSProperties}
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span
                    className={
                      isHeadline
                        ? "font-serif text-[17px] font-semibold text-ink"
                        : "font-serif text-[17px] text-muted"
                    }
                  >
                    {tribe.name}
                    <span className="ml-2 text-[13px] italic text-faint">
                      {tribe.callSign}
                    </span>
                  </span>
                  <span className="text-[12px] tabular-nums tracking-[0.08em] text-muted">
                    {Math.round(tribe.score * 100)}%
                  </span>
                </div>
                <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-hair">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.max(tribe.relative * 100, tribe.score > 0 ? 2 : 0)}%`,
                      backgroundColor: "var(--accent)",
                      opacity: isHeadline ? 1 : 0.5,
                    }}
                  />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {/* The words the Subject picked — connecting their own choices to the outcome. */}
      <section className="mt-16">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The {words.length} words you chose
        </p>
        <ul className="mt-5 flex flex-wrap gap-[10px]">
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

      <div className="mt-16 border-t border-hair pt-8">
        <Link
          href="/assessment"
          className="rounded-[2px] bg-ink px-[30px] py-[13px] text-[13px] tracking-[0.08em] text-bone transition-colors hover:bg-black"
        >
          Retake the assessment
        </Link>
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
