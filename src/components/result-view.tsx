import Link from "next/link";
import type { Tribe } from "@/lib/tribes";
import { resolveHeadline } from "@/lib/assessment/result";
import { rankTribes } from "@/lib/assessment/ranking";

/**
 * The full Self Assessment result view (issue #6): the Primary (and qualifying
 * Secondary) headline, the ranked 12-tribe Strength Profile as proportional
 * bars, the words the Subject picked, and prominent links into the full tribe
 * profile page(s).
 *
 * It takes only the stored result fields — the selected `words` plus the
 * computed Primary/Secondary slugs — and recomputes the ranking from `words` via
 * the pure scoring core, so it renders identically whether shown right after
 * submitting or when a Subject revisits their saved current result (ADR-0004),
 * and the profile page (#18) can reuse it unchanged.
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
  const ranked = rankTribes(words);

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

      {/* Prominent links into the full profile page(s). */}
      <div className="mt-10 flex flex-wrap gap-x-8 gap-y-3">
        <ProfileLink tribe={primary} label={`Read the full ${primary.name} profile`} />
        {secondary && (
          <ProfileLink
            tribe={secondary}
            label={`Read the full ${secondary.name} profile`}
          />
        )}
      </div>

      {/* The ranked Strength Profile across all 12 tribes. */}
      <section className="mt-16">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          How every tribe scored
        </p>
        <ol className="mt-6 space-y-[14px]">
          {ranked.map(({ tribe, score, relative }) => {
            const isPrimary = tribe.slug === primary.slug;
            const isSecondary = secondary?.slug === tribe.slug;
            return (
              <li
                key={tribe.slug}
                style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
              >
                <Link
                  href={`/tribes/${tribe.slug}`}
                  className="group block rounded-[2px] focus:outline-none focus-visible:ring-1 focus-visible:ring-gold"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <span
                      className={
                        "font-serif text-[18px] transition-colors group-hover:text-[color:var(--accent)] " +
                        (isPrimary || isSecondary ? "text-ink" : "text-muted")
                      }
                    >
                      {tribe.name}
                      {isPrimary && (
                        <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-faint">
                          Primary
                        </span>
                      )}
                      {isSecondary && (
                        <span className="ml-2 text-[11px] uppercase tracking-[0.14em] text-faint">
                          Secondary
                        </span>
                      )}
                    </span>
                    <span className="font-sans text-[12px] tabular-nums text-faint">
                      {Math.round(score * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 h-[6px] w-full overflow-hidden rounded-full bg-hair">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(relative * 100, score > 0 ? 2 : 0)}%`,
                        background: "var(--accent)",
                      }}
                    />
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
        <p className="mt-5 text-[12px] leading-relaxed text-faint">
          Bars are scaled to your strongest tribe; the figure is each tribe&rsquo;s
          coverage-normalized score, so a tribe with fewer words still competes
          fairly.
        </p>
      </section>

      {/* The words the Subject picked. */}
      <section className="mt-16">
        <p className="text-[12px] uppercase tracking-[0.2em] text-faint">
          The words you picked
          <span className="ml-2 normal-case tracking-normal text-faint">
            ({words.length})
          </span>
        </p>
        <ul className="mt-5 flex flex-wrap gap-[10px]">
          {words.map((word) => (
            <li
              key={word}
              className="rounded-full border border-hair bg-stone/40 px-[14px] py-[6px] text-[13px] text-ink"
            >
              {word}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

function ProfileLink({ tribe, label }: { tribe: Tribe; label: string }) {
  return (
    <Link
      href={`/tribes/${tribe.slug}`}
      className="border-b border-gold pb-1 text-[13px] tracking-[0.08em] text-ink transition-colors hover:text-gold"
    >
      {label}
    </Link>
  );
}

function TribeHeadline({ tribe }: { tribe: Tribe }) {
  return (
    <div
      className="mt-4"
      style={{ "--accent": accentHex(tribe.color) } as React.CSSProperties}
    >
      <h1 className="font-serif text-[clamp(40px,7vw,68px)] font-semibold leading-[1.02]">
        <Link
          href={`/tribes/${tribe.slug}`}
          className="transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
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
    </div>
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
